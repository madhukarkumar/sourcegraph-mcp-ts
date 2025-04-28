#!/usr/bin/env node

/**
 * Test script for the deep-code-researcher tool using direct API calls
 */

const dotenv = require('dotenv');
const { performDeepCodeResearch } = require('../dist/services/deep-research');

// Load environment variables
dotenv.config();

async function testDeepResearch() {
  try {
    console.log('Testing deep-code-researcher directly...');
    
    // Validate Sourcegraph credentials
    const sgUrl = process.env.SOURCEGRAPH_URL;
    const sgToken = process.env.SOURCEGRAPH_TOKEN;
    
    if (!sgUrl || !sgToken) {
      console.error('Error: SOURCEGRAPH_URL or SOURCEGRAPH_TOKEN not set in environment');
      process.exit(1);
    }
    
    console.log(`Using Sourcegraph instance: ${sgUrl}`);
    console.log('Token available:', sgToken ? 'Yes (redacted)' : 'No');
    
    // Test parameters
    const params = {
      query: 'supabase',
      repo: 'madhukarkumar/open-canvas',
      language: '', // Optional language filter
      limit: 20,  // Number of results
      url: sgUrl,
      token: sgToken
    };
    
    console.log('\nTest parameters:', JSON.stringify(params, null, 2));
    console.log('\nCalling deep research service...');
    
    // Call the deep research service directly
    const result = await performDeepCodeResearch(params);
    
    if (result.isError) {
      console.error('Error response:', result.content[0].text);
    } else {
      console.log('Success! Got result with content length:', 
                 result.content[0].text.length);
      console.log('\nResult preview:');
      console.log(result.content[0].text.substring(0, 500) + '...');
    }
    
    return result;
  } catch (error) {
    console.error('Error in test:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
}

// Execute the test function
testDeepResearch()
  .then(() => {
    console.log('\nTest completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  });