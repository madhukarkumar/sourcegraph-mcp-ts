# Sourcegraph MCP Server with Natural Language Search

## Overview

A Model Context Protocol (MCP) server that allows AI assistants to search code repositories using natural language (plain English) queries through the Sourcegraph API.

## Key Features

- **Natural Language Code Search**: Search using plain English queries with LLM-powered translation
- **Code Search**: Search for code across Sourcegraph repositories
- **Commit Search**: Find commits with various filters
- **Diff Search**: Find code changes/PRs
- **GitHub-specific Search**: Search in specific GitHub repositories
- **LLM-Powered Query Translation**: Uses OpenAI or Anthropic to translate natural language to Sourcegraph syntax

## How to Search with Natural Language

You can search code using plain English in several ways:

### Using MCP Tools (for AI assistants)

1. Connect to the MCP server at http://localhost:3002
2. Use the `natural-search` tool with a query parameter:
   ```json
   {
     "name": "natural-search",
     "params": {
       "query": "find all files that have stdio related code"
     }
   }
   ```

### Using the Debug Server (for testing)

1. Start the debug server: `npm run debug-server`
2. Connect MCP Inspector to http://localhost:3003
3. Try the `test-nl-search` tool with a natural language query

### Using the Direct API (for applications)

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"find all files that have stdio related code", "type":"natural"}'
```

## Natural Language Query Examples

- **Code search**: "Find all files that have stdio related code"
- **Feature search**: "Show me authentication code in the frontend"
- **Author search**: "Find commits by Jane from last week"
- **Date-based search**: "What changes were made to the API in March?"
- **Repository-specific**: "Look for database files in the sourcegraph repository"

## Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/sourcegraph-mcp-server.git
cd sourcegraph-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
SOURCEGRAPH_URL=https://your-sourcegraph-instance.com
SOURCEGRAPH_TOKEN=your_api_token
PORT=3001
MCP_PORT=3002

# LLM configuration for natural language processing
LLM_PROVIDER=openai       # Can be 'openai' or 'anthropic'
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o      # Default model to use, gpt-3.5-turbo also works
# ANTHROPIC_API_KEY=your_anthropic_key  # For using Claude instead
# ANTHROPIC_MODEL=claude-2   # Default Anthropic model
```

## Running the Server

```bash
# Start the API server (for direct API access)
npm start

# Start the MCP server (for integration with AI assistants)
npm run start:mcp

# Start the debug server (for MCP protocol testing)
npm run debug-server

# Test natural language search functionality
npm run test-search "find authentication code in React components"
```

## Testing with MCP Inspector

To test the server using the [MCP Inspector](https://github.com/anthropics/mcp-inspector/):

1. First, start the debug server: `npm run debug-server`
2. Open the MCP Inspector and connect to: `http://localhost:3003`
3. Try the tools in this order:

   * **`echo`** with message "Hello World" (to test basic connectivity)
   * **`test-nl-search`** with "find stdio code" (to test language parsing)
   * **`test-connection`** (to verify Sourcegraph connection)

4. For the full MCP server, connect to http://localhost:3002 and use:
   * **`natural-search`** with your plain English query

## API Endpoints

The server provides direct API endpoints:

- **`POST /api/search`**: Natural language search
  ```json
  {
    "query": "find stdio related code",
    "type": "natural"
  }
  ```

- **`POST /search/code`**: Search for code (with auto-conversion from natural language)
  ```json
  {
    "query": "find stdio related code",
    "directQuery": false
  }
  ```

## Available MCP Tools

- **`natural-search`**: Search using natural language
- **`search-code`**: Search for code with direct query
- **`search-commits`**: Search for commits
- **`search-diffs`**: Search for code changes
- **`search-github-repos`**: Search in specific GitHub repositories
- **`test-nl-search`**: Test natural language parsing
- **`test-connection`**: Test Sourcegraph connection
- **`nl-search-help`**: Get help for natural language search
- **`echo`**: Simple echo tool for testing
- **`debug`**: Show available tools

## Debugging and Troubleshooting

See [FIXED_MCP_INSPECTOR.md](./FIXED_MCP_INSPECTOR.md) for detailed troubleshooting guidelines for MCP connection issues.

- **API Connection**: Test basic Sourcegraph connectivity with the `test-connection` tool
- **MCP Issues**: Run the debug server for clear logging of all requests and responses
- **Query Conversion**: Use `test-nl-search` to see how queries are interpreted

### Testing with mcp-inspector

-- ``` mcp-inspectpor   ```

Transport Type

-- STDIO

Command
-- ```node```

Arguments

-- ```your-path/dist/stdio-server.js```
