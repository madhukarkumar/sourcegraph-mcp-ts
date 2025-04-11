/**
 * Direct Sourcegraph API Test Script
 * 
 * This script tests direct access to the Sourcegraph GraphQL API using
 * environment variables from your .env file. Run it with:
 * 
 * node direct-search.js
 */

const axios = require('axios');
require('dotenv').config();

async function directSourcegraphSearch() {
  console.log('Testing direct Sourcegraph API access...');
  
  const sgUrl = process.env.SOURCEGRAPH_URL;
  const sgToken = process.env.SOURCEGRAPH_TOKEN;
  
  console.log(`Using Sourcegraph URL: ${sgUrl?.substring(0, 15)}...`);
  console.log(`Using token: ${sgToken ? 'SET (redacted)' : 'NOT SET'}`);
  
  if (!sgUrl || !sgToken) {
    console.error('ERROR: SOURCEGRAPH_URL or SOURCEGRAPH_TOKEN not set in environment variables');
    process.exit(1);
  }
  
  try {
    const query = 'function type:file count:5';
    
    // The GraphQL query
    const graphqlQuery = `
      query CodeSearch($query: String!) {
        search(query: $query, version: V3) {
          results {
            matchCount
            results {
              __typename
              ... on FileMatch {
                repository { name }
                file { path }
                lineMatches {
                  lineNumber
                  preview
                }
              }
            }
          }
        }
      }
    `;
    
    // Headers for Sourcegraph API
    const headers = {
      'Authorization': `token ${sgToken}`,
      'Content-Type': 'application/json'
    };
    
    // Make the request to Sourcegraph API directly
    console.log(`Sending request to ${sgUrl}/.api/graphql...`);
    const response = await axios.post(
      `${sgUrl}/.api/graphql`,
      { query: graphqlQuery, variables: { query } },
      { headers }
    );
    
    if (response.data.errors) {
      console.error('Sourcegraph API returned errors:', response.data.errors);
      return;
    }
    
    // Log the results
    const results = response.data.data.search.results;
    console.log(`Found ${results.matchCount} matches`);
    
    results.results.forEach(item => {
      if (item.__typename === 'FileMatch') {
        console.log(`\nRepository: ${item.repository.name}`);
        console.log(`File: ${item.file.path}`);
        item.lineMatches.forEach(match => {
          console.log(`Line ${match.lineNumber}: ${match.preview}`);
        });
      }
    });
  
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

directSourcegraphSearch();