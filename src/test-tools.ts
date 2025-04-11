/**
 * Test tools for MCP Inspector
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeQuery, formatSearchResults } from './utils/formatter';
import axios from 'axios';

/**
 * Add test tools to an MCP server to help with debugging and validation
 */
export function addTestTools(server: McpServer) {
  // Silent initialization - don't log to console as it breaks JSON responses

  // Add a test natural language search tool that explains what's happening
  server.tool(
    "test-nl-search",
    "Test natural language search functionality with debugging information",
    { 
      query: z.string().describe("Natural language query describing what you want to search for")
    },
    async ({ query }) => {
      try {
        // Process silently without console logs that break the JSON response
        
        // Step 1: Analyze the query to determine search type and parameters
        const queryAnalysis = analyzeQuery(query);
        
        // Step 2: Build the Sourcegraph search query
        let searchQuery = queryAnalysis.query;
        
        // Add type filter
        searchQuery += ` type:${queryAnalysis.type}`;
        
        // Add author filter for commit and diff searches
        if (queryAnalysis.author && (queryAnalysis.type === 'commit' || queryAnalysis.type === 'diff')) {
          searchQuery += ` author:${queryAnalysis.author}`;
        }
        
        // Add date filter
        if (queryAnalysis.after && (queryAnalysis.type === 'commit' || queryAnalysis.type === 'diff')) {
          searchQuery += ` after:${queryAnalysis.after}`;
        }
        
        // Add repository filters
        if (queryAnalysis.repos.length > 0) {
          const repoFilters = queryAnalysis.repos.map(repo => {
            // If it looks like a GitHub repo (contains a slash), format accordingly
            if (repo.includes('/')) {
              return `repo:^github\\.com/${repo}$`;
            }
            // Otherwise use as-is
            return `repo:${repo}`;
          });
          searchQuery += ` ${repoFilters.join(' ')}`;
        }
        
        // Add result count limit
        searchQuery += ' count:20';

        // Step 3: Select the appropriate GraphQL query based on search type
        // For testing, show the process without actually executing the search
        return {
          content: [{ 
            type: "text", 
            text: `# Natural Language Search Test Results

## Query Analysis
- Original query: "${query}"
- Detected search type: ${queryAnalysis.type}
- Extracted search terms: "${queryAnalysis.query}"
${queryAnalysis.author ? `- Author filter: ${queryAnalysis.author}` : ''}
${queryAnalysis.after ? `- Date filter: after:${queryAnalysis.after}` : ''}
${queryAnalysis.repos.length > 0 ? `- Repository filters: ${queryAnalysis.repos.join(', ')}` : ''}

## Sourcegraph Query
\`\`\`
${searchQuery}
\`\`\`

This is a test tool that shows how natural language is processed without executing the actual search.
To perform the real search, use the 'natural-search' tool instead.
`
          }]
        };
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `Error processing natural language test: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add a connection test tool
  server.tool(
    "test-connection",
    "Test if the MCP server can connect to Sourcegraph API",
    {},
    async () => {
      try {
        // Get Sourcegraph API configuration
        const sgUrl = process.env.SOURCEGRAPH_URL;
        const sgToken = process.env.SOURCEGRAPH_TOKEN;
        
        if (!sgUrl || !sgToken) {
          return {
            content: [{ 
              type: "text", 
              text: "Error: Sourcegraph URL or token not configured. Please set SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN environment variables." 
            }],
            isError: true
          };
        }

        // Test connection to Sourcegraph API
        const response = await axios.post(
          `${sgUrl}/.api/graphql`,
          { 
            query: `query { currentUser { username } }` 
          },
          { 
            headers: {
              'Authorization': `token ${sgToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.errors) {
          return {
            content: [{ 
              type: "text", 
              text: `Sourcegraph API Error: ${JSON.stringify(response.data.errors)}` 
            }],
            isError: true
          };
        }

        const username = response.data.data?.currentUser?.username || 'Anonymous user';

        return {
          content: [{ 
            type: "text", 
            text: `✅ Successfully connected to Sourcegraph API at ${sgUrl}\nAuthenticated as: ${username}\n\nSourcegraph connection is working properly.` 
          }]
        };
      } catch (error: any) {
        return {
          content: [{ 
            type: "text", 
            text: `❌ Error connecting to Sourcegraph API: ${error.message || 'Unknown error'}` 
          }],
          isError: true
        };
      }
    }
  );

  // Add a quick test tool to explain how to use the natural language search
  server.tool(
    "nl-search-help",
    "Get help on using natural language search",
    {},
    async () => {
      return {
        content: [{ 
          type: "text", 
          text: `# Natural Language Search Help

## How to use natural language search

1. Use the \`natural-search\` tool with a query parameter
2. Express your search intent in natural language
3. The system will analyze your query and convert it to Sourcegraph syntax

## Example queries

- **Code search**: "Find authentication code in the frontend"
- **Commit search**: "Show commits by Jane from last week"
- **Diff search**: "What changes were made to the API last month?"

## Supported filters (automatically detected)

- **Repository**: "in repository X" or "in repo X/Y"
- **Author**: "by [author name]" or "from [author name]"
- **Date**: "after 2023-01-01" or "since 2023-01-01"
- **Type**: Automatically detected based on terms like "commit", "diff", or "code"

## Tips

- Be specific about what you're looking for
- Include repository names when possible
- For commits or diffs, mention author names and timeframes
- To test query parsing without running a search, use \`test-nl-search\` tool
` 
        }]
      };
    }
  );

  // Return the server with tools added
  return server;
}