#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running complete fix script...');

// 1. First, update the transpile.js script to include our new file
const transpilesPath = path.join(__dirname, 'transpile.js');
let transpileContent = fs.readFileSync(transpilesPath, 'utf8');

// Check if deep-research.ts is already in the filesToTranspile array
if (!transpileContent.includes('src/services/deep-research.ts')) {
  // Add deep-research.ts to the filesToTranspile array
  transpileContent = transpileContent.replace(
    /const filesToTranspile = \[(([\s\S])*?)\];/,
    (match, p1) => `const filesToTranspile = [${p1},\n  'src/services/deep-research.ts'\n];`
  );
  
  // Write the updated content
  fs.writeFileSync(transpilesPath, transpileContent);
  console.log('Added deep-research.ts to filesToTranspile in transpile.js');
}

// 2. Ensure mcp-server.js imports are correctly set up
const mcpServerPath = path.join(__dirname, '../dist/mcp-server.js');
if (fs.existsSync(mcpServerPath)) {
  let mcpServerContent = fs.readFileSync(mcpServerPath, 'utf8');
  
  // Fix the import for deep-research
  if (!mcpServerContent.includes("deep_research_1 = require('./services/deep-research')")) {
    mcpServerContent = mcpServerContent.replace(
      "const test_tools_1 = require(\"./test-tools\");",
      "const test_tools_1 = require(\"./test-tools\");\nconst deep_research_1 = require(\"./services/deep-research\");"
    );
    
    fs.writeFileSync(mcpServerPath, mcpServerContent);
    console.log('Fixed deep-research import in mcp-server.js');
  }
}

// 3. Now run the full build
console.log('\nRunning npm build...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// 4. Run the test script
console.log('\nRunning deep research test...');
try {
  execSync('node scripts/test-deep-research.js', { stdio: 'inherit' });
  console.log('Test completed successfully!');
} catch (error) {
  console.error('Test failed:', error);
  process.exit(1);
}

console.log('\nFix and verification completed successfully!');