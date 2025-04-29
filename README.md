# Sourcegraph MCP Server

A Model Context Protocol (MCP) server that allows AI assistants to search code repositories using natural language queries through the Sourcegraph API. The server also provides advanced code pattern research capabilities.

## Key Features

- **Natural Language Code Search**: Search using plain English queries
- **Code Search**: Search for code across Sourcegraph repositories
- **Commit Search**: Find commits with various filters
- **Diff Search**: Find code changes/PRs
- **GitHub-specific Search**: Search in specific GitHub repositories
- **Deep Code Research**: Analyze code patterns and architecture across repositories

## Quick Start

### Installation & Usage

```bash
# Run directly with npx (simplest way)
npx sourcegraph-mcp-server

# Or install globally
npm install -g sourcegraph-mcp-server
sourcegraph-mcp-server
```

### Configuration

Create a `.env` file with your Sourcegraph credentials before running:

```
SOURCEGRAPH_URL=https://your-sourcegraph-instance.com
SOURCEGRAPH_TOKEN=your_api_token
```

## Using with MCP-Capable AI Assistants

### Claude Desktop App

1. In Claude Desktop, go to Settings > MCP Servers
2. Add MCP Server
   - For STDIO: Process: `npx -y sourcegraph-mcp-server`
   - For HTTP: URL: `http://localhost:3002`
3. Start using tools by typing "/tool" in Claude

### MCP Inspector (for testing)

npx @modelcontextprotocol/inspector node dist/stdio-server.js  

## Available Tools

### Basic Search Tools

- `search-code`: Search code with Sourcegraph query syntax
- `search-commits`: Find commits with filters
- `search-diffs`: Find code changes/PRs
- `search-github-repos`: Search in specific GitHub repositories

### Code Intelligence Tools

- `get-definition`: Find the definition of a symbol in code
- `get-references`: Find all references to a symbol
- `get-implementations`: Find implementations of interfaces or methods
- `get-hover-documentation`: Get documentation for a symbol
- `get-document-symbols`: List all symbols in a file

### Repository Tools

- `get-file-content`: Get the content of a file from a repository
- `get-file-blame`: Get git blame information for a file

### Security Tools

- `lookup-cve`: Search for CVEs affecting repositories or packages
- `lookup-package-vulnerability`: Check packages for vulnerabilities
- `search-exploits`: Find exploit code for known vulnerabilities
- `find-vendor-advisory`: Find vendor security advisories

### Utility Tools

- `test-connection`: Test connection to Sourcegraph API
- `echo`: Simple test tool
- `debug`: Show available tools

## Code Intelligence Features

Sourcegraph MCP Server provides access to advanced code intelligence features:

- **Symbol Navigation**: Jump to definitions and find references across repositories
- **Code Documentation**: Get hover documentation for functions, classes, and variables
- **Repository Analysis**: Examine file content and git blame history
- **Security Analysis**: Find vulnerabilities and security advisories

These tools help you understand codebases more efficiently by providing context about code symbols, relationships, and vulnerabilities.

## Advanced Search Syntax

Sourcegraph has a powerful search syntax you can use with the search tools:

- **Repository filtering**: `repo:^github\.com/owner/repo$`
- **Language filtering**: `lang:javascript`
- **File path filtering**: `file:\.js$`
- **Content filtering**: `content:"exact phrase"`
- **Boolean operators**: `term1 AND term2`, `term1 OR term2`, `term1 NOT term2`
- **Regular expressions**: `/pattern/`
- **Commit search**: `type:commit message:"fix bug" author:username`
- **Diff search**: `type:diff select:commit.diff.added term`



## Troubleshooting

If you encounter issues:

1. **Environment Variables**: Ensure SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN are correctly set
2. **Connectivity**: Verify your Sourcegraph instance is accessible
3. **Tool Errors**: Use the `debug` tool to verify available tools

For detailed troubleshooting help, see the [DEBUGGING.md](./DEBUGGING.md) file.

## Project Structure

```
.
├── src/                     - TypeScript source files
│   ├── index.ts             - Main Express server entry point
│   ├── mcp-server.ts        - Model Context Protocol implementation  
│   ├── mcp-server-debug.ts  - Debug version of MCP server
│   ├── mcp-server-connect.ts - Connection testing implementation
│   ├── http-server.ts       - HTTP transport for MCP
│   └── stdio-server.ts      - STDIO transport for MCP
├── scripts/                 - Utility scripts for testing and development
│   ├── debug-server.js      - Debug server utility
│   └── test-search.js       - Test search functionality
├── dist/                    - Compiled JavaScript output
├── docs/                    - Documentation files
└── .env.example             - Example environment configuration
```

## Running Manually (for Development)

```bash
# Clone the repository
git clone https://github.com/madhukarkumar/sg-ts-mcp-server.git
cd sg-ts-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Start the HTTP MCP server
npm run start:mcp

# Or start the STDIO server
npm run start:stdio
```

## License

MIT