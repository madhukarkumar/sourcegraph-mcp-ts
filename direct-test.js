/**
 * Direct test of natural language search API endpoint
 */

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// Query for natural language search
const query = 'Find code related to authentication in the sourcegraph/sourcegraph repository';

// Server URL (default API server port)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const DEBUG = process.env.DEBUG === 'true';

async function testDirectApi() {
  console.log(`Testing direct API with natural language query:
  "${query}"
`);
  
  try {
    console.log(`Sending request to ${SERVER_URL}/api/search...\n`);
    
    const response = await axios.post(
      `${SERVER_URL}/api/search`,
      {
        query: query,
        type: 'natural'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (DEBUG) {
      console.log('Full response:', JSON.stringify(response.data, null, 2));
    }
    
    if (response.data && response.data.content) {
      console.log('Search Results:');
      console.log('---------------');
      
      response.data.content.forEach(item => {
        if (item.type === 'text') {
          console.log(item.text);
        }
      });
    } else {
      console.log('Unexpected response format:', response.data);
    }
    
  } catch (error) {
    console.error('Error testing API:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
      if (DEBUG) console.error('Error details:', error);
    }
  }
}

// Run the test
testDirectApi();