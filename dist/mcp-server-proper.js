"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupHttpServer = void 0;
const express_1 = __importDefault(require("express"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Sourcegraph API configuration
const sgUrl = process.env.SOURCEGRAPH_URL;
const sgToken = process.env.SOURCEGRAPH_TOKEN;
// Log configuration for debugging (redact token for security)
console.log(`MCP Server - Sourcegraph URL: ${sgUrl || 'NOT SET'}`);
console.log(`MCP Server - Sourcegraph Token: ${sgToken ? 'SET (redacted)' : 'NOT SET'}`);
// Create an MCP server - properly following the MCP SDK
const server = new mcp_js_1.McpServer({
    name: "Sourcegraph MCP Server",
    version: "1.0.0",
    protocolVersion: "1.0" // Explicitly set protocol version
});
// Add a greeting resource
server.resource("greeting", "greeting://hello", async (uri) => ({
    contents: [{
            uri: uri.href,
            text: `Hello from Sourcegraph MCP Server! Ready to search code repositories.`
        }]
}));
// Add code search tool
server.tool("search-code", {
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
server.tool("search-commits", {
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
server.tool("search-diffs", {
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
// Server implementation for HTTP/SSE
const setupHttpServer = () => {
    const app = (0, express_1.default)();
    const port = 3002; // Use a fixed port for the MCP server
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
    // Session management for multiple connections
    const transports = {};
    // SSE endpoint for client to receive messages
    app.get("/sse", (req, res) => {
        console.log("New MCP SSE connection established");
        // Set required headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        // Create a unique session ID
        const sessionId = Math.random().toString(36).substring(2, 15);
        console.log(`Created session ID: ${sessionId}`);
        // Send initial heartbeat
        res.write(`data: {"type":"connected","sessionId":"${sessionId}"}\n\n`);
        // Create transport after headers are sent
        const transport = new sse_js_1.SSEServerTransport('/messages', res);
        transports[transport.sessionId] = transport;
        // Setup cleanup on connection close
        res.on("close", () => {
            console.log(`MCP SSE connection closed for session ${transport.sessionId}`);
            delete transports[transport.sessionId];
        });
        // Connect to MCP server after response has started
        setTimeout(async () => {
            try {
                await server.connect(transport);
                console.log(`Successfully connected transport for session ${transport.sessionId}`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('Error connecting MCP server to transport:', errorMessage);
                // Only write if response is still writable
                if (!res.writableEnded) {
                    res.write(`data: {"type":"error","message":"${errorMessage}"}\n\n`);
                }
            }
        }, 100); // Small delay to ensure headers are sent first
    });
    // Message endpoint for client to send messages
    app.post("/messages", express_1.default.json(), async (req, res) => {
        // Check for session ID in query params or headers
        const sessionId = (req.query.sessionId || req.headers['x-mcp-session-id']);
        console.log(`Received message for sessionId: ${sessionId}`);
        console.log(`Available transports: ${Object.keys(transports).join(', ')}`);
        const transport = transports[sessionId];
        if (transport) {
            try {
                console.log(`Processing message for session ${sessionId}`);
                await transport.handlePostMessage(req, res);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error handling POST message for session ${sessionId}:`, errorMessage);
                res.status(500).json({ error: `Internal server error: ${errorMessage}` });
            }
        }
        else {
            console.warn(`No transport found for sessionId: ${sessionId}`);
            // More helpful error message with available session IDs
            res.status(400).json({
                error: 'No transport found for sessionId',
                sessionId,
                availableSessions: Object.keys(transports)
            });
        }
    });
    // Health check endpoint
    app.get("/", (req, res) => {
        res.json({
            name: "Sourcegraph MCP Server",
            version: "1.0.0",
            status: "running",
            tools: [
                "search-code",
                "search-commits",
                "search-diffs"
            ]
        });
    });
    // Add an MCP discovery endpoint
    app.get("/mcp", (req, res) => {
        // Check if this is an SSE connection request
        const transportType = req.query.transportType;
        if (transportType === 'sse') {
            console.log("MCP SSE connection requested via /mcp endpoint");
            // Redirect to SSE endpoint by setting up SSE response here
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });
            // Create a unique session ID
            const sessionId = Math.random().toString(36).substring(2, 15);
            console.log(`Created session ID via /mcp: ${sessionId}`);
            // Send initial heartbeat
            res.write(`data: {"type":"connected","sessionId":"${sessionId}"}\n\n`);
            // Create transport after headers are sent
            const transport = new sse_js_1.SSEServerTransport('/messages', res);
            transports[transport.sessionId] = transport;
            // Setup cleanup on connection close
            res.on("close", () => {
                console.log(`MCP SSE connection closed for session ${transport.sessionId}`);
                delete transports[transport.sessionId];
            });
            // Connect to MCP server after response has started
            setTimeout(async () => {
                try {
                    await server.connect(transport);
                    console.log(`Successfully connected transport for session ${transport.sessionId}`);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Error connecting MCP server to transport:', errorMessage);
                    // Only write if response is still writable
                    if (!res.writableEnded) {
                        res.write(`data: {"type":"error","message":"${errorMessage}"}\n\n`);
                    }
                }
            }, 100);
        }
        else {
            // Regular JSON response for API discovery
            res.json({
                name: "Sourcegraph MCP Server",
                description: "MCP server for accessing Sourcegraph search capabilities",
                version: "1.0.0",
                protocolVersion: "1.0",
                transport: "sse",
                sse: {
                    url: "/sse",
                    messageEndpoint: "/messages"
                }
            });
        }
    });
    // Adjusted to match OpenAPI format expected by MCP Inspector
    app.get("/resources", (req, res) => {
        res.json({
            openapi: "3.0.0",
            info: {
                title: "Sourcegraph Search Tools",
                version: "1.0.0",
                description: "MCP tools for searching Sourcegraph repositories"
            },
            paths: {},
            components: {
                schemas: {}
            },
            functions: [
                {
                    name: "search-code",
                    description: "Search for code across Sourcegraph repositories",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "The search query string"
                            },
                            type: {
                                type: "string",
                                enum: ["file", "commit", "diff"],
                                default: "file",
                                description: "Optional search type (file, commit, diff). Default: file"
                            }
                        },
                        required: ["query"]
                    },
                    returns: {
                        type: "object",
                        properties: {
                            content: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: { type: "string" },
                                        text: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    name: "search-commits",
                    description: "Search for commits in Sourcegraph repositories",
                    parameters: {
                        type: "object",
                        properties: {
                            author: {
                                type: "string",
                                description: "Optional: filter by commit author"
                            },
                            message: {
                                type: "string",
                                description: "Optional: filter by commit message"
                            },
                            after: {
                                type: "string",
                                description: "Optional: filter for commits after a specific date (YYYY-MM-DD)"
                            }
                        }
                    },
                    returns: {
                        type: "object",
                        properties: {
                            content: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: { type: "string" },
                                        text: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    name: "search-diffs",
                    description: "Search for code changes (diffs) in Sourcegraph repositories",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Optional: the search query string"
                            },
                            author: {
                                type: "string",
                                description: "Optional: filter by commit author"
                            },
                            after: {
                                type: "string",
                                description: "Optional: filter for diffs after a specific date (YYYY-MM-DD)"
                            }
                        }
                    },
                    returns: {
                        type: "object",
                        properties: {
                            content: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: { type: "string" },
                                        text: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        });
    });
    // Start the server
    app.listen(port, () => {
        console.log(`Sourcegraph MCP Server running at http://localhost:${port}`);
        console.log(`Connect MCP clients to: http://localhost:${port}/sse`);
    });
};
exports.setupHttpServer = setupHttpServer;
