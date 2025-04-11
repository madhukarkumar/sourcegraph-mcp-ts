import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Sourcegraph API configuration
const sgUrl = process.env.SOURCEGRAPH_URL;
const sgToken = process.env.SOURCEGRAPH_TOKEN;

/**
 * Creates and configures the Sourcegraph MCP server
 * with resources, prompts, and tools
 */
export function createServer() {
  // Create an MCP server
  const server = new McpServer({
    name: "sourcegraph-mcp-server",
    version: "1.0.0",
    debug: true, // Enable debug mode
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
  server.tool(
    "echo",
    "Echoes back a message with 'Hello' prefix",
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

  // Add code search tool
  server.tool(
    "search-code",
    "Search for code across Sourcegraph repositories",
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
        const response = await axios.post(
          `${effectiveUrl}/.api/graphql`,
          { query: graphqlQuery, variables: { query: searchQuery } },
          { headers }
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
        
        // Format the results
        const results = response.data.data.search.results;
        const matchCount = results.matchCount;
        const items = results.results;
        
        // Create a formatted result
        const formattedItems = items.map((item: any) => {
          if (item.__typename === 'FileMatch') {
            const repo = item.repository.name;
            const filePath = item.file.path;
            const matches = item.lineMatches.map((match: { lineNumber: number; preview: string }) => 
              `Line ${match.lineNumber}: ${match.preview}`
            ).join('\n');
            
            return `Repository: ${repo}\nFile: ${filePath}\n${matches}\n`;
          } else if (item.__typename === 'CommitSearchResult') {
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

  // Add commit search tool
  server.tool(
    "search-commits",
    "Search for commits in Sourcegraph repositories",
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
        // Build the search query
        let searchQuery = 'type:commit';
        if (author) searchQuery += ` author:${author}`;
        if (message) searchQuery += ` message:${message}`;
        if (after) searchQuery += ` after:${after}`;
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
        const response = await axios.post(
          `${effectiveUrl}/.api/graphql`,
          { query: graphqlQuery, variables: { query: searchQuery } },
          { headers }
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
        
        // Format the results
        const results = response.data.data.search.results;
        const matchCount = results.matchCount;
        const items = results.results;
        
        // Create a formatted result
        const formattedItems = items
          .filter((item: any) => item.__typename === 'CommitSearchResult')
          .map((item: any) => {
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

  // Add diff search tool
  server.tool(
    "search-diffs",
    "Search for code changes (diffs) in Sourcegraph repositories",
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
        // Build the search query
        let searchQuery = 'type:diff';
        if (query) searchQuery += ` ${query}`;
        if (author) searchQuery += ` author:${author}`;
        if (after) searchQuery += ` after:${after}`;
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
        const response = await axios.post(
          `${effectiveUrl}/.api/graphql`,
          { query: graphqlQuery, variables: { query: searchQuery } },
          { headers }
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
        
        // Format the results
        const results = response.data.data.search.results;
        const matchCount = results.matchCount;
        const items = results.results;
        
        // Create a formatted result
        const formattedItems = items
          .filter((item: any) => item.__typename === 'CommitSearchResult' && item.diff)
          .map((item: any) => {
            const commit = item.commit;
            const repo = commit.repository.name;
            const commitInfo = `Commit: ${commit.oid.substring(0, 7)}\nAuthor: ${commit.author.person.name}\nDate: ${commit.author.date}\nMessage: ${commit.message}\n`;
            
            let diffInfo = '';
            if (item.diff && item.diff.fileDiffs) {
              diffInfo = item.diff.fileDiffs.map((fileDiff: any) => {
                const pathInfo = `${fileDiff.oldPath || ''} → ${fileDiff.newPath || ''}`;
                const hunksInfo = fileDiff.hunks ? fileDiff.hunks.map((hunk: any) => {
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

  // Add a debug tool to list available tools and methods
  server.tool(
    "debug",
    "Lists all available tools and methods",
    {},
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tools: [
              "echo", 
              "search-code", 
              "search-commits", 
              "search-diffs", 
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
    })
  );

  return server;
}