import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import dotenv from 'dotenv';
import axios from 'axios';
// import { naturalLanguageSearch } from './services/natural-language';
import { analyzeQuery, formatSearchResults } from './utils/formatter';
import { executeSourcegraphSearch, getFileSearchQuery, getCommitSearchQuery, getDiffSearchQuery } from './services/sourcegraph';
import { executeSourcegraphQuery, getDefinitionQuery, getReferencesQuery, getImplementationsQuery, getHoverQuery, getDocumentSymbolsQuery, formatDefinitionResults, formatReferencesResults, formatImplementationsResults } from './services/code-intelligence';
import { getFileContentQuery, getFileBlameQuery, formatFileContentResults, formatFileBlameResults } from './services/repository-content';
import { getCVELookupQuery, getPackageVulnerabilityQuery, formatCVELookupResults, formatPackageVulnerabilityResults, buildExploitSearchQuery, buildVendorAdvisorySearchQuery } from './services/security';

// Load environment variables
dotenv.config();

// Sourcegraph API configuration
const sgUrl = process.env.SOURCEGRAPH_URL;
const sgToken = process.env.SOURCEGRAPH_TOKEN;

import { addTestTools } from './test-tools';

/**
 * Creates and configures the Sourcegraph MCP server
 * with resources, prompts, and tools
 */
