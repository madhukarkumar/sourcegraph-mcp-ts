/**
 * The simplest direct test for the natural language search feature
 * This bypasses all MCP protocol and connection setup
 */

const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const SERVER_URL = 'http://localhost:3001';
const query = 'Find authentication code';

// Make the direct API call
async function testSimple() {
  try {
    console.log(`Testing with direct API call to ${SERVER_URL}/search/code`);
    console.log(`Query: "${query}"`);
    
    // Use the regular search endpoint with natural language
    const response = await axios.post(
      `${SERVER_URL}/search/code`,
      {
        query: query,
        directQuery: false // false means natural language
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\nResults:');
    console.log('----------');
    
    if (response.data) {
      console.log('Query was converted to:', response.data.finalQuery);
      console.log('\nMatches found:', response.data.results?.matchCount || 0);
      
      // Display results
      if (response.data.results?.results) {
        const results = response.data.results.results;
        results.forEach((item, i) => {
          if (i < 5) { // Show only first 5 results
            if (item.repository && item.file) {
              console.log(`\n- ${item.repository.name}: ${item.file.path}`);
              if (item.lineMatches) {
                item.lineMatches.slice(0, 2).forEach(match => {
                  console.log(`  Line ${match.lineNumber}: ${match.preview}`);
                });
              }
            }
          }
        });
        
        if (results.length > 5) {
          console.log(`\n... and ${results.length - 5} more results`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

testSimple();