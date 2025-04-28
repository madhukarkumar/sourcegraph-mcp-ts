#!/usr/bin/env node

/**
 * Simple STDIO server for MCP protocol that works reliably
 * regardless of TypeScript build issues
 */

const dotenv = require('dotenv');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Log startup message to stderr (not stdout which is used for the protocol)
    console.error('Starting Simplified MCP Server with STDIO transport...');
    console.error(`SOURCEGRAPH_URL: ${process.env.SOURCEGRAPH_URL ? 'Set' : 'NOT SET'}`);
    console.error(`SOURCEGRAPH_TOKEN: ${process.env.SOURCEGRAPH_TOKEN ? 'Set (redacted)' : 'NOT SET'}`);
    
    // Create a simple MCP server with basic tools
    const server = new McpServer({
      name: "sourcegraph-mcp-server",
      version: "1.0.0",
      debug: false
    });

    // Add echo tool
    server.tool("echo", "Simple echo tool", { 
      message: z.string().describe("Message to echo") 
    }, async ({ message }) => ({
      content: [{
        type: "text",
        text: `Hello ${message}`
      }]
    }));

    // Add deep code researcher tool
    server.tool("deep-code-researcher", "Research code patterns", {
      query: z.string().describe("Search query"),
      repo: z.string().optional().describe("Repository filter"),
      language: z.string().optional().describe("Language filter")
    }, async ({ query, repo, language }) => {
      // Simplified implementation
      return {
        content: [{
          type: "text",
          text: `## Deep Code Research Results\n\n` +
                `Query: ${query}\n\n` +
                (repo ? `Repository: ${repo}\n\n` : '') +
                (language ? `Language: ${language}\n\n` : '') +
                `### Findings\n\n` +
                `Searching for code matching your query...\n\n` +
                `To get detailed results, please use the HTTP server version.`
        }]
      };
    });

    // Debug tool
    server.tool("debug", "List available tools", {}, async () => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          tools: ["echo", "deep-code-researcher", "debug"],
          status: "running"
        }, null, 2)
      }]
    }));

    // Create a STDIO transport
    const transport = new StdioServerTransport();
    
    // Connect the transport to the server
    console.error('Connecting to STDIO transport...');
    await server.connect(transport);
    
    console.error('Sourcegraph MCP Server running in STDIO mode');
    console.error('- Server is waiting for JSONRPC messages on stdin');
    console.error('- Tools available: echo, deep-code-researcher, debug');
  } catch (error) {
    // Log error to stderr
    console.error('Failed to start MCP server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error instanceof Error ? error.message : String(error));
  process.exit(1);
});