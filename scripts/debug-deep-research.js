#!/usr/bin/env node

/**
 * Debug script for the deep-code-researcher tool
 * This script calls the tool through the HTTP MCP interface
 */

const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// MCP server configuration
const MCP_PORT = process.env.MCP_PORT || 3002;
const MCP_URL = `http://localhost:${MCP_PORT}`;

async function testDeepResearch() {
  try {
    console.log(`Testing deep-code-researcher via MCP server at ${MCP_URL}...`);
    
    // Test parameters
    const params = {
      query: 'supabase',
      repo: 'madhukarkumar/open-canvas',
      language: '', // Optional
      limit: 20
    };
    
    console.log('Test parameters:', JSON.stringify(params, null, 2));
    
    // Call the MCP tool/invoke endpoint
    const response = await axios.post(`${MCP_URL}/tools/invoke`, {
      name: 'deep-code-researcher',
      parameters: params
    });
    
    if (response.data.isError) {
      console.error('Error response received:', response.data);
    } else {
      console.log('Success! Tool returned content with length:', 
          response.data.content[0].text.length);
      // Show a short preview of the result
      console.log('\nResult preview:');
      console.log(response.data.content[0].text.substring(0, 500) + '...');
    }
    
  } catch (error) {
    console.error('Error testing deep-code-researcher:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Start the HTTP server first
const { spawn } = require('child_process');
const mcpServer = spawn('node', ['dist/http-server.js']);

// Log server output
mcpServer.stdout.on('data', (data) => {
  console.log(`MCP Server output: ${data}`);
});

mcpServer.stderr.on('data', (data) => {
  console.error(`MCP Server error: ${data}`);
});

// Wait a few seconds for the server to start, then run the test
setTimeout(() => {
  testDeepResearch().finally(() => {
    console.log('Test complete, shutting down server');
    mcpServer.kill();
    process.exit(0);
  });
}, 3000); // 3 second delay

// Handle server exit
mcpServer.on('close', (code) => {
  console.log(`MCP Server process exited with code ${code}`);
});