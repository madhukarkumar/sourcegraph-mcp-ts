#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the file
const filePath = path.join(__dirname, '../dist/stdio-server.js');

// Fix the file
try {
  // Read current content
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the error handling string literals
  const fixedContent = content
    .replace(
      "console.error('Failed to start MCP server, error instanceof Error ? error.message );", 
      "console.error('Failed to start MCP server:', error instanceof Error ? error.message : error);"
    )
    .replace(
      "console.error('Fatal error in main(), error instanceof Error ? error.message );", 
      "console.error('Fatal error in main():', error instanceof Error ? error.message : error);"
    );
  
  // Write the fixed content
  fs.writeFileSync(filePath, fixedContent);
  console.log('Successfully fixed dist/stdio-server.js');
} catch (error) {
  console.error('Error fixing dist/stdio-server.js:', error);
}