# Sourcegraph MCP Server

## Project Structure

```
.
├── src/
│   ├── index.ts               - Main Express server initialization
│   ├── mcp-server.ts          - Model Context Protocol (MCP) server implementation
│   ├── http-server.ts         - HTTP server for MCP protocol
│   ├── stdio-server.ts        - STDIO transport for MCP protocol
│   ├── routes/
│   │   └── search.ts          - Routes for code, commit, and diff searches
│   └── services/
│       └── sourcegraph.ts     - Sourcegraph GraphQL client implementation
├── .env.example               - Template for environment variables
├── direct-search.js           - Utility to test Sourcegraph API directly
├── env-check.js               - Utility to verify environment variables
├── package.json               - Project dependencies and binary definition
├── search-example.js          - Test script for testing the MCP server
└── tsconfig.json              - TypeScript configuration
```

## Key Features

- Code search across Sourcegraph repositories
- Commit search for finding specific commits
- Diff/PR search for code changes
- GitHub repo-specific searching
- Model Context Protocol (MCP) integration with support for HTTP and STDIO transport

## Development Commands

- Install dependencies: `npm install`
- Build the project: `npm run build`
- Start the API server: `npm start`
- Start the HTTP MCP server: `npm run start:mcp`
- Start the STDIO MCP server: `npm run start:stdio`
- Test Sourcegraph API directly: `node direct-search.js`
- Test example search: `node search-example.js`
- Install globally: `npm install -g .` (for testing npx functionality)

## Configuration

- Copy `.env.example` to `.env` and configure:
  - `SOURCEGRAPH_URL` - URL of your Sourcegraph instance
  - `SOURCEGRAPH_TOKEN` - API token for authentication
  - `PORT` - API server port (default: 3001)
  - `MCP_PORT` - HTTP MCP server port (default: 3002)

## MCP Client Integration

### HTTP Transport
- Claude Desktop: Settings > MCP Servers > Add Server > http://localhost:3002
- MCP Inspector: Connect to http://localhost:3002/sse
- Any MCP-compatible client: Point to the server URL http://localhost:3002

### STDIO Transport
- Claude Desktop: Settings > MCP Servers > Add Process > npx -y sourcegraph-mcp-server
- Environment variables must be set in the process configuration

## Available Tools

- `echo` - Simple echo tool for testing
- `search-code` - Search for code across all repositories
- `search-commits` - Find commits with filters by author, message, or date
- `search-diffs` - Find code changes in PRs/commits
- `search-github-repos` - Search specific GitHub repositories
- `debug` - List available tools and methods

## Implementation Notes

- Uses @modelcontextprotocol/sdk TypeScript SDK v1.9.0
- Exposes Sourcegraph search through standardized MCP interface
- Server supports HTTP transport with Server-Sent Events
- Server supports STDIO transport for direct process communication
- Can be installed as a global command with npm