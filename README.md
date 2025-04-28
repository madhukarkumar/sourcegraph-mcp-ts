# Sourcegraph MCP Server

A Model Context Protocol (MCP) server that allows AI assistants to search code repositories using natural language queries through the Sourcegraph API. The server also provides advanced code pattern research capabilities.

## Key Features

- **Natural Language Code Search**: Search using plain English queries
- **Code Search**: Search for code across Sourcegraph repositories
- **Commit Search**: Find commits with various filters
- **Diff Search**: Find code changes/PRs
- **GitHub-specific Search**: Search in specific GitHub repositories
- **Deep Code Research**: Analyze code patterns and architecture across repositories
- **Web Extraction**: Extract and analyze web content through FireCrawl integration

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

### Basic Tools

- `search-code`: Search code with Sourcegraph query syntax
- `search-commits`: Find commits with filters
- `search-diffs`: Find code changes/PRs
- `search-github-repos`: Search in specific GitHub repositories
- `natural-search`: Search using natural language
- `echo`: Simple test tool
- `debug`: Show available tools

### Advanced Tools

- `deep-code-researcher`: Conduct deep research on code patterns and architecture
- `firecrawl_scrape`: Extract content from web pages
- `firecrawl_search`: Search the web and extract results
- `firecrawl_extract`: Extract structured data from web content
- `firecrawl_deep_research`: Conduct deep web research with AI analysis

## Deep Code Researcher Tool

The `deep-code-researcher` tool provides comprehensive analysis of code patterns:

```json
{
  "name": "deep-code-researcher",
  "parameters": {
    "query": "authentication",
    "repo": "supabase/supabase",   // optional: specific repository
    "language": "typescript",     // optional: filter by language
    "limit": 30                   // optional: result limit (default: 20)
  }
}
```

This tool provides:
- Code findings with matching files and snippets
- Code pattern insights including key files and directories
- File type distribution analysis
- Development insights from related commits
- Contributor statistics and development timeline

## Natural Language Search

You can search code using natural language queries like:

- "Find all files that implement authentication"
- "Show me the error handling in the API code"
- "Find code that processes payment webhooks"
- "Look for filesystem operations in the server code"

The `natural-search` tool automatically converts these queries to Sourcegraph syntax.

## Web Content Extraction (FireCrawl Integration)

The server now includes FireCrawl integration for web content analysis:

- **Content Scraping**: Extract text and structured data from web pages
- **Web Search**: Search the web and analyze results
- **Deep Research**: Conduct multi-step research using web content
- **Structured Extraction**: Extract specific data points from web pages

## Troubleshooting

If you encounter issues:

1. **Environment Variables**: Ensure SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN are correctly set
2. **Connectivity**: Verify your Sourcegraph instance is accessible
3. **Tool Errors**: Use the `debug` tool to verify available tools

For detailed troubleshooting help, see the [DEBUGGING.md](./DEBUGGING.md) file.

## Project Structure

```
.
├── src/              - TypeScript source files
│   ├── index.ts     - Main Express server entry point
│   ├── mcp-server.ts - Model Context Protocol implementation
│   ├── http-server.ts - HTTP transport for MCP
│   └── stdio-server.ts - STDIO transport for MCP
├── scripts/         - Utility scripts for testing and development
├── dist/            - Compiled JavaScript output
└── archive/         - Archived files for reference
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