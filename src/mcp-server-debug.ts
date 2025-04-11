import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import dotenv from 'dotenv';
import axios from 'axios';
import { naturalLanguageSearch } from './services/natural-language';
import { addTestTools } from './test-tools';
import { analyzeQuery } from './utils/formatter';

// Load environment variables
dotenv.config();

// Sourcegraph API configuration
const sgUrl = process.env.SOURCEGRAPH_URL;
const sgToken = process.env.SOURCEGRAPH_TOKEN;

/**
 * Creates and configures the Sourcegraph MCP server with debug mode enabled
 * This is mainly for development and not for production
 */
export function createDebugServer() {
  const toolImplementations: Record<string, Function> = {};
  // Create an MCP server with debug mode enabled
  const server = new McpServer({
    name: "sourcegraph-mcp-server-debug",
    version: "1.0.0",
    debug: true, // Enable debug mode for development
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

  // Add the same tools as the production server but with debug mode enabled
  // Copy the tools from mcp-server.ts implementation here
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

  // Add natural language search tool with console.log statements for debugging
  server.tool(
    "natural-search-debug",
    "Search code repositories using natural language queries (debug version)",
    { 
      query: z.string().describe("Natural language query describing what you want to search for"),
      max_results: z.number().optional().describe("Maximum number of results to return (default: 20)")
    },
    async ({ query, max_results }) => {
      console.log(`[DEBUG] Natural language search query: ${query}`);
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

      // Analyze the query with detailed console output
      console.log(`[DEBUG] Processing query: ${query}`);
      const queryAnalysis = analyzeQuery(query);
      console.log(`[DEBUG] Query analysis:`, queryAnalysis);

      const result = await naturalLanguageSearch(query, {
        url: effectiveUrl,
        token: effectiveToken
      });
      
      console.log(`[DEBUG] Search complete, returning results`);
      return result;
    }
  );

  // Add invoke method to the server for direct tool invocation
  (server as any).invoke = async (toolName: string, params: any) => {
    console.log(`[DEBUG] Invoking tool: ${toolName}`);
    console.log(`[DEBUG] Params:`, params);
    if (toolName in toolImplementations) {
      return await toolImplementations[toolName](params);
    }
    throw new Error(`Tool '${toolName}' not found`);
  };

  // Add the test tools for debugging
  addTestTools(server);

  return server;
}