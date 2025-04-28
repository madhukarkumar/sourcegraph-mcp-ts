const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// We'll directly test against the HTTP server
async function testDeepCodeResearcher() {
  console.log('Testing deep-code-researcher tool with authentication in Supabase');
  console.log('-'.repeat(60));
  
  try {
    // Start the HTTP server in the background
    const serverProcess = require('child_process').spawn('node', ['dist/http-server.js'], {
      detached: true,
      stdio: 'ignore',
    });
    
    // Give the server time to start
    console.log('Starting HTTP server...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Make a request to the tool using curl
    console.log('Sending request to deep-code-researcher tool...');
    
    const requestBody = JSON.stringify({
      name: "deep-code-researcher",
      params: {
        query: "authentication",
        repo: "supabase/supabase",
        language: "typescript",
        limit: 10
      }
    });
    
    // Save request to a temporary file
    fs.writeFileSync('temp-request.json', requestBody);
    
    // Use curl to send the request (better than direct HTTP module because it handles SSE properly)
    try {
      console.log('Connecting to MCP server...');
      
      // First get a session ID by connecting to /sse
      const curl1 = execSync('curl -N http://localhost:3002/sse', { timeout: 2000 });
      console.log('Connected to SSE endpoint');
      
      // Now send a tool request
      const curl2 = execSync('curl -X POST -H "Content-Type: application/json" -d @temp-request.json http://localhost:3002/messages', {
        timeout: 30000
      });
      
      const response = curl2.toString();
      
      if (response.includes('authentication') && 
          (response.includes('Code Findings') || response.includes('Supabase'))) {
        console.log('✅ TEST PASSED: Received valid response from deep-code-researcher');
        console.log('\nPreview of results:');
        console.log('-'.repeat(60));
        console.log(response.substring(0, 500) + '...');
      } else {
        console.log('❌ TEST FAILED: Invalid response received');
        console.log('Response:', response);
      }
    } catch (e) {
      console.error('Error during curl request:', e.message);
      console.log('Try running the server manually with npm run start:mcp first');
    }
    
    // Clean up
    fs.unlinkSync('temp-request.json');
    
    // Kill the server
    try {
      process.kill(-serverProcess.pid, 'SIGINT');
    } catch (e) {
      console.log('Note: Server process may still be running, kill it manually if needed.');
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testDeepCodeResearcher().catch(console.error);