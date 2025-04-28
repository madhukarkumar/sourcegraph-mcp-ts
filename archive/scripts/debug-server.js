"use strict";

const { McpServer, ResourceTemplate } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Create MCP server with proper debug object
function createServer() {
  const server = new McpServer({
    name: "debug-mcp-server",
    version: "1.0.0",
    debug: false, // Disable debug mode in production
  });

  // Just create a basic echo tool
  server.tool(
    "echo",
    "Simple echo tool for testing",
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

  // Add deep code researcher tool
  server.tool(
    "deep-code-researcher",
    "Conduct deep research on code patterns and architecture across repositories with advanced analysis capabilities.",
    {
      query: z.string().describe("The research query or code pattern to analyze")
    },
    async ({ query }) => {
      // Placeholder for implementation
      return {
        content: [{ 
          type: "text", 
          text: `Research query '${query}' processed. Implementation pending.` 
        }]
      };
    }
  );

  // Simple debug tool 
  server.tool(
    "debug",
    "List available tools",
    {},
    async () => {
      const tools = ["echo", "debug", "deep-code-researcher"];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ tools }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

// Export the createServer function
module.exports = { createServer };