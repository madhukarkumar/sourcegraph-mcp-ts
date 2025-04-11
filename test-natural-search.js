/**
 * Test script for the natural language search capability
 */

require('dotenv').config();
const axios = require('axios');

// Prepare a natural language search request
const testQuery = 'Find code related to authentication in the sourcegraph/sourcegraph repository';

// Configure server URL (try API endpoint instead of MCP protocol)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const DEBUG = process.env.DEBUG === 'true';

async function testNaturalLanguageSearch() {
  let connectionId;
  try {
    console.log(`Testing natural language search with query: "${testQuery}"`);
    console.log(`Connecting to MCP server at: ${SERVER_URL}\n`);
    
    // First, establish a connection with the server
    console.log('Establishing connection with MCP server...');
    try {
      const connectionResponse = await axios.post(
        `${SERVER_URL}/connect`,
        {
          capabilities: ["tools/invoke", "mcp/capabilities"]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Extract the connection ID
      connectionId = connectionResponse.data?.connectionId;
      if (!connectionId) {
        throw new Error('Failed to get connection ID from server');
      }
      
      console.log(`Connection established with ID: ${connectionId}\n`);
    } catch (connectError) {
      if (DEBUG) console.error('Connection error details:', connectError);
      throw new Error(`Failed to connect to MCP server: ${connectError.message}`);
    }

    // Make a request to the MCP server
    let response;
    try {
      // First try the standard MCP format
      try {
        response = await axios.post(
          `${SERVER_URL}/messages`,
          {
            connectionId,
            content: {
              methodCall: {
                method: 'tools/invoke',
                params: {
                  name: 'natural-search',
                  params: {
                    query: testQuery
                  }
                }
              }
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (standardMcpError) {
        // If that fails, try direct API endpoint
        console.log('Standard MCP request failed, trying direct endpoint...');
        response = await axios.post(
          `${SERVER_URL}/api/search`,
          {
            query: testQuery,
            type: 'natural'
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
      
      if (DEBUG) console.log('Raw response:', JSON.stringify(response.data, null, 2));
    } catch (messageError) {
      if (DEBUG) console.error('Message error details:', messageError);
      throw new Error(`Failed to send message to MCP server: ${messageError.message}`);
    }

    // Display the results
    try {
      if (response && response.data) {
        console.log('Search Results:');
        console.log('---------------');

        // Try to extract the content based on MCP response structure
        // Handle different response formats
        let content = [];
        if (response.data.content) {
          // Direct content format
          content = response.data.content;
        } else if (response.data.methodResult?.return?.content) {
          // methodResult format
          content = response.data.methodResult.return.content;
        } else if (Array.isArray(response.data)) {
          // Array format
          content = response.data;
        }
        
        if (content && content.length > 0) {
          content.forEach(item => {
            if (item.type === 'text') {
              console.log(item.text);
            } else if (typeof item === 'string') {
              console.log(item);
            }
          });
        } else {
          console.log('No content in response:', JSON.stringify(response.data, null, 2));
        }
      } else {
        console.log('Unexpected response format:', response ? JSON.stringify(response.data, null, 2) : 'No response');
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError.message);
      if (DEBUG) console.error(parseError);
    }

  } catch (error) {
    console.error('Error testing natural language search:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
      if (DEBUG) console.error('Error details:', error);
    }
  } finally {
    // Optional: close the connection when done
    try {
      if (connectionId) {
        await axios.post(`${SERVER_URL}/disconnect`, { connectionId });
        console.log('\nConnection closed');
      }
    } catch (disconnectError) {
      console.error('Error disconnecting:', disconnectError.message);
    }
  }
}

// Run the test
testNaturalLanguageSearch();