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
const enhanced_formatter_1 = require("./utils/enhanced-formatter");
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
                    text: `**Hello** ${args.message}`,
                },
            ],
        };
    };
    server.tool("echo", "Echoes back a message with 'Hello' prefix", { message: zod_1.z.string().describe("The message to echo") }, async ({ message }) => ({
        content: [
            {
                type: "text",
                text: `**Hello** ${message}`,
            },
        ],
    }));
    // Add code search tool - now with natural language processing support
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
                        text: "## Configuration Error\n\nSourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
        }
        try {
            // Check if the query seems to be natural language
            // If it contains common phrases like "find" or doesn't have specific operators
            const looksLikeNaturalLanguage = /^(find|show|get|search for|look for|what|where|how|when)/i.test(query) ||
                !/(repo:|type:|lang:|after:|content:|file:|case:|patterntype:)/i.test(query);
            let finalQuery;
            if (looksLikeNaturalLanguage) {
                // Process through natural language query analyzer
                try {
                    // Use the enhanced analyzeQuery function to get a more precise query
                    const analyzed = await (0, enhanced_formatter_1.analyzeQueryEnhanced)(query);
                    // Use the suggested type if provided in parameters
                    const finalType = type || analyzed.type;
                    finalQuery = `${analyzed.query} type:${finalType} count:20`;
                }
                catch (nlError) {
                    console.error('Natural language processing failed, using original query:', nlError);
                    finalQuery = `${query} type:${type} count:20`;
                }
            }
            else {
                // Direct Sourcegraph syntax - just add type if not already present
                finalQuery = query.includes('type:') ? query : `${query} type:${type}`;
                // Add count if not present
                finalQuery = finalQuery.includes('count:') ? finalQuery : `${finalQuery} count:20`;
            }
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
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: finalQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `## API Error\n\n\`\`\`json\n${JSON.stringify(response.data.errors, null, 2)}\n\`\`\``
                        }],
                    isError: true
                };
            }
            // Format the results
            const results = response.data.data.search.results;
            // Use the enhanced formatter for results with better human-readable output
            const formattedResults = (0, enhanced_formatter_1.formatSearchResultsEnhanced)(results, { query: finalQuery, type });
            return {
                content: [{
                        type: "text",
                        text: formattedResults
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `## Error\n\nError searching Sourcegraph: ${error.message || 'Unknown error'}`
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
                        text: "## Configuration Error\n\nSourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
        }
        try {
            // Check if the message parameter might be a natural language query
            let finalQuery;
            let nlQuery = message;
            // Only attempt NL processing if message looks like natural language
            if (nlQuery && /^(find|show|get|search for|look for|what|where|how|when)/i.test(nlQuery)) {
                try {
                    // Use the enhanced analyzeQuery function to get a more precise query
                    const analyzed = await (0, enhanced_formatter_1.analyzeQueryEnhanced)(nlQuery);
                    // Build the final query using the analyzed components and any explicit parameters
                    finalQuery = 'type:commit';
                    // Add search terms from analysis
                    if (analyzed.query)
                        finalQuery += ` ${analyzed.query}`;
                    // Use explicitly provided parameters if available, otherwise use analyzed ones
                    const finalAuthor = author || analyzed.author;
                    const finalAfter = after || analyzed.after;
                    if (finalAuthor)
                        finalQuery += ` author:${finalAuthor}`;
                    if (finalAfter)
                        finalQuery += ` after:${finalAfter}`;
                    finalQuery += ' count:20';
                }
                catch (nlError) {
                    console.error('Natural language processing failed, using original parameters:', nlError);
                    // Fall back to standard query building
                    finalQuery = 'type:commit';
                    if (author)
                        finalQuery += ` author:${author}`;
                    if (message)
                        finalQuery += ` message:${message}`;
                    if (after)
                        finalQuery += ` after:${after}`;
                    finalQuery += ' count:20';
                }
            }
            else {
                // Build the search query using provided parameters directly
                finalQuery = 'type:commit';
                if (author)
                    finalQuery += ` author:${author}`;
                if (message)
                    finalQuery += ` message:${message}`;
                if (after)
                    finalQuery += ` after:${after}`;
                finalQuery += ' count:20';
            }
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
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: finalQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `## API Error\n\n\`\`\`json\n${JSON.stringify(response.data.errors, null, 2)}\n\`\`\``
                        }],
                    isError: true
                };
            }
            // Format the results using the enhanced formatter with markdown and highlighting
            const results = response.data.data.search.results;
            const formattedResults = (0, enhanced_formatter_1.formatSearchResultsEnhanced)(results, { query: finalQuery, type: 'commit' });
            return {
                content: [{
                        type: "text",
                        text: formattedResults
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `## Error\n\nError searching Sourcegraph commits: ${error.message || 'Unknown error'}`
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
                        text: "## Configuration Error\n\nSourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
        }
        try {
            // Check if the query looks like natural language
            let finalQuery;
            if (query && /^(find|show|get|search for|look for|what|where|how|when)/i.test(query)) {
                // Process through natural language query analyzer
                try {
                    // Use the enhanced analyzeQuery function to get a more precise query
                    const analyzed = await (0, enhanced_formatter_1.analyzeQueryEnhanced)(query);
                    finalQuery = analyzed.query;
                    // Use explicitly provided parameters if available
                    const finalAuthor = author || analyzed.author;
                    const finalAfter = after || analyzed.after;
                    finalQuery = `type:diff ${finalQuery}`;
                    if (finalAuthor)
                        finalQuery += ` author:${finalAuthor}`;
                    if (finalAfter)
                        finalQuery += ` after:${finalAfter}`;
                    finalQuery += ' count:20';
                }
                catch (nlError) {
                    console.error('Natural language processing failed, using original query:', nlError);
                    // Fall back to standard query building
                    finalQuery = 'type:diff';
                    if (query)
                        finalQuery += ` ${query}`;
                    if (author)
                        finalQuery += ` author:${author}`;
                    if (after)
                        finalQuery += ` after:${after}`;
                    finalQuery += ' count:20';
                }
            }
            else {
                // Build the search query with provided parameters
                finalQuery = 'type:diff';
                if (query)
                    finalQuery += ` ${query}`;
                if (author)
                    finalQuery += ` author:${author}`;
                if (after)
                    finalQuery += ` after:${after}`;
                finalQuery += ' count:20';
            }
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
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: finalQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `## API Error\n\n\`\`\`json\n${JSON.stringify(response.data.errors, null, 2)}\n\`\`\``
                        }],
                    isError: true
                };
            }
            // Format the results using the enhanced formatter with markdown and syntax highlighting
            const results = response.data.data.search.results;
            const formattedResults = (0, enhanced_formatter_1.formatSearchResultsEnhanced)(results, { query: finalQuery, type: 'diff' });
            return {
                content: [{
                        type: "text",
                        text: formattedResults
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `## Error\n\nError searching Sourcegraph diffs: ${error.message || 'Unknown error'}`
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
                        text: "## Configuration Error\n\nSourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
                    }],
                isError: true
            };
        }
        try {
            // Parse the repo list
            const repoList = repos.split(',').map(r => r.trim());
            // Build the search query with repo filters
            const repoFilters = repoList.map(repo => `repo:^github\\.com/${repo}$`).join(' ');
            // Check if the query is natural language
            let searchTerms = query;
            const isNaturalLanguage = /^(find|show|get|search for|look for|what|where|how|when)/i.test(query);
            if (isNaturalLanguage) {
                try {
                    // Process through natural language query analyzer
                    const analyzed = await (0, enhanced_formatter_1.analyzeQueryEnhanced)(query);
                    searchTerms = analyzed.query;
                }
                catch (nlError) {
                    console.error('Natural language processing failed, using original query:', nlError);
                }
            }
            // Build the final search query
            const finalQuery = `${searchTerms} ${repoFilters} type:${type} count:20`;
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
            const response = await axios_1.default.post(`${effectiveUrl}/.api/graphql`, { query: graphqlQuery, variables: { query: finalQuery } }, { headers });
            if (response.data.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `## API Error\n\n\`\`\`json\n${JSON.stringify(response.data.errors, null, 2)}\n\`\`\``
                        }],
                    isError: true
                };
            }
            // Format the results using the enhanced formatter with better human-readable display
            const results = response.data.data.search.results;
            const formattedResults = (0, enhanced_formatter_1.formatSearchResultsEnhanced)(results, { query: finalQuery, type });
            return {
                content: [{
                        type: "text",
                        text: formattedResults
                    }]
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `## Error\n\nError searching GitHub repositories: ${error.message || 'Unknown error'}`
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
                        text: "## Configuration Error\n\nSourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables."
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
    server.tool("debug", "Lists all available tools and methods", {}, async () => {
        // Create a more human-readable markdown-formatted response
        const toolsInfo = {
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
        };
        // Format as markdown with sections and lists
        let markdownOutput = `## Sourcegraph MCP Server Capabilities

### Available Tools

`;
        toolsInfo.tools.forEach(tool => {
            markdownOutput += `* \`${tool}\`\n`;
        });
        markdownOutput += `\n### Available Resources\n\n`;
        toolsInfo.resources.forEach(resource => {
            markdownOutput += `* \`${resource}\`\n`;
        });
        markdownOutput += `\n### Available Prompts\n\n`;
        toolsInfo.prompts.forEach(prompt => {
            markdownOutput += `* \`${prompt}\`\n`;
        });
        markdownOutput += `\n### Supported Methods\n\n`;
        toolsInfo.methods.forEach(method => {
            markdownOutput += `* \`${method}\`\n`;
        });
        markdownOutput += `\n\nAll tools now return results in enhanced human-readable format with markdown and syntax highlighting.`;
        return {
            content: [
                {
                    type: "text",
                    text: markdownOutput
                },
            ],
        };
    });
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
