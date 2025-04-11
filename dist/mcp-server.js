"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const natural_language_1 = require("./services/natural-language");
// Load environment variables
dotenv_1.default.config();
// Sourcegraph API configuration
const sgUrl = process.env.SOURCEGRAPH_URL;
const sgToken = process.env.SOURCEGRAPH_TOKEN;
const test_tools_1 = require("./test-tools");
/**
 * Creates and configures the Sourcegraph MCP server
 * with resources, prompts, and tools
 */
function createServer() {
    const toolImplementations = {};
    // Create an MCP server
    const server = new mcp_js_1.McpServer({
        name: "sourcegraph-mcp-server",
        version: "1.0.0",
        debug: false, // Disable debug mode in production to prevent console output breaking JSON
    });
    // Add a static resource
    server.resource("hello", "hello://sourcegraph", async (uri) => ({
        contents: [
            {
                uri: uri.href,
                text: "Hello from Sourcegraph MCP Server! Ready to search code repositories.",
            },
        ],
    }));
    // Add a dynamic resource with parameters
    server.resource("greeting", new mcp_js_1.ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, { name }) => ({
        contents: [
            {
                uri: uri.href,
                text: `Hello, ${name}! Welcome to the Sourcegraph MCP Server.`,
            },
        ],
    }));
    // Add a prompt
    server.prompt("sourcegraph-assistant", "A prompt that introduces Sourcegraph search capabilities", () => ({
        messages: [
            {
                role: "assistant",
                content: {
                    type: "text",
                    text: "I'm a Sourcegraph assistant that can help you search through code repositories. You can ask me to search for code, commits, or diffs.",
                },
            },
        ],
    }));
    // Add an echo tool
    // Just use direct implementation in the tool
    toolImplementations["echo"] = async (args) => {
        return {
            content: [
                {
                    type: "text",
                    text: `Hello ${args.message}`,
                },
            ],
        };
    };
    server.tool("echo", "Echoes back a message with 'Hello' prefix", { message: zod_1.z.string().describe("The message to echo") }, async ({ message }) => ({
        content: [
            {
                type: "text",
                text: `Hello ${message}`,
            },
        ],
    }));
    // Add code search tool
    server.tool("search-code", "Search for code across Sourcegraph repositories", {
        query: zod_1.z.string().describe("Search query text"),
        type: zod_1.z.enum(['file', 'commit', 'diff']).default('file').describe("Type of search: file, commit, or diff")
    }, async ({ query, type }) => {
        // Validate Sourcegraph credentials
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        if (!effectiveUrl || !effectiveToken) {
            return {
                content: [{
                        type: "text",
                        text: "Error: Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
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
            const headers = {
                'Authorization': `token ${effectiveToken}`,
                'Content-Type': 'application/json'
            };
            // Make the request to Sourcegraph API
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: searchQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}`
                        }],
                    isError: true
                };
            }
            // Format the results
            const results = response.data.data.search.results;
            const matchCount = results.matchCount;
            const items = results.results;
            // Create a formatted result
            const formattedItems = items.map((item) => {
                if (item.__typename === 'FileMatch') {
                    const repo = item.repository.name;
                    const filePath = item.file.path;
                    const matches = item.lineMatches.map((match) => `Line ${match.lineNumber}: ${match.preview}`).join('\n');
                    return `Repository: ${repo}\nFile: ${filePath}\n${matches}\n`;
                }
                else if (item.__typename === 'CommitSearchResult') {
                    const commit = item.commit;
                    const repo = commit.repository.name;
                    return `Repository: ${repo}\nCommit: ${commit.oid.substring(0, 7)}\nAuthor: ${commit.author.person.name}\nDate: ${commit.author.date}\nMessage: ${commit.message}`;
                }
                return null;
            }).filter(Boolean).join('\n---\n');
            return {
                content: [{
                        type: "text",
                        text: `Found ${matchCount} matches for "${query}" with type:${type}\n\n${formattedItems}`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error searching Sourcegraph: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add commit search tool
    server.tool("search-commits", "Search for commits in Sourcegraph repositories", {
        author: zod_1.z.string().optional().describe("Filter by commit author"),
        message: zod_1.z.string().optional().describe("Filter by commit message"),
        after: zod_1.z.string().optional().describe("Filter for commits after this date (YYYY-MM-DD)")
    }, async ({ author, message, after }) => {
        // Validate Sourcegraph credentials
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        if (!effectiveUrl || !effectiveToken) {
            return {
                content: [{
                        type: "text",
                        text: "Error: Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
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
            const headers = {
                'Authorization': `token ${effectiveToken}`,
                'Content-Type': 'application/json'
            };
            // Make the request to Sourcegraph API
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: searchQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}`
                        }],
                    isError: true
                };
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
            return {
                content: [{
                        type: "text",
                        text: `Found ${matchCount} commits matching the criteria\n\n${formattedItems}`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error searching Sourcegraph commits: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add diff search tool
    server.tool("search-diffs", "Search for code changes (diffs) in Sourcegraph repositories", {
        query: zod_1.z.string().optional().describe("Search query text"),
        author: zod_1.z.string().optional().describe("Filter by commit author"),
        after: zod_1.z.string().optional().describe("Filter for diffs after this date (YYYY-MM-DD)")
    }, async ({ query, author, after }) => {
        // Validate Sourcegraph credentials
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        if (!effectiveUrl || !effectiveToken) {
            return {
                content: [{
                        type: "text",
                        text: "Error: Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
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
            const headers = {
                'Authorization': `token ${effectiveToken}`,
                'Content-Type': 'application/json'
            };
            // Make the request to Sourcegraph API
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: searchQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}`
                        }],
                    isError: true
                };
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
            return {
                content: [{
                        type: "text",
                        text: `Found ${matchCount} diffs matching the criteria\n\n${formattedItems}`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error searching Sourcegraph diffs: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add a tool to search specifically in GitHub repositories
    server.tool("search-github-repos", "Search for code in specific GitHub repositories", {
        query: zod_1.z.string().describe("Search query text"),
        repos: zod_1.z.string().describe("Comma-separated list of GitHub repositories to search in (e.g., 'owner/repo1,owner/repo2')"),
        type: zod_1.z.enum(['file', 'commit', 'diff']).default('file').describe("Type of search: file, commit, or diff")
    }, async ({ query, repos, type }) => {
        // Validate Sourcegraph credentials
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        if (!effectiveUrl || !effectiveToken) {
            return {
                content: [{
                        type: "text",
                        text: "Error: Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
        }
        try {
            // Parse the repo list
            const repoList = repos.split(',').map(r => r.trim());
            // Build the search query with repo filters
            const repoFilters = repoList.map(repo => `repo:^github\\.com/${repo}$`).join(' ');
            const searchQuery = `${query} ${repoFilters} type:${type} count:20`;
            // The GraphQL query
            const graphqlQuery = `
          query GitHubRepoSearch($query: String!) {
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
            const headers = {
                'Authorization': `token ${effectiveToken}`,
                'Content-Type': 'application/json'
            };
            // Make the request to Sourcegraph API
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: searchQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}`
                        }],
                    isError: true
                };
            }
            // Format the results
            const results = response.data.data.search.results;
            const matchCount = results.matchCount;
            const items = results.results;
            // Create a formatted result
            const formattedItems = items.map((item) => {
                if (item.__typename === 'FileMatch') {
                    const repo = item.repository.name;
                    const filePath = item.file.path;
                    const matches = item.lineMatches.map((match) => `Line ${match.lineNumber}: ${match.preview}`).join('\n');
                    return `Repository: ${repo}\nFile: ${filePath}\n${matches}\n`;
                }
                else if (item.__typename === 'CommitSearchResult') {
                    const commit = item.commit;
                    const repo = commit.repository.name;
                    return `Repository: ${repo}\nCommit: ${commit.oid.substring(0, 7)}\nAuthor: ${commit.author.person.name}\nDate: ${commit.author.date}\nMessage: ${commit.message}`;
                }
                return null;
            }).filter(Boolean).join('\n---\n');
            return {
                content: [{
                        type: "text",
                        text: `Found ${matchCount} matches for "${query}" in specific GitHub repos with type:${type}\n\n${formattedItems}`
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error searching GitHub repositories: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add a natural language search tool
    server.tool("natural-search", "Search code repositories using natural language queries", {
        query: zod_1.z.string().describe("Natural language query describing what you want to search for"),
        max_results: zod_1.z.number().optional().describe("Maximum number of results to return (default: 20)")
    }, async ({ query, max_results }) => {
        // Validate Sourcegraph credentials
        const effectiveUrl = sgUrl || process.env.SOURCEGRAPH_URL;
        const effectiveToken = sgToken || process.env.SOURCEGRAPH_TOKEN;
        if (!effectiveUrl || !effectiveToken) {
            return {
                content: [{
                        type: "text",
                        text: "Error: Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
        }
        const result = await (0, natural_language_1.naturalLanguageSearch)(query, {
            url: effectiveUrl,
            token: effectiveToken
        });
        return result;
    });
    // Add a debug tool to list available tools and methods
    server.tool("debug", "Lists all available tools and methods", {}, async () => ({
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    tools: [
                        "echo",
                        "search-code",
                        "search-commits",
                        "search-diffs",
                        "search-github-repos",
                        "natural-search",
                        "test-nl-search",
                        "test-connection",
                        "nl-search-help",
                        "debug"
                    ],
                    resources: [
                        "hello://sourcegraph",
                        "greeting://{name}"
                    ],
                    prompts: [
                        "sourcegraph-assistant"
                    ],
                    methods: ["tools/invoke", "mcp/capabilities", "debug/info"]
                }, null, 2),
            },
        ],
    }));
    // Add invoke method to the server for direct tool invocation
    server.invoke = async (toolName, params) => {
        if (toolName in toolImplementations) {
            return await toolImplementations[toolName](params);
        }
        throw new Error(`Tool '${toolName}' not found`);
    };
    // Add test tools for easier debugging and validation
    (0, test_tools_1.addTestTools)(server);
    return server;
}
exports.createServer = createServer;
