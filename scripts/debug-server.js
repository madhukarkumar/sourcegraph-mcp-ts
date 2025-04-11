#!/usr/bin/env node

/**
 * Debug tool for the Sourcegraph MCP Server
 * 
 * This script helps diagnose connection issues with the MCP server
 * by creating a minimalist express server that logs all requests.
 */
const express = require('express');
const app = express();

// Parse JSON requests
app.use(express.json());

// Enable CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (Object.keys(req.query).length) console.log('Query params:', req.query);
  if (req.body && Object.keys(req.body).length) {
    const bodyCopy = { ...req.body };
    // If body contains a token, redact it for security
    if (bodyCopy.token) bodyCopy.token = "[REDACTED]";
    console.log('Request body:', JSON.stringify(bodyCopy, null, 2));
  }
  next();
});

// Mock /connect endpoint
app.post('/connect', (req, res) => {
  console.log('\n[CONNECTION] New connection request received');
  const connectionId = `test-${Date.now()}`;
  console.log(`Assigned connection ID: ${connectionId}`);
  res.json({ connectionId: connectionId });
});

// Mock /messages endpoint
app.post('/messages', (req, res) => {
  console.log('\n[MESSAGE] New message received');
  const connectionId = req.body.connectionId;
  
  // Test Echo
  if (req.body.content?.methodCall?.method === 'tools/invoke' && 
      req.body.content?.methodCall?.params?.name === 'echo') {
    const message = req.body.content.methodCall.params.params.message;
    console.log(`Echo requested with message: ${message}`);
    return res.json({
      methodResult: {
        return: {
          content: [{ type: 'text', text: `Hello ${message}` }]
        }
      }
    });
  }
  
  // Test natural language search
  if (req.body.content?.methodCall?.method === 'tools/invoke' && 
      req.body.content?.methodCall?.params?.name === 'test-nl-search') {
    const query = req.body.content.methodCall.params.params.query;
    console.log(`Natural language search test requested with query: ${query}`);
    
    return res.json({
      methodResult: {
        return: {
          content: [{ 
            type: 'text', 
            text: `# Test Natural Language Search for: "${query}"

## Identified Search Parameters
- Search type: code
- Keywords: ${query}
- Additional filters: none

This is a test response. In a real search, you would see code matches here.
` 
          }]
        }
      }
    });
  }
  
  // Default response for any other tool
  return res.json({
    methodResult: {
      return: {
        content: [{ 
          type: 'text', 
          text: `Debug tool received request for connection: ${connectionId}` 
        }]
      }
    }
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MCP Debug Tool',
    status: 'running',
    availableEndpoints: [
      '/connect - Establish a connection',
      '/messages - Send messages (tools/invoke)',
      '/sse - Server-sent events (not implemented in debug tool)'
    ],
    supportedTools: [
      'echo - Simple echo test',
      'test-nl-search - Test natural language search parsing'
    ]
  });
});

// Start the server
const PORT = 3003;
app.listen(PORT, () => {
  console.log(`MCP Debug Tool running on http://localhost:${PORT}`);
  console.log('Connect MCP Inspector to this URL to see the full request/response cycle');
  console.log('Available endpoints: /, /connect, /messages');
});