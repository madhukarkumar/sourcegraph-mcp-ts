#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Make sure the script is executable
fs.chmodSync(path.join(__dirname, 'stdio-server.js'), '755');

// Log publishing steps
console.log('Preparing to publish sourcegraph-mcp-server to npm');
console.log('1. Running build script');

try {
  // Build the project
  execSync('npm run build', { stdio: 'inherit' });
  
  // Create or update .npmignore to exclude unnecessary files
  const npmignore = `
# Source files (since we're publishing the compiled version)
src/

# Dev configs
tsconfig.json
.env
.env.example

# Tests
*.test.js
*.spec.js
test/

# Development scripts
scripts/transpile.js
scripts/fix-*.js
direct-search.js
env-check.js
search-example.js

# Git files
.git/
.gitignore

# Docs that don't need to be in the package
DEBUGGING.md
FIXED_MCP_INSPECTOR.md

# Build artifacts
dist/test
dist/*/test

# Backup files
*.backup
*.bak
  `;
  
  fs.writeFileSync('.npmignore', npmignore.trim());
  console.log('2. Created .npmignore file');
  
  // Create a README for npm that references the GitHub repo
  const npmReadme = `# Sourcegraph MCP Server with Natural Language Search

Model Context Protocol (MCP) server that allows AI assistants to search code repositories using natural language queries through the Sourcegraph API.

## Key Features

- Natural Language Code Search: Search using plain English queries
- Deep Code Research: Advanced pattern analysis across repositories
- Commit Search & Analysis: Find and analyze commits with various filters
- GitHub-specific Search: Search in specific GitHub repositories

## Quick Start

\`\`\`bash
# Install globally
npm install -g sourcegraph-mcp-server

# Run via npx
npx sourcegraph-mcp-server
\`\`\`

For full documentation and options, visit the GitHub repository:
https://github.com/madhukarkumar/sg-ts-mcp-server
  `;
  
  // Save the npm README temporarily
  fs.writeFileSync('README.npm.md', npmReadme);
  const originalReadme = fs.readFileSync('README.md');
  fs.writeFileSync('README.md', npmReadme);
  console.log('3. Created temporary npm README');
  
  // Run npm publish
  console.log('4. Publishing package to npm...');
  execSync('npm publish --access public', { stdio: 'inherit' });
  
  // Restore original README
  fs.writeFileSync('README.md', originalReadme);
  console.log('5. Restored original README');
  
  console.log('\nSuccessfully published sourcegraph-mcp-server to npm!');
  console.log('Users can now run: npx sourcegraph-mcp-server');
} catch (error) {
  console.error('Error during publishing:', error);
  process.exit(1);
}