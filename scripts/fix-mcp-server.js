#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Update the transpile.js script to handle string literal issues
try {
  const transpilesPath = path.join(__dirname, 'transpile.js');
  const content = fs.readFileSync(transpilesPath, 'utf8');
  
  // Check if we already added the fix
  if (content.includes('fixStdioServer')) {
    console.log('transpile.js already contains fixes');
    process.exit(0);
  }
  
  // Add function to fix stdio-server.js at the end of the file, before the final console.log
  const updatedContent = content.replace(
    "console.log('\\nBuild completed successfully!');",
    `// Fix stdio-server.js string literals
fixStdioServer();

console.log('\\nBuild completed successfully!');

// Function to fix string literal issues in stdio-server.js
function fixStdioServer() {
  try {
    const stdioServerPath = path.join('dist', 'stdio-server.js');
    if (fs.existsSync(stdioServerPath)) {
      const content = fs.readFileSync(stdioServerPath, 'utf8');
      const fixedContent = content
        .replace(
          /console\.error\('Failed to start MCP server,.*\);/,
          "console.error('Failed to start MCP server:', error instanceof Error ? error.message : error);"
        )
        .replace(
          /console\.error\('Fatal error in main\(\),.*\);/,
          "console.error('Fatal error in main():', error instanceof Error ? error.message : error);"
        );
      fs.writeFileSync(stdioServerPath, fixedContent);
      console.log('Fixed string literals in stdio-server.js');
    }
  } catch (error) {
    console.error('Error fixing stdio-server.js:', error);
  }
}`
  );
  
  fs.writeFileSync(transpilesPath, updatedContent);
  console.log('Updated transpile.js to automatically fix stdio-server.js');
} catch (error) {
  console.error('Error updating transpile.js:', error);
}