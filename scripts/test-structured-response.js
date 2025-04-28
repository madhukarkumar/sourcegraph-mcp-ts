#!/usr/bin/env node

/**
 * Test script for verifying the structured JSON response of the deep-code-researcher tool
 */

const dotenv = require('dotenv');
const { performDeepCodeResearch } = require('../dist/services/deep-research');

// Load environment variables
dotenv.config();

async function testStructuredResponse() {
  try {
    console.log('Testing deep-code-researcher structured JSON response...');
    
    // Validate Sourcegraph credentials
    const sgUrl = process.env.SOURCEGRAPH_URL;
    const sgToken = process.env.SOURCEGRAPH_TOKEN;
    
    if (!sgUrl || !sgToken) {
      console.error('Error: SOURCEGRAPH_URL or SOURCEGRAPH_TOKEN not set in environment');
      process.exit(1);
    }
    
    console.log(`Using Sourcegraph instance: ${sgUrl}`);
    
    // Test parameters
    const params = {
      query: 'supabase',
      repo: 'madhukarkumar/open-canvas',
      language: '',
      limit: 20,
      url: sgUrl,
      token: sgToken
    };
    
    // Call the deep research service
    const result = await performDeepCodeResearch(params);
    
    // Check for JSON data in the text response
    const textContent = result.content[0].text;
    
    // Extract the JSON portion from the text
    const jsonMatch = textContent.match(/```json\n([\s\S]+?)\n```/);
    
    if (!jsonMatch || !jsonMatch[1]) {
      console.error('Error: No structured JSON data found in the response');
      process.exit(1);
    }
    
    // Parse the JSON data
    const structuredData = JSON.parse(jsonMatch[1]);
    
    console.log('\nStructured JSON response found!');
    
    console.log('\nStructured Response Summary:');
    console.log('----------------------------');
    console.log(`Query: ${structuredData.query}`);
    console.log(`Repository: ${structuredData.repo}`);
    console.log(`Language: ${structuredData.language}`);
    
    console.log('\nResults:');
    console.log(`- Code matches: ${structuredData.summary.codeMatchCount}`);
    console.log(`- Commit matches: ${structuredData.summary.commitMatchCount}`);
    console.log(`- Repositories found: ${structuredData.summary.repositoriesFound}`);
    
    // Show file findings
    if (structuredData.codeFindings && structuredData.codeFindings.length > 0) {
      console.log('\nCode Findings:');
      structuredData.codeFindings.slice(0, 3).forEach((file, index) => {
        console.log(`${index + 1}. ${file.path} (${file.matchCount} matches)`);
        if (file.snippets && file.snippets.length > 0) {
          console.log('   Sample matches:');
          file.snippets.slice(0, 2).forEach(snippet => {
            console.log(`   - Line ${snippet.lineNumber}: ${snippet.code.substring(0, 50)}...`);
          });
        }
      });
      
      if (structuredData.codeFindings.length > 3) {
        console.log(`   ... and ${structuredData.codeFindings.length - 3} more files`);
      }
    }
    
    // Show commit findings
    if (structuredData.commits && structuredData.commits.length > 0) {
      console.log('\nCommit Findings:');
      structuredData.commits.slice(0, 3).forEach((commit, index) => {
        console.log(`${index + 1}. ${commit.id} by ${commit.author}`);
        console.log(`   Message: ${commit.message.substring(0, 50)}...`);
      });
      
      if (structuredData.commits.length > 3) {
        console.log(`   ... and ${structuredData.commits.length - 3} more commits`);
      }
    }
    
    console.log('\nFull structured response:');
    console.log(JSON.stringify(structuredData, null, 2));
    
    return structuredData;
  } catch (error) {
    console.error('Error in test:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Execute the test function
testStructuredResponse()
  .then(() => {
    console.log('\nTest completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  });