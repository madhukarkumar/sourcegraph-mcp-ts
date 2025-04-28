#!/usr/bin/env node

const { HttpServerTransport } = require("@modelcontextprotocol/sdk/server/http.js");
const { createServer } = require("./debug-server.js");

// Default port from environment or 3002
const port = process.env.MCP_PORT || 3002;

// Create the MCP server
const server = createServer();

// Create and start the HTTP transport
const transport = new HttpServerTransport({
  server,
  port: Number(port),
  allowedOrigins: ["*"], // Allow all origins for testing
  debug: true, // Enable debug mode for testing
});

transport.listen().then(() => {
  console.log(`MCP Server started on http://localhost:${port}`);
});