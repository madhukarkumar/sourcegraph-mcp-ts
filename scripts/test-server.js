#!/usr/bin/env node

const express = require('express');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a minimal server
function createServer() {
  const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
  const { z } = require('zod');
  
  const server = new McpServer({
    name: "debug-mcp-server",
    version: "1.0.0",
    debug: false
  });

  // Add an echo tool
  server.tool(
    "echo",
    "Simple echo tool",
    { message: z.string().describe("Message to echo") },
    async ({ message }) => ({
      content: [
        {
          type: "text",
          text: `Hello ${message}`,
        },
      ],
    })
  );

  // Add debug tool
  server.tool(
    "debug",
    "List tools",
    {},
    async () => {
      try {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ tools: ["echo", "debug", "deep-code-researcher"] }, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error('Debug error:', error);
        return {
          content: [
            {
              type: "text",
              text: "Error listing tools",
            },
          ],
          isError: true
        };
      }
    }
  );

  // Add deep code researcher tool
  server.tool(
    "deep-code-researcher",
    "Research code patterns",
    { query: z.string().describe("Research query") },
    async ({ query }) => ({
      content: [
        {
          type: "text",
          text: `Research query '${query}' processed. Implementation pending.`,
        },
      ],
    })
  );

  return server;
}

// Set up express server
const app = express();
const port = process.env.MCP_PORT || 3002;

// Configure CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Create server
const server = createServer();

// Store connections
const connections = new Map();

// Handle SSE connections
app.get('/sse', async (req, res) => {
  // Create a unique session ID
  const sessionId = req.query.sessionId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  try {
    console.log(`New SSE connection: ${sessionId}`);
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Create a transport
    const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
    connections.set(sessionId, transport);
    
    // Connect server to this transport
    await server.connect(transport);
    console.log(`Server connected to transport for session ${sessionId}`);
  } catch (error) {
    console.error('Error in SSE:', error);
    if (!res.headersSent) {
      res.status(500).end(`Error: ${error.message || 'Unknown'}`);
    }
  }
  
  // Handle client disconnect
  req.on('close', () => {
    if (connections.has(sessionId)) {
      connections.delete(sessionId);
      console.log(`Client ${sessionId} disconnected`);
    }
  });
});

// Handle messages
app.post('/messages', express.json(), async (req, res) => {
  try {
    const sessionId = req.body.connectionId || req.query.sessionId;
    console.log(`Received message for sessionId ${sessionId}`);
    
    if (!sessionId || !connections.has(sessionId)) {
      if (connections.size === 0) {
        return res.status(400).json({ error: "No active connections" });
      }
      // Use first available connection
      const firstTransport = connections.values().next().value;
      await firstTransport.handlePostMessage(req, res, req.body);
    } else {
      // Use the specific connection
      const transport = connections.get(sessionId);
      await transport.handlePostMessage(req, res, req.body);
    }
  } catch (error) {
    console.error(`Error in /message route: ${error}`);
    if (!res.headersSent) {
      res.status(500).json({ error: `Server error: ${error.message || 'Unknown'}` });
    }
  }
});

// Home route
app.get('/', (req, res) => {
  res.json({
    name: "Debug MCP Server",
    status: "running",
    tools: ["echo", "debug", "deep-code-researcher"]
  });
});

// Start server
app.listen(port, () => {
  console.log(`Debug MCP Server running on http://localhost:${port}`);
  console.log(`- Connect MCP Inspector to http://localhost:${port}/sse`); 
  console.log(`- Available tools: echo, debug, deep-code-researcher`);
});