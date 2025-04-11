#!/usr/bin/env node

import { createServer } from './mcp-server.js';
import dotenv from 'dotenv';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * This file creates an MCP server that communicates over STDIO
 * This allows it to be run as a child process by MCP clients
 */

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Log startup message to stderr (not stdout which is used for the protocol)
    console.error('Starting Sourcegraph MCP Server with STDIO transport...');
    console.error(`SOURCEGRAPH_URL: ${process.env.SOURCEGRAPH_URL ? 'Set' : 'NOT SET'}`);
    console.error(`SOURCEGRAPH_TOKEN: ${process.env.SOURCEGRAPH_TOKEN ? 'Set (redacted)' : 'NOT SET'}`);
    
    // Create the MCP server
    const server = createServer();
    
    // Create a STDIO transport from the SDK
    const transport = new StdioServerTransport();
    
    // Connect the transport to the server
    console.error('Connecting to STDIO transport...');
    await server.connect(transport);
    
    console.error('Sourcegraph MCP Server running in STDIO mode');
    console.error('- Server is waiting for JSONRPC messages on stdin');
    console.error('- Tools available: echo, search-code, search-commits, search-diffs, search-github-repos, debug');
  } catch (error) {
    // Log error to stderr
    console.error('Failed to start MCP server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error instanceof Error ? error.message : error);
  process.exit(1);
});