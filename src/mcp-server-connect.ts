/**
 * Helper script to debug MCP connection issues
 * Shows what happens during the connection process
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import express from 'express';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config();

// Create a minimal MCP server for testing
const server = new McpServer({
  name: "connection-test-server",
  version: "1.0.0",
  debug: true, // Enable debug mode
});

// Add a basic echo tool
server.tool(
  "echo",
  "Simple echo tool",
  { message: z.string().describe("Message to echo") },
  async ({ message }) => ({
    content: [{ type: "text", text: `Echo: ${message}` }],
  })
);

// Create an HTTP server
const port = Number(process.env.CONNECTION_TEST_PORT || 3003);
const app = express();

// Configure Express app
app.use(express.json());

// Create HTTP server from Express
const httpServer = http.createServer(app);

// Start listening
httpServer.listen(port, () => {
  console.log(`MCP connection test server running at http://localhost:${port}`);
  console.log("Waiting for connections...");
});

// Output server started information
console.log("\nAvailable tools:");
console.log("- echo: Simple echo tool");

// Connection events can be logged with HTTP middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`\n[REQUEST] ${req.method} ${req.path}`);
  if (req.path === '/connect') {
    console.log('New connection attempt');
  }
  if (req.path === '/messages' && req.method === 'POST') {
    console.log('New message received');
  }
  next();
});

// Setup MCP server endpoints
app.post('/connect', (req: express.Request, res: express.Response) => {
  console.log('Connection request:', req.body);
  res.json({ connectionId: `test-${Date.now()}` });
});

app.post('/messages', (req: express.Request, res: express.Response) => {
  console.log('Message received:', req.body);
  
  // Handle echo tool
  if (req.body?.content?.methodCall?.method === 'tools/invoke' && 
      req.body?.content?.methodCall?.params?.name === 'echo') {
    const message = req.body.content.methodCall.params.params.message;
    res.json({
      methodResult: {
        return: {
          content: [
            { type: 'text', text: `Echo: ${message}` }
          ]
        }
      }
    });
  } else {
    res.json({ error: 'Unknown request' });
  }
});

// Add error handling
process.on('uncaughtException', (error) => {
  console.error("\n[SERVER ERROR]", error);
});