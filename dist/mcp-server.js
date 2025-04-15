"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const natural_language_1 = require("./services/natural-language");
const formatter_1 = require("./utils/formatter");
const sourcegraph_1 = require("./services/sourcegraph");
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
    server.tool("echo", "Simple echo tool for testing that returns your message with 'Hello' prefix.\n\n    WHEN TO USE THIS TOOL:\n    - When testing if the MCP server is responsive\n    - When verifying tool invocation is working correctly\n    - For basic connectivity tests\n    - When learning how to use the MCP server\n\n    PARAMETER USAGE:\n    - message: Any text string you want echoed back\n\n    EXAMPLES:\n    - message = 'world' returns 'Hello world'\n    - message = 'testing' returns 'Hello testing'\n    \n    This is primarily a diagnostic tool to verify the system is working properly.", { message: zod_1.z.string().describe("The message to echo") }, async ({ message }) => ({
        content: [
            {
                type: "text",
                text: `Hello ${message}`,
            },
        ],
    }));
    // Add code search tool - now using direct Sourcegraph API access
    server.tool("search-code", `Searches code across repositories using Sourcegraph's API. 
   
    Query parameters and syntax examples:
    
    - File search (default):
      - Basic search: functionName - Search for the term across repositories
      - Repository filter: repo:^github\\.com/owner/repo$ - Limit search to specific repositories
      - File filter: file:\\.js$ - Search only in files with specific patterns
      - Language filter: lang:javascript - Search only in specific language files
      - Combined filters: repo:^github\\.com/org/repo$ file:\\.js$ functionName
      - Content search: content:"exact phrase" - Search for exact text match
      - Boolean operators: term1 AND term2, term1 OR term2, term1 NOT term2
      - Regular expressions: /pattern/ or use patternType:regexp in query
      
    - Commit search:
      - Basic: type:commit searchTerm - Search in commit metadata
      - Message filter: type:commit message:"fix bug" - Search in commit messages
      - Author filter: type:commit author:username - Filter by commit author
      - Time filters: type:commit after:"2 weeks ago" or before:"2023-01-01"
      - Repository branch: repo:owner/repo@branch type:commit term - Search in specific branch
      - Example: type:commit message:"security fix" author:john after:"1 month ago"
 
    - Diff search:
      - Basic: type:diff searchTerm - Search in code changes
      - Added/removed code: type:diff select:commit.diff.added term - Only in added code
      - Repository filter: repo:owner/repo type:diff term - Limit to specific repositories
      - Time range: type:diff after:"1 week ago" term - Recent changes only
      - Example: type:diff select:commit.diff.removed securityCheck
      
    Notes:
    - The function automatically adds the appropriate type: parameter if not included in the query.
    - Results are limited to 20 by default. Use count:N in your query to adjust this limit.
    - For regex searches, use /pattern/ syntax or add patternType:regexp to your query.
    - All searches use keyword pattern matching by default (case-insensitive).`, {
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
            // No natural language processing - use direct query syntax
            // Just add the type and count parameters if not present
            let finalQuery = query.includes('type:') ? query : `${query} type:${type}`;
            finalQuery = finalQuery.includes('count:') ? finalQuery : `${finalQuery} count:20`;
            // Select appropriate GraphQL query based on search type
            let graphqlQuery;
            switch (type) {
                case 'commit':
                    graphqlQuery = (0, sourcegraph_1.getCommitSearchQuery)();
                    break;
                case 'diff':
                    graphqlQuery = (0, sourcegraph_1.getDiffSearchQuery)();
                    break;
                case 'file':
                default:
                    graphqlQuery = (0, sourcegraph_1.getFileSearchQuery)();
                    break;
            }
            // Execute the search using the Sourcegraph service
            const response = await (0, sourcegraph_1.executeSourcegraphSearch)(finalQuery, graphqlQuery, { url: effectiveUrl, token: effectiveToken });
            if (response.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.errors)}`
                        }],
                    isError: true
                };
            }
            // Format the results
            const results = response.data.search.results;
            // Use the formatter for results
            const formattedResults = (0, formatter_1.formatSearchResults)(results, { query: finalQuery, type });
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
                        text: `Error searching Sourcegraph: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add commit search tool - using direct Sourcegraph API
    server.tool("search-commits", "Search for commits in Sourcegraph repositories with flexible filtering options.\n\n    WHEN TO USE THIS TOOL:\n    - When you need to find specific commits across repositories\n    - When searching for code changes by a particular author\n    - When looking for commits within a particular timeframe\n    - When searching for specific commit messages or fixes\n\n    PARAMETER USAGE:\n    - author: The username of the commit author (e.g., 'jane', 'john.doe')\n    - message: Text to search for in commit messages (e.g., 'fix authentication bug')\n    - after: Date filter in YYYY-MM-DD format (e.g., '2023-01-15') or relative time ('2 weeks ago')\n\n    SEARCH EXAMPLES:\n    - Find security fixes: message = 'security fix'\n    - Find recent commits by a specific author: author = 'username', after = '2023-10-01'\n    - Find all commits mentioning a specific feature: message = 'user authentication'\n    \n    Notes:\n    - The tool automatically adds 'type:commit' to your search\n    - Results are limited to 20 by default\n    - Date strings in 'after' can be exact dates or relative like '2 weeks ago'\n    - Commit results include hash, message, author, and date", {
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
            // Build the search query using provided parameters directly
            let finalQuery = 'type:commit';
            if (author)
                finalQuery += ` author:${author}`;
            if (message)
                finalQuery += ` message:${message}`;
            if (after)
                finalQuery += ` after:${after}`;
            finalQuery += ' count:20';
            // Get the commit search GraphQL query
            const graphqlQuery = (0, sourcegraph_1.getCommitSearchQuery)();
            // Execute the search using the Sourcegraph service
            const response = await (0, sourcegraph_1.executeSourcegraphSearch)(finalQuery, graphqlQuery, { url: effectiveUrl, token: effectiveToken });
            if (response.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.errors)}`
                        }],
                    isError: true
                };
            }
            // Format the results
            const results = response.data.search.results;
            const formattedResults = (0, formatter_1.formatSearchResults)(results, { query: finalQuery, type: 'commit' });
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
                        text: `Error searching Sourcegraph commits: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add diff search tool - using direct Sourcegraph API
    server.tool("search-diffs", "Search for code changes (diffs) in Sourcegraph repositories with detailed filtering.\n\n    WHEN TO USE THIS TOOL:\n    - When looking for specific code changes or modifications\n    - When you need to find added or removed code\n    - When tracking changes by specific authors\n    - When investigating changes made during a particular time period\n\n    PARAMETER USAGE:\n    - query: Terms to search for in the changed code (e.g., 'fix memory leak')\n    - author: Filter diffs by the commit author (e.g., 'jane.smith')\n    - after: Filter for changes after a specific date (YYYY-MM-DD or relative time)\n\n    ADVANCED SEARCH TECHNIQUES:\n    - Find added code: query = 'select:commit.diff.added new_function'\n    - Find removed code: query = 'select:commit.diff.removed old_function'\n    - Limit to specific file types: query = 'path:\\.js$ authentication'\n    - Combine author with timeframe: author = 'alex', after = '2 months ago'\n    \n    Notes:\n    - Diffs show hunks of changed code for each modification\n    - Changes include file path, line number ranges, and exact modifications\n    - The tool automatically adds 'type:diff' to your search\n    - Results include commit context (message, author, date) along with the changes", {
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
            // Build the search query with provided parameters directly
            let finalQuery = 'type:diff';
            if (query)
                finalQuery += ` ${query}`;
            if (author)
                finalQuery += ` author:${author}`;
            if (after)
                finalQuery += ` after:${after}`;
            finalQuery += ' count:20';
            // Get the diff search GraphQL query
            const graphqlQuery = (0, sourcegraph_1.getDiffSearchQuery)();
            // Execute the search using the Sourcegraph service
            const response = await (0, sourcegraph_1.executeSourcegraphSearch)(finalQuery, graphqlQuery, { url: effectiveUrl, token: effectiveToken });
            if (response.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.errors)}`
                        }],
                    isError: true
                };
            }
            // Format the results
            const results = response.data.search.results;
            const formattedResults = (0, formatter_1.formatSearchResults)(results, { query: finalQuery, type: 'diff' });
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
                        text: `Error searching Sourcegraph diffs: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add a tool to search specifically in GitHub repositories - using direct Sourcegraph API
    server.tool("search-github-repos", "Search for code, commits, or diffs specifically in GitHub repositories.\n\n    WHEN TO USE THIS TOOL:\n    - When you need to search within specific known GitHub repositories\n    - When searching across multiple GitHub repos simultaneously\n    - When you need targeted searches in open source projects\n    - When you want to limit searches to verified repositories\n\n    PARAMETER USAGE:\n    - query: What to search for (e.g., 'render function', 'authentication middleware')\n    - repos: Comma-separated list of GitHub repositories in 'owner/repo' format\n    - type: The type of search to perform ('file', 'commit', or 'diff')\n\n    REPOSITORY SPECIFICATION:\n    - Single repository: 'microsoft/typescript'\n    - Multiple repositories: 'facebook/react,angular/angular,vuejs/vue'\n    - Organization-wide: Use multiple specific repos instead of wildcards\n    \n    EXAMPLES:\n    - Find authentication code in React: query='authentication', repos='facebook/react'\n    - Find GraphQL usage across popular frameworks: query='graphql', repos='apollographql/apollo-client,graphql/graphql-js'\n    - Find recent security fixes: query='security fix', repos='kubernetes/kubernetes', type='commit'\n    \n    Notes:\n    - Format repositories exactly as they appear on GitHub (owner/repo)\n    - Searches within specified repos only, not forks or related projects\n    - Can be combined with any syntax from search-code, search-commits, and search-diffs", {
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
            // Build the final search query directly - no NL processing
            const finalQuery = `${query} ${repoFilters} type:${type} count:20`;
            // Select appropriate GraphQL query based on search type
            let graphqlQuery;
            switch (type) {
                case 'commit':
                    graphqlQuery = (0, sourcegraph_1.getCommitSearchQuery)();
                    break;
                case 'diff':
                    graphqlQuery = (0, sourcegraph_1.getDiffSearchQuery)();
                    break;
                case 'file':
                default:
                    graphqlQuery = (0, sourcegraph_1.getFileSearchQuery)();
                    break;
            }
            // Execute the search using the Sourcegraph service
            const response = await (0, sourcegraph_1.executeSourcegraphSearch)(finalQuery, graphqlQuery, { url: effectiveUrl, token: effectiveToken });
            if (response.errors) {
                return {
                    content: [{
                            type: "text",
                            text: `Sourcegraph API Error: ${JSON.stringify(response.errors)}`
                        }],
                    isError: true
                };
            }
            // Format the results
            const results = response.data.search.results;
            const formattedResults = (0, formatter_1.formatSearchResults)(results, { query: finalQuery, type });
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
                        text: `Error searching GitHub repositories: ${error.message || 'Unknown error'}`
                    }],
                isError: true
            };
        }
    });
    // Add a natural language search tool
    server.tool("natural-search", "Search code repositories using natural language queries instead of precise syntax.\n\n    WHEN TO USE THIS TOOL:\n    - When you want to search using plain English instead of specific query syntax\n    - When you're unsure of the exact Sourcegraph search syntax\n    - When you want to describe what you're looking for conceptually\n    - When you want automatic detection of search type (code, commits, diffs)\n\n    PARAMETER USAGE:\n    - query: Your search request in natural language (e.g., 'Find authentication code in React components')\n    - max_results: Optional limit on the number of results (default: 20)\n\n    NATURAL LANGUAGE EXAMPLES:\n    - 'Find all implementations of authentication in the frontend code'\n    - 'Show me commits by Sarah from last month related to the login system'\n    - 'Look for recent changes to the API error handling'\n    - 'Find code that handles file uploads in Python repositories'\n    \n    SUPPORTED CONCEPTS (AUTOMATICALLY DETECTED):\n    - Code patterns: 'Find code that validates user input'\n    - Specific authors: 'Show commits by John'\n    - Time periods: 'Find changes from last week'\n    - Repositories: 'Search in the React codebase'\n    - Languages: 'Find JavaScript code for authentication'\n    \n    Notes:\n    - This tool uses AI to convert your query into Sourcegraph syntax\n    - It automatically detects if you're looking for code, commits, or diffs\n    - You can freely mix concepts in a single query\n    - Results are formatted for readability with context", {
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
    server.tool("debug", "Lists all available tools and methods in the MCP server. Use this to discover capabilities.\n\n    WHEN TO USE THIS TOOL:\n    - When you need to see what tools are available in the server\n    - When you want to check which methods are supported\n    - When debugging or exploring the MCP server capabilities\n    - When you're unsure what functionality is available\n\n    The output includes:\n    - All registered tools with their names\n    - Available resources like URLs\n    - Registered prompts\n    - Supported MCP methods\n    \n    No parameters are required. Simply call the tool to get a complete listing.", {}, async () => {
        const toolsList = [
            "echo",
            "search-code",
            "search-commits",
            "search-diffs",
            "search-github-repos",
            "natural-search",
            "test-nl-search",
            "test-connection",
            "nl-search-help",
            "debug",
            "deep-code-researcher"
        ];
        const resourcesList = [
            "hello://sourcegraph",
            "greeting://{name}"
        ];
        const promptsList = [
            "sourcegraph-assistant"
        ];
        const methodsList = ["tools/invoke", "mcp/capabilities", "debug/info"];
        const info = {
            tools: toolsList,
            resources: resourcesList,
            prompts: promptsList,
            methods: methodsList
        };
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(info, null, 2)
                }]
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
    // Deep code researcher tool for advanced code analysis
    server.tool("deep-code-researcher", "Conduct deep research on code patterns and architecture across repositories with advanced analysis capabilities.\n\n" +
        "WHEN TO USE THIS TOOL:\n" +
        "- When you need comprehensive understanding of complex codebases\n" +
        "- When searching for patterns across multiple repositories\n" +
        "- When analyzing code architecture and dependencies\n" +
        "- When you need to understand implementation patterns for specific functionality", {
        query: zod_1.z.string().describe("The research query or code pattern to analyze")
    }, async ({ query }) => {
        // Placeholder for implementation
        return {
            content: [{
                    type: "text",
                    text: `Research query '${query}' processed. Implementation pending.`
                }]
        };
    });
    return server;
}
exports.createServer = createServer;
