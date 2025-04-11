# Sourcegraph MCP Server

## Project Structure

```
.
u251cu2500u2500 src/
u2502   u251cu2500u2500 index.ts               - Main Express server initialization
u2502   u251cu2500u2500 mcp-server.ts           - Model Context Protocol (MCP) server implementation
u2502   u251cu2500u2500 http-server.ts          - HTTP server for MCP protocol
u2502   u251cu2500u2500 routes/
u2502   u2502   u2514u2500u2500 search.ts         - Routes for code, commit, and diff searches
u2502   u2514u2500u2500 services/
u2502       u2514u2500u2500 sourcegraph.ts     - Sourcegraph GraphQL client implementation
u251cu2500u2500 .env.example              - Template for environment variables
u251cu2500u2500 direct-search.js          - Utility to test Sourcegraph API directly
u251cu2500u2500 env-check.js              - Utility to verify environment variables
u251cu2500u2500 package.json              - Project dependencies
u251cu2500u2500 search-example.js         - Test script for testing the MCP server
u2514u2500u2500 tsconfig.json             - TypeScript configuration
```

## Key Features

- Code search across Sourcegraph repositories
- Commit search for finding specific commits
- Diff/PR search for code changes
- Model Context Protocol (MCP) integration

## Development Commands

- Install dependencies: `npm install`
- Build the project: `npm run build`
- Start the API server: `npm start`
- Start the MCP server: `npm run start:mcp`
- Test Sourcegraph API directly: `node direct-search.js`
- Test example search: `node search-example.js`

## Configuration

- Copy `.env.example` to `.env` and configure:
  - `SOURCEGRAPH_URL` - URL of your Sourcegraph instance
  - `SOURCEGRAPH_TOKEN` - API token for authentication
  - `PORT` - API server port (default: 3001)
  - MCP server runs on port 3002 by default

## MCP Client Integration

- Claude Desktop: Settings > MCP Servers > Add Server > http://localhost:3002
- MCP Inspector: Connect to http://localhost:3002
- Any MCP-compatible client: Point to the server URL http://localhost:3002

## Implementation Notes

- Uses @modelcontextprotocol/sdk TypeScript SDK
- Exposes Sourcegraph search through standardized MCP interface
- Server supports HTTP transport with Server-Sent Events