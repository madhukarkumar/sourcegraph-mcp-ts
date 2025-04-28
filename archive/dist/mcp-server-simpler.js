"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Create a simplified MCP server that doesn't rely on the actual MCP SDK for now
const app = (0, express_1.default)();
const port = 3002; // Explicitly use a different port than our main server (3001)
// Sourcegraph API configuration
const sgUrl = process.env.SOURCEGRAPH_URL;
const sgToken = process.env.SOURCEGRAPH_TOKEN;
// Log configuration for debugging (redact token for security)
console.log(`MCP Server - Sourcegraph URL: ${sgUrl || 'NOT SET'}`);
console.log(`MCP Server - Sourcegraph Token: ${sgToken ? 'SET (redacted)' : 'NOT SET'}`);
// Configure CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
app.use(express_1.default.json());
// Define MCP server metadata
const serverMetadata = {
    name: "Sourcegraph MCP Server",
    version: "1.0.0",
    capabilities: {
        resources: true,
        tools: true
    }
};
// Server metadata endpoint
app.get("/", (req, res) => {
    res.json({
        message: "Sourcegraph MCP Server is running",
        ...serverMetadata
    });
});
// MCP server discovery endpoint
app.get("/mcp-info", (req, res) => {
    res.json(serverMetadata);
});
// Tool endpoint for searching code
app.post("/tools/search-code", async (req, res) => {
    const { query, type = 'file' } = req.body.params || {};
    if (!query) {
        return res.status(400).json({
            error: "Missing 'query' parameter"
        });
    }
    if (!sgUrl || !sgToken) {
        // Try to load from environment vars directly (in case they changed)
        const envUrl = process.env.SOURCEGRAPH_URL;
        const envToken = process.env.SOURCEGRAPH_TOKEN;
        if (!envUrl || !envToken) {
            console.error('Search-code tool: Sourcegraph URL or token not configured');
            return res.status(500).json({
                error: "Sourcegraph URL or token not configured",
                isError: true
            });
        }
        // Use the newly loaded values
        console.log('Re-loaded environment variables successfully');
        // Replace the null values with the newly loaded ones
        // This is a workaround for the scope issue
        const _sgUrl = envUrl;
        const _sgToken = envToken;
    }
    try {
        // Build the search query
        const searchQuery = `${query} type:${type} count:20`;
        // The GraphQL query
        const graphqlQuery = `
      query CodeSearch($query: String!) {
        search(query: $query, version: V3) {
          results {
            matchCount
            results {
              __typename
              ... on FileMatch {
                repository { name }
                file { path }
                lineMatches {
                  lineNumber
                  preview
                }
              }
              ... on CommitSearchResult {
                commit {
                  oid
                  message
                  author {
                    person {
                      name
                      email
                    }
                    date
                  }
                  repository { name }
                }
              }
            }
          }
        }
      }
    `;
        // Headers for Sourcegraph API
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        if (!effectiveUrl || !effectiveToken) {
            throw new Error('Sourcegraph URL or token not configured');
        }
        const headers = {
            'Authorization': `token ${effectiveToken}`,
            'Content-Type': 'application/json'
        };
        console.log(`Making request to ${effectiveUrl}/.api/graphql`);
        // Make the request to Sourcegraph API
        const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: searchQuery } }, { headers });
        if (response.data.errors) {
            return res.status(500).json({
                error: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}`,
                isError: true
            });
        }
        // Format the results
        const results = response.data.data.search.results;
        const matchCount = results.matchCount;
        const items = results.results;
        // Create a formatted result
        const formattedItems = items.map((item) => {
            if (item.__typename === 'FileMatch') {
                const matchItem = item;
                const repo = matchItem.repository.name;
                const filePath = matchItem.file.path;
                const matches = matchItem.lineMatches.map((match) => `Line ${match.lineNumber}: ${match.preview}`).join('\n');
                return `Repository: ${repo}\nFile: ${filePath}\n${matches}\n`;
            }
            else if (item.__typename === 'CommitSearchResult') {
                const commitItem = item;
                const commit = commitItem.commit;
                const repo = commit.repository.name;
                return `Repository: ${repo}\nCommit: ${commit.oid.substring(0, 7)}\nAuthor: ${commit.author.person.name}\nDate: ${commit.author.date}\nMessage: ${commit.message}`;
            }
            return null;
        }).filter(Boolean).join('\n---\n');
        return res.json({
            content: [{
                    type: "text",
                    text: `Found ${matchCount} matches for "${query}" with type:${type}\n\n${formattedItems}`
                }]
        });
    }
    catch (error) {
        console.error('Error in search-code tool:', error);
        return res.status(500).json({
            error: `Error searching Sourcegraph: ${error.message || 'Unknown error'}`,
            isError: true
        });
    }
});
// Tool endpoint for commit search
app.post("/tools/search-commits", async (req, res) => {
    const { author, message, after } = req.body.params || {};
    if (!sgUrl || !sgToken) {
        // Try to load from environment vars directly (in case they changed)
        const envUrl = process.env.SOURCEGRAPH_URL;
        const envToken = process.env.SOURCEGRAPH_TOKEN;
        if (!envUrl || !envToken) {
            console.error('Search-commits tool: Sourcegraph URL or token not configured');
            return res.status(500).json({
                error: "Sourcegraph URL or token not configured",
                isError: true
            });
        }
        // Use the newly loaded values
        console.log('Re-loaded environment variables successfully');
    }
    try {
        // Build the search query
        let searchQuery = 'type:commit';
        if (author)
            searchQuery += ` author:${author}`;
        if (message)
            searchQuery += ` message:${message}`;
        if (after)
            searchQuery += ` after:${after}`;
        searchQuery += ' count:20';
        // The GraphQL query
        const graphqlQuery = `
      query CommitSearch($query: String!) {
        search(query: $query, version: V3) {
          results {
            matchCount
            results {
              __typename
              ... on CommitSearchResult {
                commit {
                  oid
                  message
                  author {
                    person {
                      name
                      email
                    }
                    date
                  }
                  repository { name }
                }
              }
            }
          }
        }
      }
    `;
        // Headers for Sourcegraph API
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        if (!effectiveUrl || !effectiveToken) {
            throw new Error('Sourcegraph URL or token not configured');
        }
        const headers = {
            'Authorization': `token ${effectiveToken}`,
            'Content-Type': 'application/json'
        };
        console.log(`Making request to ${effectiveUrl}/.api/graphql`);
        // Make the request to Sourcegraph API
        const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: searchQuery } }, { headers });
        if (response.data.errors) {
            return res.status(500).json({
                error: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}`,
                isError: true
            });
        }
        // Format the results
        const results = response.data.data.search.results;
        const matchCount = results.matchCount;
        const items = results.results;
        // Create a formatted result
        const formattedItems = items
            .filter((item) => item.__typename === 'CommitSearchResult')
            .map((item) => {
            const commit = item.commit;
            const repo = commit.repository.name;
            return `Repository: ${repo}\nCommit: ${commit.oid.substring(0, 7)}\nAuthor: ${commit.author.person.name} <${commit.author.person.email}>\nDate: ${commit.author.date}\nMessage: ${commit.message}`;
        })
            .join('\n---\n');
        return res.json({
            content: [{
                    type: "text",
                    text: `Found ${matchCount} commits matching the criteria\n\n${formattedItems}`
                }]
        });
    }
    catch (error) {
        console.error('Error in search-commits tool:', error);
        return res.status(500).json({
            error: `Error searching Sourcegraph commits: ${error.message || 'Unknown error'}`,
            isError: true
        });
    }
});
// Tool endpoint for diff search
app.post("/tools/search-diffs", async (req, res) => {
    const { query, author, after } = req.body.params || {};
    if (!sgUrl || !sgToken) {
        // Try to load from environment vars directly (in case they changed)
        const envUrl = process.env.SOURCEGRAPH_URL;
        const envToken = process.env.SOURCEGRAPH_TOKEN;
        if (!envUrl || !envToken) {
            console.error('Search-diffs tool: Sourcegraph URL or token not configured');
            return res.status(500).json({
                error: "Sourcegraph URL or token not configured",
                isError: true
            });
        }
        // Use the newly loaded values
        console.log('Re-loaded environment variables successfully');
    }
    try {
        // Build the search query
        let searchQuery = 'type:diff';
        if (query)
            searchQuery += ` ${query}`;
        if (author)
            searchQuery += ` author:${author}`;
        if (after)
            searchQuery += ` after:${after}`;
        searchQuery += ' count:20';
        // The GraphQL query
        const graphqlQuery = `
      query DiffSearch($query: String!) {
        search(query: $query, version: V3) {
          results {
            matchCount
            results {
              __typename
              ... on CommitSearchResult {
                commit {
                  oid
                  message
                  author {
                    person {
                      name
                      email
                    }
                    date
                  }
                  repository { name }
                }
                diff {
                  fileDiffs {
                    oldPath
                    newPath
                    hunks {
                      body
                      oldRange { start, lines }
                      newRange { start, lines }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
        // Headers for Sourcegraph API
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        if (!effectiveUrl || !effectiveToken) {
            throw new Error('Sourcegraph URL or token not configured');
        }
        const headers = {
            'Authorization': `token ${effectiveToken}`,
            'Content-Type': 'application/json'
        };
        console.log(`Making request to ${effectiveUrl}/.api/graphql`);
        // Make the request to Sourcegraph API
        const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: searchQuery } }, { headers });
        if (response.data.errors) {
            return res.status(500).json({
                error: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}`,
                isError: true
            });
        }
        // Format the results
        const results = response.data.data.search.results;
        const matchCount = results.matchCount;
        const items = results.results;
        // Create a formatted result
        const formattedItems = items
            .filter((item) => item.__typename === 'CommitSearchResult' && item.diff)
            .map((item) => {
            const commit = item.commit;
            const repo = commit.repository.name;
            const commitInfo = `Commit: ${commit.oid.substring(0, 7)}\nAuthor: ${commit.author.person.name}\nDate: ${commit.author.date}\nMessage: ${commit.message}\n`;
            let diffInfo = '';
            if (item.diff && item.diff.fileDiffs) {
                diffInfo = item.diff.fileDiffs.map((fileDiff) => {
                    const pathInfo = `${fileDiff.oldPath || ''} → ${fileDiff.newPath || ''}`;
                    const hunksInfo = fileDiff.hunks ? fileDiff.hunks.map((hunk) => {
                        return `@@ -${hunk.oldRange.start},${hunk.oldRange.lines} +${hunk.newRange.start},${hunk.newRange.lines} @@\n${hunk.body}`;
                    }).join('\n') : 'No diff hunks available';
                    return `File: ${pathInfo}\n${hunksInfo}`;
                }).join('\n\n');
            }
            return `Repository: ${repo}\n${commitInfo}\nDiff:\n${diffInfo}`;
        })
            .join('\n---\n');
        return res.json({
            content: [{
                    type: "text",
                    text: `Found ${matchCount} diffs matching the criteria\n\n${formattedItems}`
                }]
        });
    }
    catch (error) {
        console.error('Error in search-diffs tool:', error);
        return res.status(500).json({
            error: `Error searching Sourcegraph diffs: ${error.message || 'Unknown error'}`,
            isError: true
        });
    }
});
// List available tools endpoint
app.get("/tools", (req, res) => {
    res.json({
        tools: [
            {
                name: "search-code",
                description: "Search for code across Sourcegraph repositories",
                parameters: {
                    query: "The search query string",
                    type: "Optional search type (file, commit, diff). Default: file"
                }
            },
            {
                name: "search-commits",
                description: "Search for commits in Sourcegraph repositories",
                parameters: {
                    author: "Optional: filter by commit author",
                    message: "Optional: filter by commit message",
                    after: "Optional: filter for commits after a specific date (YYYY-MM-DD)"
                }
            },
            {
                name: "search-diffs",
                description: "Search for code changes (diffs) in Sourcegraph repositories",
                parameters: {
                    query: "Optional: the search query string",
                    author: "Optional: filter by commit author",
                    after: "Optional: filter for diffs after a specific date (YYYY-MM-DD)"
                }
            }
        ]
    });
});
// Start the server
app.listen(port, () => {
    console.log(`Simplified MCP Server listening on port ${port}`);
    console.log(`- Health check: http://localhost:${port}/`);
    console.log(`- Tools listing: http://localhost:${port}/tools`);
});
