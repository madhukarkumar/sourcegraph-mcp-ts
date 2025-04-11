# Sourcegraph MCP Server

A Model Context Protocol (MCP) server for accessing [Sourcegraph](https://sourcegraph.com/) search capabilities. This server exposes Sourcegraph's code, commit, and diff search functionality through the standardized [Model Context Protocol (MCP)](https://modelcontextprotocol.io) interface.

Implemented with the official [@modelcontextprotocol/sdk](https://npmjs.com/package/@modelcontextprotocol/sdk) TypeScript SDK.

## What is this MCP Server?

This server implements the Model Context Protocol (MCP) to enable AI models and other MCP-compatible clients to leverage Sourcegraph's powerful code search capabilities through a standardized interface. It acts as a bridge between AI tools and Sourcegraph's repositories.

### Features

- **Code Search**: Search for code across Sourcegraph repositories
- **Commit Search**: Find specific commits with filtering by author, message, and date
- **Diff Search**: Search for code changes (diffs) in pull/merge requests
- **Echo Tool**: Simple tool for testing connectivity
- **Debug Tool**: Introspect the server's available tools and methods
- **HTTP/SSE Transport**: Server exposes MCP interface over HTTP with Server-Sent Events

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- A [Sourcegraph](https://sourcegraph.com/) instance and API token

### Installing and Running Locally

1. Clone the repository or download the source code

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```bash
cp .env.example .env
```

4. Edit the `.env` file and add your Sourcegraph URL and API token:

```
SOURCEGRAPH_URL=https://your-instance.sourcegraph.com
SOURCEGRAPH_TOKEN=your_api_token
PORT=3001
MCP_PORT=3002  # Optional, defaults to 3002
```

5. Build the server:

```bash
npm run build
```

6. Start the MCP server:

```bash
npm run start:mcp
```

Alternatively, run the combined server (REST API + MCP):

```bash
npm start
```

The MCP server will run on port 3002 by default, while the main API server runs on port 3001 (or the PORT specified in your .env file).

### Testing Locally with MCP Inspector

1. Install MCP Inspector:
   - Clone the [MCP Inspector repository](https://github.com/modelcontextprotocol/inspector)
   - Follow the installation instructions in the repository

2. Run the MCP server:

```bash
npm run start:mcp
```

3. Open MCP Inspector and connect to `http://localhost:3002/sse`

4. Browse available tools and send test requests

You can also test using cURL:

```bash
# Connect to SSE endpoint
curl -N http://localhost:3002/sse

# Use the debug tool
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

## How to Use This MCP Server

### Claude Desktop Integration

1. Open Claude Desktop app
2. Go to Settings > MCP Servers
3. Click "Add Server"
4. Enter the server URL: `http://localhost:3002`
5. Click "Add"

Claude will automatically discover the tools provided by this MCP server.

### Other MCP Clients

Any client that supports the Model Context Protocol can connect to the server at `http://localhost:3002`.

## Available Tools

### Echo Tool

- **Name**: `echo`
- **Parameters**: `message` (string)
- **Returns**: A greeting with your message

**Example**:
```json
{
  "name": "echo",
  "parameters": {
    "message": "Hello, MCP!"
  }
}
```

### Search Code Tool

- **Name**: `search-code`
- **Parameters**:
  - `query` (string): The search query text
  - `type` (string, optional): Type of search - "file", "commit", or "diff" (default: "file")
- **Returns**: Matching code results from Sourcegraph

**Example**:
```json
{
  "name": "search-code",
  "parameters": {
    "query": "function example",
    "type": "file"
  }
}
```

### Search Commits Tool

- **Name**: `search-commits`
- **Parameters**:
  - `author` (string, optional): Filter by commit author
  - `message` (string, optional): Filter by commit message
  - `after` (string, optional): Filter for commits after this date (YYYY-MM-DD)
- **Returns**: Matching commits from Sourcegraph

**Example**:
```json
{
  "name": "search-commits",
  "parameters": {
    "author": "john",
    "message": "fix bug",
    "after": "2023-01-01"
  }
}
```

### Search Diffs Tool

- **Name**: `search-diffs`
- **Parameters**:
  - `query` (string, optional): Search query text
  - `author` (string, optional): Filter by commit author
  - `after` (string, optional): Filter for diffs after this date (YYYY-MM-DD)
- **Returns**: Matching diffs (code changes) from Sourcegraph

**Example**:
```json
{
  "name": "search-diffs",
  "parameters": {
    "query": "fix",
    "author": "john",
    "after": "2023-01-01"
  }
}
```

### Debug Tool

- **Name**: `debug`
- **Parameters**: none
- **Returns**: Information about available tools and methods

**Example**:
```json
{
  "name": "debug",
  "parameters": {}
}
```

## Troubleshooting

- If you get a "No active connections" error, make sure you have an active SSE connection
- Verify your Sourcegraph credentials in the .env file if you get API errors
- Check the server logs for detailed error messages

## License

MIT