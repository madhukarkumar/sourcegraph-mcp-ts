/**
 * Sourcegraph MCP Server Test Script
 * 
 * This script tests the natural language search functionality
 * of the Sourcegraph MCP server.
 */

require('dotenv').config();
const axios = require('axios');

// Get test query from command line, or use default
const testQuery = process.argv[2] || 'Find authentication code in React components';

// Server configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3002';

async function testSearch() {
  try {
    // Verify environment variables
    if (!process.env.SOURCEGRAPH_URL || !process.env.SOURCEGRAPH_TOKEN) {
      console.error('Error: SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN must be set in .env');
      process.exit(1);
    }

    console.log(`Testing server at ${SERVER_URL}`);
    console.log(`Using Sourcegraph instance: ${process.env.SOURCEGRAPH_URL}`);
    console.log(`\nQuery: "${testQuery}"\n`);

    // First test natural language test tool (which doesn't execute the search)
    console.log('Testing natural language parsing...');
    const testResponse = await axios.post(`${SERVER_URL}/tools/test-nl-search`, {
      params: { query: testQuery }
    });

    // Display the test results
    console.log(testResponse.data.content[0].text);
    console.log('\n---------------------------------------------------\n');
    
    // Now test the actual search functionality
    console.log('Executing search with natural language...');
    const searchResponse = await axios.post(`${SERVER_URL}/tools/natural-search`, {
      params: { query: testQuery }
    });

    // Display the search results
    console.log(searchResponse.data.content[0].text);
  } catch (error) {
    console.error('Error testing search:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Run the test
testSearch();