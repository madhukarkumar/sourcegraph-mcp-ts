/**
 * Simple test script to directly call natural-search on your MCP server
 */

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const PORT = process.env.PORT || 3001;
const MCP_PORT = process.env.MCP_PORT || 3002;

// Try multiple ports
const ports = [PORT, MCP_PORT, 3001, 3002, 3003, 3004];

async function testServer() {
  console.log('Testing MCP server detection...');
  
  for (const port of ports) {
    try {
      console.log(`Trying port ${port}...`);
      const response = await axios.get(`http://localhost:${port}`, {
        timeout: 2000 // Set a short timeout
      });
      console.log(`✅ Server detected on port ${port}!`);
      console.log('Response status:', response.status);
      
      // Try to establish a connection
      try {
        const connectResponse = await axios.post(
          `http://localhost:${port}/connect`,
          { capabilities: ["tools/invoke"] },
          { headers: { 'Content-Type': 'application/json' }, timeout: 2000 }
        );
        console.log('Connection successful on port', port);
        console.log('Connection response:', connectResponse.data);
        return port;
      } catch (err) {
        console.log(`❌ Connection attempt failed on port ${port}:`, err.message);
      }
    } catch (err) {
      console.log(`❌ No server detected on port ${port}:`, err.message);
    }
  }
  
  console.log('Unable to find a running MCP server');
  return null;
}

testServer().then((port) => {
  if (port) {
    console.log(`\nDetected MCP server on port: ${port}`);
    console.log(`Use this port in your test script: MCP_SERVER_URL=http://localhost:${port} node test-natural-search.js`);
  }
});