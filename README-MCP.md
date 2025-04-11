# Sourcegraph MCP Server

This is a Model Context Protocol (MCP) server for interacting with Sourcegraph through a standardized interface. It provides tools for searching code, commits, and diffs in your Sourcegraph instance.

## Features

- **Code Search**: Search for code across all your repositories
- **Commit Search**: Find commits by author, message, or date
- **Diff Search**: Locate code changes across your codebase
- **Echo Tool**: Simple echo tool for testing connectivity
- **Debug Tool**: Introspect the server's available tools and methods

## Setup

1. Make sure you have a `.env` file with your Sourcegraph credentials:

```
SOURCEGRAPH_URL=https://your-sourcegraph-instance.com
SOURCEGRAPH_TOKEN=your-sourcegraph-token
MCP_PORT=3002  # Optional, defaults to 3002
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Running the Server

You can run either the combined server (REST API + MCP) or just the MCP server:

### Combined Server

```bash
npm start
```

This starts both the REST API (default port 3000) and the MCP server (default port 3002).

### MCP Server Only

```bash
npm run start:mcp
```

This only starts the MCP server on port 3002 (or the port specified in your .env file as MCP_PORT).

## Testing with cURL

1. Start the server:

```bash
npm run start:mcp
```

2. Open a terminal and connect to the SSE endpoint:

```bash
curl -N http://localhost:3002/sse
```

This will return a response like:

```
event: endpoint
data: /messages?sessionId=YOUR_SESSION_ID
```

3. In another terminal, try the debug tool to see available functionality:

```bash
curl -X POST \
  "http://localhost:3002/messages?sessionId=YOUR_SESSION_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/invoke",
    "params": {
      "name": "debug",
      "parameters": {}
    }
  }'
```

4. Try the code search tool:

```bash
curl -X POST \
  "http://localhost:3002/messages?sessionId=YOUR_SESSION_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/invoke",
    "params": {
      "name": "search-code",
      "parameters": {
        "query": "function example",
        "type": "file"
      }
    }
  }'
```

## Testing with MCP Inspector

You can use the MCP Inspector tool to test your server visually:

1. Open the MCP Inspector
2. Connect to http://localhost:3002/sse
3. Browse available tools and send test requests

## Available Tools

### Echo Tool

- Name: `echo`
- Parameters: `message` (string)
- Returns a greeting with your message

### Search Code Tool

- Name: `search-code`
- Parameters:
  - `query` (string): The search query text
  - `type` (string, optional): Type of search - "file", "commit", or "diff" (default: "file")
- Returns matching code results from Sourcegraph

### Search Commits Tool

- Name: `search-commits`
- Parameters:
  - `author` (string, optional): Filter by commit author
  - `message` (string, optional): Filter by commit message
  - `after` (string, optional): Filter for commits after this date (YYYY-MM-DD)
- Returns matching commits from Sourcegraph

### Search Diffs Tool

- Name: `search-diffs`
- Parameters:
  - `query` (string, optional): Search query text
  - `author` (string, optional): Filter by commit author
  - `after` (string, optional): Filter for diffs after this date (YYYY-MM-DD)
- Returns matching diffs (code changes) from Sourcegraph

### Debug Tool

- Name: `debug`
- Parameters: none
- Returns information about available tools and methods

## Troubleshooting

- If you get a "No active connections" error, make sure you have an active SSE connection
- Verify your Sourcegraph credentials in the .env file if you get API errors
- Check the server logs for detailed error messages