export function createServer() {
  const toolImplementations: Record<string, Function> = {};
  // Create an MCP server
  const server = new McpServer({
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
  server.resource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    async (uri, { name }) => ({
      contents: [
        {
          uri: uri.href,
          text: `Hello, ${name}! Welcome to the Sourcegraph MCP Server.`,
        },
      ],
    })
  );

  // Add a prompt
  server.prompt(
    "sourcegraph-assistant",
    "A prompt that introduces Sourcegraph search capabilities",
    () => ({
      messages: [
        {
          role: "assistant", 
          content: {
            type: "text",
            text: "I'm a Sourcegraph assistant that can help you search through code repositories. You can ask me to search for code, commits, or diffs.",
          },
        },
      ],
    })
  );

  // Add an echo tool
  // Just use direct implementation in the tool
  toolImplementations["echo"] = async (args: { message: string }) => {
    return {
      content: [
        {
          type: "text",
          text: `Hello ${args.message}`,
        },
      ],
    };
  };
  server.tool(
    "echo",
    "Simple echo tool for testing that returns your message with 'Hello' prefix.\n\n    WHEN TO USE THIS TOOL:\n    - When testing if the MCP server is responsive\n    - When verifying tool invocation is working correctly\n    - For basic connectivity tests\n    - When learning how to use the MCP server\n\n    PARAMETER USAGE:\n    - message: Any text string you want echoed back\n\n    EXAMPLES:\n    - message = 'world' returns 'Hello world'\n    - message = 'testing' returns 'Hello testing'\n    \n    This is primarily a diagnostic tool to verify the system is working properly.",
    { message: z.string().describe("The message to echo") },
    async ({ message }) => ({
      content: [
        {
          type: "text",
          text: `Hello ${message}`,
        },
      ],
    })
  );

  

  // Add code search tool - now using direct Sourcegraph API access
  server.tool(
    "search-code",
    `Searches code across repositories using Sourcegraph's API. 
   
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
    - All searches use keyword pattern matching by default (case-insensitive).`,
    { 
      query: z.string().describe("Search query text"), 
      type: z.enum(['file', 'commit', 'diff']).default('file').describe("Type of search: file, commit, or diff")
    },
    async ({ query, type }) => {
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
        switch(type) {
          case 'commit':
            graphqlQuery = getCommitSearchQuery();
            break;
          case 'diff':
            graphqlQuery = getDiffSearchQuery();
            break;
          case 'file':
          default:
            graphqlQuery = getFileSearchQuery();
            break;
        }
        
        // Execute the search using the Sourcegraph service
        const response = await executeSourcegraphSearch(
          finalQuery,
          graphqlQuery,
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatSearchResults(results, { query: finalQuery, type });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error searching Sourcegraph: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add commit search tool - using direct Sourcegraph API
  server.tool(
    "search-commits",
    "Search for commits in Sourcegraph repositories with flexible filtering options.\n\n    WHEN TO USE THIS TOOL:\n    - When you need to find specific commits across repositories\n    - When searching for code changes by a particular author\n    - When looking for commits within a particular timeframe\n    - When searching for specific commit messages or fixes\n\n    PARAMETER USAGE:\n    - author: The username of the commit author (e.g., 'jane', 'john.doe')\n    - message: Text to search for in commit messages (e.g., 'fix authentication bug')\n    - after: Date filter in YYYY-MM-DD format (e.g., '2023-01-15') or relative time ('2 weeks ago')\n\n    SEARCH EXAMPLES:\n    - Find security fixes: message = 'security fix'\n    - Find recent commits by a specific author: author = 'username', after = '2023-10-01'\n    - Find all commits mentioning a specific feature: message = 'user authentication'\n    \n    Notes:\n    - The tool automatically adds 'type:commit' to your search\n    - Results are limited to 20 by default\n    - Date strings in 'after' can be exact dates or relative like '2 weeks ago'\n    - Commit results include hash, message, author, and date",
    { 
      author: z.string().optional().describe("Filter by commit author"),
      message: z.string().optional().describe("Filter by commit message"),
      after: z.string().optional().describe("Filter for commits after this date (YYYY-MM-DD)")
    },
    async ({ author, message, after }) => {
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
        if (author) finalQuery += ` author:${author}`;
        if (message) finalQuery += ` message:${message}`;
        if (after) finalQuery += ` after:${after}`;
        finalQuery += ' count:20';
        
        // Get the commit search GraphQL query
        const graphqlQuery = getCommitSearchQuery();
        
        // Execute the search using the Sourcegraph service
        const response = await executeSourcegraphSearch(
          finalQuery,
          graphqlQuery,
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatSearchResults(results, { query: finalQuery, type: 'commit' });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error searching Sourcegraph commits: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add diff search tool - using direct Sourcegraph API
  server.tool(
    "search-diffs",
    "Search for code changes (diffs) in Sourcegraph repositories with detailed filtering.\n\n    WHEN TO USE THIS TOOL:\n    - When looking for specific code changes or modifications\n    - When you need to find added or removed code\n    - When tracking changes by specific authors\n    - When investigating changes made during a particular time period\n\n    PARAMETER USAGE:\n    - query: Terms to search for in the changed code (e.g., 'fix memory leak')\n    - author: Filter diffs by the commit author (e.g., 'jane.smith')\n    - after: Filter for changes after a specific date (YYYY-MM-DD or relative time)\n\n    ADVANCED SEARCH TECHNIQUES:\n    - Find added code: query = 'select:commit.diff.added new_function'\n    - Find removed code: query = 'select:commit.diff.removed old_function'\n    - Limit to specific file types: query = 'path:\\.js$ authentication'\n    - Combine author with timeframe: author = 'alex', after = '2 months ago'\n    \n    Notes:\n    - Diffs show hunks of changed code for each modification\n    - Changes include file path, line number ranges, and exact modifications\n    - The tool automatically adds 'type:diff' to your search\n    - Results include commit context (message, author, date) along with the changes",
    { 
      query: z.string().optional().describe("Search query text"),
      author: z.string().optional().describe("Filter by commit author"),
      after: z.string().optional().describe("Filter for diffs after this date (YYYY-MM-DD)")
    },
    async ({ query, author, after }) => {
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
        if (query) finalQuery += ` ${query}`;
        if (author) finalQuery += ` author:${author}`;
        if (after) finalQuery += ` after:${after}`;
        finalQuery += ' count:20';
        
        // Get the diff search GraphQL query
        const graphqlQuery = getDiffSearchQuery();
        
        // Execute the search using the Sourcegraph service
        const response = await executeSourcegraphSearch(
          finalQuery,
          graphqlQuery,
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatSearchResults(results, { query: finalQuery, type: 'diff' });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error searching Sourcegraph diffs: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add a tool to search specifically in GitHub repositories - using direct Sourcegraph API
  server.tool(
    "search-github-repos",
    "Search for code, commits, or diffs specifically in GitHub repositories.\n\n    WHEN TO USE THIS TOOL:\n    - When you need to search within specific known GitHub repositories\n    - When searching across multiple GitHub repos simultaneously\n    - When you need targeted searches in open source projects\n    - When you want to limit searches to verified repositories\n\n    PARAMETER USAGE:\n    - query: What to search for (e.g., 'render function', 'authentication middleware')\n    - repos: Comma-separated list of GitHub repositories in 'owner/repo' format\n    - type: The type of search to perform ('file', 'commit', or 'diff')\n\n    REPOSITORY SPECIFICATION:\n    - Single repository: 'microsoft/typescript'\n    - Multiple repositories: 'facebook/react,angular/angular,vuejs/vue'\n    - Organization-wide: Use multiple specific repos instead of wildcards\n    \n    EXAMPLES:\n    - Find authentication code in React: query='authentication', repos='facebook/react'\n    - Find GraphQL usage across popular frameworks: query='graphql', repos='apollographql/apollo-client,graphql/graphql-js'\n    - Find recent security fixes: query='security fix', repos='kubernetes/kubernetes', type='commit'\n    \n    Notes:\n    - Format repositories exactly as they appear on GitHub (owner/repo)\n    - Searches within specified repos only, not forks or related projects\n    - Can be combined with any syntax from search-code, search-commits, and search-diffs",
    { 
      query: z.string().describe("Search query text"),
      repos: z.string().describe("Comma-separated list of GitHub repositories to search in (e.g., 'owner/repo1,owner/repo2')"),
      type: z.enum(['file', 'commit', 'diff']).default('file').describe("Type of search: file, commit, or diff")
    },
    async ({ query, repos, type }) => {
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
        switch(type) {
          case 'commit':
            graphqlQuery = getCommitSearchQuery();
            break;
          case 'diff':
            graphqlQuery = getDiffSearchQuery();
            break;
          case 'file':
          default:
            graphqlQuery = getFileSearchQuery();
            break;
        }
        
        // Execute the search using the Sourcegraph service
        const response = await executeSourcegraphSearch(
          finalQuery,
          graphqlQuery,
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatSearchResults(results, { query: finalQuery, type });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error searching GitHub repositories: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Natural language search tool commented out
  /*
  server.tool(
    "natural-search",
    "Search code repositories using natural language queries instead of precise syntax.\n\n    WHEN TO USE THIS TOOL:\n    - When you want to search using plain English instead of specific query syntax\n    - When you're unsure of the exact Sourcegraph search syntax\n    - When you want to describe what you're looking for conceptually\n    - When you want automatic detection of search type (code, commits, diffs)\n\n    PARAMETER USAGE:\n    - query: Your search request in natural language (e.g., 'Find authentication code in React components')\n    - max_results: Optional limit on the number of results (default: 20)\n\n    NATURAL LANGUAGE EXAMPLES:\n    - 'Find all implementations of authentication in the frontend code'\n    - 'Show me commits by Sarah from last month related to the login system'\n    - 'Look for recent changes to the API error handling'\n    - 'Find code that handles file uploads in Python repositories'\n    \n    SUPPORTED CONCEPTS (AUTOMATICALLY DETECTED):\n    - Code patterns: 'Find code that validates user input'\n    - Specific authors: 'Show commits by John'\n    - Time periods: 'Find changes from last week'\n    - Repositories: 'Search in the React codebase'\n    - Languages: 'Find JavaScript code for authentication'\n    \n    Notes:\n    - This tool uses AI to convert your query into Sourcegraph syntax\n    - It automatically detects if you're looking for code, commits, or diffs\n    - You can freely mix concepts in a single query\n    - Results are formatted for readability with context",
    { 
      query: z.string().describe("Natural language query describing what you want to search for"),
      max_results: z.number().optional().describe("Maximum number of results to return (default: 20)")
    },
    async ({ query, max_results }) => {
      // Implementation commented out
      return {
        content: [{ 
          type: "text", 
          text: "Natural language search is disabled." 
        }]
      };
    }
  );
  */

  // Add get-hover-documentation tool
  server.tool(
    "get-hover-documentation",
    "Get hover documentation and type information for a symbol.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to see the documentation for a specific function, variable, or class\n" +
    "- When you want to check the type information for a variable or expression\n" +
    "- When you need quick information about a symbol without navigating to its definition\n" +
    "- When exploring unfamiliar code to understand how components work\n\n" +
    "PARAMETER USAGE:\n" +
    "- repository: The full repository name (e.g., 'github.com/owner/repo')\n" +
    "- path: The file path where the symbol appears (e.g., 'src/main.js')\n" +
    "- line: The zero-indexed line number where the symbol appears\n" +
    "- character: The zero-indexed character position of the symbol on that line\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Requires LSIF data to be available in Sourcegraph (precise code intelligence)\n" +
    "- For accurate results, the repository must be properly indexed in Sourcegraph\n" +
    "- Line and character positions are zero-indexed (unlike editors which often use 1-indexed)\n\n" +
    "EXAMPLES:\n" +
    "- Get information about a function: { repository: 'github.com/golang/go', path: 'src/net/http/server.go', line: 142, character: 15 }\n" +
    "- Check a variable's type: { repository: 'github.com/microsoft/typescript', path: 'src/compiler/program.ts', line: 124, character: 30 }\n\n" +
    "The results will show the documentation and type information for the symbol at the specified position.",
    {
      repository: z.string().describe("The repository name (e.g. github.com/owner/repo)"),
      path: z.string().describe("The file path within the repository"),
      line: z.number().describe("Zero-indexed line number of the symbol"),
      character: z.number().describe("Zero-indexed character position of the symbol")
    },
    async ({ repository, path, line, character }) => {
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
        // Get the hover query
        const graphqlQuery = getHoverQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { repository, path, line, character },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const hoverData = response.data?.repository?.commit?.blob?.lsif?.hover;
        
        if (!hoverData) {
          return {
            content: [{ 
              type: "text", 
              text: "No hover documentation found or LSIF data not available for this file." 
            }]
          };
        }
        
        let result = "## Hover Documentation\n\n";
        
        if (hoverData.markdown?.text) {
          result += `${hoverData.markdown.text}\n\n`;
        } else if (hoverData.plainText) {
          result += `\`\`\`\n${hoverData.plainText}\n\`\`\`\n\n`;
        } else {
          result += "No documentation available for this symbol.\n\n";
        }
        
        if (hoverData.range) {
          const startLine = hoverData.range.start.line + 1;
          const startChar = hoverData.range.start.character + 1;
          const endLine = hoverData.range.end.line + 1;
          const endChar = hoverData.range.end.character + 1;
          
          result += `**Symbol Range:** Line ${startLine}:${startChar} to ${endLine}:${endChar}\n`;
        }
        
        return {
          content: [{ 
            type: "text", 
            text: result
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error getting hover documentation: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add get-document-symbols tool
  server.tool(
    "get-document-symbols",
    "Get all symbols (functions, classes, variables, etc.) in a file.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to see a structural overview of a file\n" +
    "- When looking for specific functions or classes in a large file\n" +
    "- When analyzing the organization and hierarchy of code in a file\n" +
    "- When you want to quickly understand the contents of a file without reading all the code\n\n" +
    "PARAMETER USAGE:\n" +
    "- repository: The full repository name (e.g., 'github.com/owner/repo')\n" +
    "- path: The file path to analyze (e.g., 'src/main.js')\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Requires LSIF data to be available in Sourcegraph (precise code intelligence)\n" +
    "- For accurate results, the repository must be properly indexed in Sourcegraph\n" +
    "- Symbol kinds vary by language (e.g., classes, methods, functions, variables)\n" +
    "- Symbols will be organized hierarchically when possible (e.g., methods inside classes)\n\n" +
    "EXAMPLES:\n" +
    "- Get symbols in a JavaScript file: { repository: 'github.com/facebook/react', path: 'packages/react/src/React.js' }\n" +
    "- Analyze a complex TypeScript file: { repository: 'github.com/microsoft/vscode', path: 'src/vs/editor/editor.api.ts' }\n\n" +
    "The results will show all symbols in the file, their types, and their locations, organized hierarchically when possible.",
    {
      repository: z.string().describe("The repository name (e.g. github.com/owner/repo)"),
      path: z.string().describe("The file path within the repository")
    },
    async ({ repository, path }) => {
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
        // Get the document symbols query
        const graphqlQuery = getDocumentSymbolsQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { repository, path },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const symbolsData = response.data?.repository?.commit?.blob?.lsif?.documentSymbols?.symbols;
        
        if (!symbolsData || symbolsData.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: "No symbols found or LSIF data not available for this file." 
            }]
          };
        }
        
        let result = `## Symbols in ${repository}:${path}\n\n`;
        
        // Map for symbol kinds to more readable formats
        const kindMap: Record<string, string> = {
          'File': '📄',
          'Module': '📦',
          'Namespace': '🔠',
          'Package': '📦',
          'Class': '🔶',
          'Method': '🔹',
          'Property': '🔸',
          'Field': '🔸',
          'Constructor': '🏗️',
          'Enum': '🔢',
          'Interface': '🔷',
          'Function': '⚙️',
          'Variable': '📌',
          'Constant': '🔒',
          'String': '🔤',
          'Number': '🔢',
          'Boolean': '✓❌',
          'Array': '📋',
          'Object': '📦',
          'Key': '🔑',
          'Null': '⭕',
          'EnumMember': '🔹',
          'Struct': '🏛️',
          'Event': '⚡',
          'Operator': '➗',
          'TypeParameter': '🆃'
        };
        
        // Recursively format symbols
        const formatSymbols = (symbols: any[], indent = 0): string => {
          let result = '';
          symbols.forEach(symbol => {
            const kind = symbol.kind || 'Unknown';
            const icon = kindMap[kind] || '•';
            const startLine = symbol.location?.range?.start?.line + 1 || '?';
            const indentStr = '  '.repeat(indent);
            
            result += `${indentStr}${icon} **${symbol.name}** (${kind}, line ${startLine})\n`;
            
            if (symbol.children && symbol.children.length > 0) {
              result += formatSymbols(symbol.children, indent + 1);
            }
          });
          return result;
        };
        
        result += formatSymbols(symbolsData);
        
        return {
          content: [{ 
            type: "text", 
            text: result
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error getting document symbols: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add a debug tool to list available tools and methods
  // Add get-file-content tool
  server.tool(
    "get-file-content",
    "Get the raw content of a file from any repository.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to retrieve the contents of a specific file\n" +
    "- When analyzing a file's implementation details\n" +
    "- When you want to understand configuration files or scripts\n" +
    "- When you need to see how a specific file is structured\n\n" +
    "PARAMETER USAGE:\n" +
    "- repository: The full repository name (e.g., 'github.com/owner/repo')\n" +
    "- path: The file path within the repository (e.g., 'src/main.js')\n" +
    "- revision: Optional git revision/branch/tag (e.g., 'main', 'v1.0.0', or a commit SHA)\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Binary files will not display their content properly\n" +
    "- Very large files may be truncated\n" +
    "- For privacy and security, access is limited to repositories you have permissions for\n\n" +
    "EXAMPLES:\n" +
    "- Get a specific file: { repository: 'github.com/golang/go', path: 'src/net/http/server.go' }\n" +
    "- Get a file from a specific branch: { repository: 'github.com/facebook/react', path: 'packages/react/src/React.js', revision: 'experimental' }\n\n" +
    "The results will show the file's content with syntax highlighting for the appropriate language.",
    {
      repository: z.string().describe("The repository name (e.g. github.com/owner/repo)"),
      path: z.string().describe("The file path within the repository"),
      revision: z.string().optional().describe("Optional git revision/branch/tag")
    },
    async ({ repository, path, revision }) => {
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
        // Get the file content query
        const graphqlQuery = getFileContentQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { repository, path, revision },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatFileContentResults(response.data, { repository, path, revision });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error getting file content: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add get-file-blame tool
  server.tool(
    "get-file-blame",
    "Get git blame information for a file.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to see who last modified a specific section of a file\n" +
    "- When investigating when and why a particular change was made\n" +
    "- When tracking the history and ownership of code\n" +
    "- When you want to understand how a file evolved over time\n\n" +
    "PARAMETER USAGE:\n" +
    "- repository: The full repository name (e.g., 'github.com/owner/repo')\n" +
    "- path: The file path within the repository (e.g., 'src/main.js')\n" +
    "- startLine: Optional zero-indexed start line for partial file blame (default: 0)\n" +
    "- endLine: Optional zero-indexed end line for partial file blame (default: 100)\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Line numbers are zero-indexed (unlike editors which often use 1-indexed)\n" +
    "- For large files, consider specifying a line range to improve performance\n" +
    "- The maximum recommended line range is 200 lines\n\n" +
    "EXAMPLES:\n" +
    "- Get blame for a specific file section: { repository: 'github.com/golang/go', path: 'src/net/http/server.go', startLine: 100, endLine: 150 }\n" +
    "- Get blame for the beginning of a file: { repository: 'github.com/facebook/react', path: 'packages/react/src/React.js' }\n\n" +
    "The results will show line ranges, authors, dates, and commit messages for each section of the file.",
    {
      repository: z.string().describe("The repository name (e.g. github.com/owner/repo)"),
      path: z.string().describe("The file path within the repository"),
      startLine: z.number().default(0).describe("Optional zero-indexed start line for partial file blame"),
      endLine: z.number().default(100).describe("Optional zero-indexed end line for partial file blame")
    },
    async ({ repository, path, startLine, endLine }) => {
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
        // Get the file blame query
        const graphqlQuery = getFileBlameQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { repository, path, startLine, endLine },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatFileBlameResults(response.data, { repository, path, startLine, endLine });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error getting file blame: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add lookup-cve tool
  server.tool(
    "lookup-cve",
    "Search for CVEs affecting repositories or packages.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to check if a specific CVE affects a repository\n" +
    "- When you want to find vulnerabilities related to a specific package\n" +
    "- When investigating security issues in a codebase\n" +
    "- When performing security audits for packages or repositories\n\n" +
    "PARAMETER USAGE:\n" +
    "- cveId: Optional specific CVE ID to look up (e.g., 'CVE-2023-1234')\n" +
    "- package: Optional package name to check for vulnerabilities (e.g., 'lodash')\n" +
    "- repository: Optional repository name to check for vulnerabilities (e.g., 'github.com/owner/repo')\n\n" +
    "IMPORTANT NOTES:\n" +
    "- At least one parameter must be provided (cveId, package, or repository)\n" +
    "- Results include severity levels, affected versions, and remediation guidance when available\n" +
    "- Enterprise features may provide more detailed results\n\n" +
    "EXAMPLES:\n" +
    "- Look up a specific CVE: { cveId: 'CVE-2023-1234' }\n" +
    "- Check vulnerabilities for a package: { package: 'lodash' }\n" +
    "- Check vulnerabilities in a repository: { repository: 'github.com/facebook/react' }\n\n" +
    "The results will show detailed information about matching vulnerabilities including severity, affected versions, and available fixes.",
    {
      cveId: z.string().optional().describe("Optional specific CVE ID to look up"),
      package: z.string().optional().describe("Optional package name to check"),
      repository: z.string().optional().describe("Optional repository name")
    },
    async ({ cveId, package: packageName, repository }) => {
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

      // Require at least one parameter
      if (!cveId && !packageName && !repository) {
        return {
          content: [{ 
            type: "text", 
            text: "Error: At least one parameter (cveId, package, or repository) must be provided." 
          }],
          isError: true
        };
      }

      try {
        // Get the CVE lookup query
        const graphqlQuery = getCVELookupQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { 
            cveId: cveId || null, 
            package: packageName || null, 
            repository: repository || null,
            limit: 50
          },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatCVELookupResults(response.data, { cveId, package: packageName, repository });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error looking up CVE: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add lookup-package-vulnerability tool
  server.tool(
    "lookup-package-vulnerability",
    "Check if specific packages have known vulnerabilities.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to check if a package has known security vulnerabilities\n" +
    "- When you want to audit a specific package version for security issues\n" +
    "- When investigating dependency security before adding to a project\n" +
    "- When checking if a package needs updating for security reasons\n\n" +
    "PARAMETER USAGE:\n" +
    "- package: The package name to check (e.g., 'lodash', 'react', 'django')\n" +
    "- version: Optional specific package version to check (e.g., '4.17.20')\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Without a version, all vulnerabilities for any version will be returned\n" +
    "- Results include severity levels, affected versions, and remediation guidance\n" +
    "- Different ecosystems (npm, PyPI, etc.) are supported\n\n" +
    "EXAMPLES:\n" +
    "- Check all vulnerabilities for a package: { package: 'lodash' }\n" +
    "- Check vulnerabilities for a specific version: { package: 'react', version: '16.8.0' }\n\n" +
    "The results will show detailed information about matching vulnerabilities including severity, affected versions, and available fixes.",
    {
      package: z.string().describe("Package name (e.g., 'lodash')"),
      version: z.string().optional().describe("Optional package version")
    },
    async ({ package: packageName, version }) => {
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
        // Get the package vulnerability query
        const graphqlQuery = getPackageVulnerabilityQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { 
            package: packageName, 
            version: version || null,
            limit: 50
          },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatPackageVulnerabilityResults(response.data, { package: packageName, version });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error looking up package vulnerabilities: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add search-exploits tool
  server.tool(
    "search-exploits",
    "Search for exploit code for known vulnerabilities.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to assess the risk of a CVE by finding available exploits\n" +
    "- When researching how a vulnerability works\n" +
    "- When checking if a vulnerability has public proof-of-concept code\n" +
    "- When investigating security incidents related to specific CVEs\n\n" +
    "PARAMETER USAGE:\n" +
    "- cveId: The CVE ID to search for exploits (e.g., 'CVE-2023-1234')\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Results may include proof-of-concept code, exploits, or security research\n" +
    "- This tool searches across all indexed repositories\n" +
    "- For security research purposes only\n\n" +
    "EXAMPLES:\n" +
    "- Find exploits for a CVE: { cveId: 'CVE-2023-1234' }\n" +
    "- Research a well-known vulnerability: { cveId: 'CVE-2021-44228' } (Log4Shell)\n\n" +
    "The results will show code references that mention or implement exploits for the specified CVE.",
    {
      cveId: z.string().describe("CVE ID to search for exploits")
    },
    async ({ cveId }) => {
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
        // Build the search query for exploits
        const searchQuery = buildExploitSearchQuery(cveId);
        
        // Get the file search GraphQL query
        const graphqlQuery = getFileSearchQuery();
        
        // Execute the search
        const response = await executeSourcegraphSearch(
          searchQuery,
          graphqlQuery,
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatSearchResults(results, { query: searchQuery, type: 'file' });
        
        // Add a header specific to exploits
        const header = `## Exploit Search Results for ${cveId}\n\nSearched for: ${searchQuery}\n\n`;
        
        return {
          content: [{ 
            type: "text", 
            text: header + formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error searching for exploits: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add find-vendor-advisory tool
  server.tool(
    "find-vendor-advisory",
    "Find vendor security advisories.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to find official security advisories from vendors\n" +
    "- When researching how vendors have addressed specific security issues\n" +
    "- When looking for remediation guidance for security vulnerabilities\n" +
    "- When investigating security patches for specific products\n\n" +
    "PARAMETER USAGE:\n" +
    "- vendor: The vendor name (e.g., 'Microsoft', 'Apache', 'Oracle')\n" +
    "- product: The product name (e.g., 'Windows', 'Log4j', 'MySQL')\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Results include security advisories, bulletins, and announcements\n" +
    "- More specific vendor and product names yield better results\n" +
    "- Results are sourced from repositories that may contain security advisories\n\n" +
    "EXAMPLES:\n" +
    "- Find Microsoft Exchange advisories: { vendor: 'Microsoft', product: 'Exchange' }\n" +
    "- Find Apache Log4j advisories: { vendor: 'Apache', product: 'Log4j' }\n\n" +
    "The results will show security advisories, bulletins, and announcements from the specified vendor about the product.",
    {
      vendor: z.string().describe("Vendor name"),
      product: z.string().describe("Product name")
    },
    async ({ vendor, product }) => {
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
        // Build the search query for vendor advisories
        const searchQuery = buildVendorAdvisorySearchQuery(vendor, product);
        
        // Get the file search GraphQL query
        const graphqlQuery = getFileSearchQuery();
        
        // Execute the search
        const response = await executeSourcegraphSearch(
          searchQuery,
          graphqlQuery,
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatSearchResults(results, { query: searchQuery, type: 'file' });
        
        // Add a header specific to vendor advisories
        const header = `## Security Advisories for ${vendor} ${product}\n\nSearched for: ${searchQuery}\n\n`;
        
        return {
          content: [{ 
            type: "text", 
            text: header + formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error finding vendor advisories: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  server.tool(
    "debug",
    "Lists all available tools and methods in the MCP server. Use this to discover capabilities.\n\n    WHEN TO USE THIS TOOL:\n    - When you need to see what tools are available in the server\n    - When you want to check which methods are supported\n    - When debugging or exploring the MCP server capabilities\n    - When you're unsure what functionality is available\n\n    The output includes:\n    - All registered tools with their names\n    - Available resources like URLs\n    - Registered prompts\n    - Supported MCP methods\n    \n    No parameters are required. Simply call the tool to get a complete listing.",
    {},
    async () => {
      const toolsList = [
        "echo", 
        "search-code", 
        "search-commits", 
        "search-diffs",
        "search-github-repos",
        // "natural-search",
        // "test-nl-search",
        "test-connection",
        // "nl-search-help", 
        "debug",
        "deep-code-researcher",
        "get-definition",
        "find-references",
        "find-implementations",
        "get-hover-documentation",
        "get-document-symbols",
        "get-file-content",
        "get-file-blame",
        "lookup-cve",
        "lookup-package-vulnerability",
        "search-exploits",
        "find-vendor-advisory"
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
    }
  );

  // Add invoke method to the server for direct tool invocation
  (server as any).invoke = async (toolName: string, params: any) => {
    if (toolName in toolImplementations) {
      return await toolImplementations[toolName](params);
    }
    throw new Error(`Tool '${toolName}' not found`);
  };

  // Add test tools for easier debugging and validation
  addTestTools(server);

  // Deep code researcher tool for advanced code analysis
  server.tool(
    "deep-code-researcher",
    "Conduct deep research on code patterns and architecture across repositories with advanced analysis capabilities.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need comprehensive understanding of complex codebases\n" +
    "- When searching for patterns across multiple repositories\n" +
    "- When analyzing code architecture and dependencies\n" +
    "- When you need to understand implementation patterns for specific functionality",
    {
      query: z.string().describe("The research query or code pattern to analyze"),
      language: z.string().optional().describe("Optional language filter (e.g., 'javascript', 'go', 'python')"),
      repo: z.string().optional().describe("Optional repository filter (e.g., 'github.com/owner/repo')"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 20)")
    },
    async ({ query, language, repo, limit }) => {
      // Placeholder for implementation
      return {
        content: [{ 
          type: "text", 
          text: `Research query '${query}' processed. Implementation pending.` 
        }]
      };
    }
  );

  // Code Intelligence: get-definition tool
  server.tool(
    "get-definition",
    "Find the definition of a symbol in code.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to find where a function, variable, class, or other symbol is defined\n" +
    "- When you want to understand the origin and implementation of a specific code element\n" +
    "- When navigating unfamiliar code to understand its structure\n" +
    "- When verifying the actual implementation matches documentation\n\n" +
    "PARAMETER USAGE:\n" +
    "- repository: The full repository name (e.g., 'github.com/owner/repo')\n" +
    "- path: The file path where the symbol is being used (e.g., 'src/main.js')\n" +
    "- line: The zero-indexed line number where the symbol appears\n" +
    "- character: The zero-indexed character position of the symbol on that line\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Requires LSIF data to be available in Sourcegraph (precise code intelligence)\n" +
    "- For accurate results, the repository must be properly indexed in Sourcegraph\n" +
    "- Line and character positions are zero-indexed (unlike editors which often use 1-indexed)\n\n" +
    "EXAMPLES:\n" +
    "- Find where a function is defined: { repository: 'github.com/golang/go', path: 'src/net/http/server.go', line: 142, character: 15 }\n" +
    "- Look up a class definition: { repository: 'github.com/typescript-eslint/typescript-eslint', path: 'packages/eslint-plugin/src/rules/indent.ts', line: 24, character: 10 }\n\n" +
    "The results will show the location of the definition, and may include documentation/type information if available.",
    {
      repository: z.string().describe("The repository name (e.g. github.com/owner/repo)"),
      path: z.string().describe("The file path within the repository"),
      line: z.number().describe("Zero-indexed line number of the symbol"),
      character: z.number().describe("Zero-indexed character position of the symbol")
    },
    async ({ repository, path, line, character }) => {
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
        // Get the definition query
        const graphqlQuery = getDefinitionQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { repository, path, line, character },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatDefinitionResults(response.data);
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error finding definition: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Code Intelligence: find-references tool
  server.tool(
    "find-references",
    "Find all references to a symbol across repositories.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to find all places where a function, variable, or class is used\n" +
    "- When analyzing the impact of potential code changes or refactoring\n" +
    "- When understanding dependencies and usage patterns in a codebase\n" +
    "- When tracing execution paths through a complex system\n" +
    "- When determining if a piece of code is still in use before removing it\n\n" +
    "PARAMETER USAGE:\n" +
    "- repository: The full repository name (e.g., 'github.com/owner/repo')\n" +
    "- path: The file path where the symbol is defined or used (e.g., 'src/main.js')\n" +
    "- line: The zero-indexed line number where the symbol appears\n" +
    "- character: The zero-indexed character position of the symbol on that line\n" +
    "- limit: Maximum number of references to return (default: 50)\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Requires LSIF data to be available in Sourcegraph (precise code intelligence)\n" +
    "- For accurate results, the repository must be properly indexed in Sourcegraph\n" +
    "- Cross-repository references require proper indexing of all relevant repositories\n" +
    "- Line and character positions are zero-indexed (unlike editors which often use 1-indexed)\n\n" +
    "EXAMPLES:\n" +
    "- Find references to a function: { repository: 'github.com/golang/go', path: 'src/net/http/server.go', line: 142, character: 15, limit: 100 }\n" +
    "- Analyze usage of a class: { repository: 'github.com/typescript-eslint/typescript-eslint', path: 'packages/eslint-plugin/src/rules/indent.ts', line: 24, character: 10 }\n\n" +
    "The results will show all files and locations where the symbol is referenced, organized by repository and file.",
    {
      repository: z.string().describe("The repository name (e.g. github.com/owner/repo)"),
      path: z.string().describe("The file path within the repository"),
      line: z.number().describe("Zero-indexed line number of the symbol"),
      character: z.number().describe("Zero-indexed character position of the symbol"),
      limit: z.number().default(50).describe("Maximum number of references to return")
    },
    async ({ repository, path, line, character, limit }) => {
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
        // Get the references query
        const graphqlQuery = getReferencesQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { repository, path, line, character, limit },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatReferencesResults(response.data, { repository, path, line, character });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error finding references: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Code Intelligence: find-implementations tool
  server.tool(
    "find-implementations",
    "Find implementations of interfaces, classes, or methods across repositories.\n\n" +
    "WHEN TO USE THIS TOOL:\n" +
    "- When you need to find all concrete implementations of an interface or abstract class\n" +
    "- When exploring how different components implement a common contract\n" +
    "- When understanding the variety of implementations for a specific method\n" +
    "- When analyzing polymorphic behavior across a codebase\n" +
    "- When evaluating the impact of interface changes on implementing classes\n\n" +
    "PARAMETER USAGE:\n" +
    "- repository: The full repository name (e.g., 'github.com/owner/repo')\n" +
    "- path: The file path where the interface or abstract class is defined (e.g., 'src/interfaces.ts')\n" +
    "- line: The zero-indexed line number where the interface appears\n" +
    "- character: The zero-indexed character position of the interface on that line\n" +
    "- limit: Maximum number of implementations to return (default: 50)\n\n" +
    "IMPORTANT NOTES:\n" +
    "- Requires LSIF data to be available in Sourcegraph (precise code intelligence)\n" +
    "- This feature is most effective in strongly-typed languages (Java, C#, TypeScript, Go, etc.)\n" +
    "- For accurate results, the repository must be properly indexed in Sourcegraph\n" +
    "- Cross-repository implementations require proper indexing of all relevant repositories\n" +
    "- Line and character positions are zero-indexed (unlike editors which often use 1-indexed)\n\n" +
    "EXAMPLES:\n" +
    "- Find implementations of an interface: { repository: 'github.com/golang/go', path: 'src/io/io.go', line: 78, character: 6, limit: 100 }\n" +
    "- Discover classes implementing an interface: { repository: 'github.com/spring-projects/spring-framework', path: 'spring-core/src/main/java/org/springframework/core/io/Resource.java', line: 24, character: 17 }\n\n" +
    "The results will show all files and locations where the interface or abstract class is implemented, organized by repository and file.",
    {
      repository: z.string().describe("The repository name (e.g. github.com/owner/repo)"),
      path: z.string().describe("The file path within the repository"),
      line: z.number().describe("Zero-indexed line number of the interface/abstract class"),
      character: z.number().describe("Zero-indexed character position of the interface/abstract class"),
      limit: z.number().default(50).describe("Maximum number of implementations to return")
    },
    async ({ repository, path, line, character, limit }) => {
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
        // Get the implementations query
        const graphqlQuery = getImplementationsQuery();
        
        // Execute the query
        const response = await executeSourcegraphQuery(
          graphqlQuery,
          { repository, path, line, character, limit },
          { url: effectiveUrl, token: effectiveToken }
        );
        
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
        const formattedResults = formatImplementationsResults(response.data, { repository, path, line, character });
        
        return {
          content: [{ 
            type: "text", 
            text: formattedResults
          }]
        };
        
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error finding implementations: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  return server;
}