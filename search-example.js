/**
 * MCP Server Test Script
 * 
 * This script tests the Sourcegraph MCP server by calling its endpoints.
 * Run this after starting the server with `npm start`.
 */

const axios = require('axios');
require('dotenv').config();

// Verify environment variables
console.log('Environment variables:');
console.log(`SOURCEGRAPH_URL: ${process.env.SOURCEGRAPH_URL ? process.env.SOURCEGRAPH_URL.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`SOURCEGRAPH_TOKEN: ${process.env.SOURCEGRAPH_TOKEN ? 'SET (redacted)' : 'NOT SET'}`);

// MCP server configuration
const MCP_SERVER_URL = 'http://localhost:3002';

async function testMcpServer() {
  try {
    // Test getting available tools
    console.log(`\nTesting MCP server tools endpoint at ${MCP_SERVER_URL}/tools...`);
    const toolsResponse = await axios.get(`${MCP_SERVER_URL}/tools`);
    console.log('Available tools:', JSON.stringify(toolsResponse.data, null, 2));
    
    // Test search-code tool
    console.log('\nTesting search-code tool...');
    try {
      const searchResponse = await axios.post(`${MCP_SERVER_URL}/tools/search-code`, {
        params: {
          query: 'function',
          type: 'file'
        }
      });
      console.log('Search results:', JSON.stringify(searchResponse.data, null, 2));
    } catch (error) {
      console.error('Error with search-code tool:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error testing MCP server:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testMcpServer();