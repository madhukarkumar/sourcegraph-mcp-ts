#!/usr/bin/env node

import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "./mcp-server.js";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('Starting Sourcegraph MCP Server...');
  console.log(`SOURCEGRAPH_URL: ${process.env.SOURCEGRAPH_URL ? 'Set' : 'NOT SET'}`); 
  console.log(`SOURCEGRAPH_TOKEN: ${process.env.SOURCEGRAPH_TOKEN ? 'Set (redacted)' : 'NOT SET'}`);

  // Create the server
  const server = createServer();
  
  // Create Express app
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

  // Server-side connections
  const connections = new Map();
  
  // Handle SSE connections
  app.get("/sse", async (req, res) => {
    // Generate a unique connection ID (UUID format)
    const sessionId = req.query.sessionId as string || 
                    `${Math.random().toString(36).substring(2, 15)}-${Date.now().toString(36)}`;
    
    try {
      console.log(`New SSE connection established with session ID: ${sessionId}`);
      
      // Create a new SSE transport
      const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
      connections.set(sessionId, transport);
      
      // Connect the server to this transport
      await server.connect(transport);
      console.log(`Server connected to transport for session ${sessionId}`);
    } catch (error: any) {
      console.error('Error establishing SSE connection:', error);
      // If headers already sent due to transport.start(), don't try to set them again
      if (!res.headersSent) {
        res.status(500).end(`Server error: ${error.message || 'Unknown error'}`);
      }
    }
    
    // Handle client disconnect
    req.on("close", () => {
      if (connections.has(sessionId)) {
        connections.delete(sessionId);
        console.log(`Client ${sessionId} disconnected`);
      }
    });
  });
  
  // Handle messages from client
  app.post("/messages", express.json(), async (req, res) => {
    try {
      // Extract sessionId from query parameters
      const sessionId = req.query.sessionId as string;
      
      console.log(`Received message for session ${sessionId}`);
      
      if (!sessionId || !connections.has(sessionId)) {
        // If no sessionId or connection not found, try the first connection
        if (connections.size === 0) {
          return res.status(400).json({ error: "No active connections" });
        }
        console.log('No specific session found, using first available connection');
        const transport = connections.values().next().value;
        await transport.handlePostMessage(req, res, req.body);
      } else {
        // Use the specific connection for this session
        console.log(`Using connection for session ${sessionId}`);
        const transport = connections.get(sessionId);
        await transport.handlePostMessage(req, res, req.body);
      }
    } catch (error: any) {
      console.error('Error handling message:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown error'}` });
      }
    }
  });

  // Health check endpoint
  app.get("/", (req, res) => {
    res.json({
      name: "Sourcegraph MCP Server",
      version: "1.0.0",
      status: "running",
      tools: [
        "echo",
        "search-code",
        "search-commits",
        "search-diffs",
        "debug"
      ]
    });
  });
  
  // Start the server
  app.listen(port, () => {
    console.log(`Sourcegraph MCP Server running on http://localhost:${port}`);
    console.log(`- Connect to /sse for server-sent events`);
    console.log(`- Send messages to /messages endpoint`);
    console.log(`- Available tools: echo, search-code, search-commits, search-diffs, debug`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});