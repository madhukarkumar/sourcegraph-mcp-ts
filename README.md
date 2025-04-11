# Sourcegraph MCP Server

A Model Context Protocol (MCP) server for accessing [Sourcegraph](https://sourcegraph.com/) search capabilities. This server exposes Sourcegraph's code, commit, and diff search functionality through the standardized [Model Context Protocol (MCP)](https://modelcontextprotocol.io) interface.

Implemented with the official [@modelcontextprotocol/sdk](https://npmjs.com/package/@modelcontextprotocol/sdk) TypeScript SDK.

## Features

- **Code Search**: Search for code across Sourcegraph repositories
- **Commit Search**: Search for specific commits with filtering by author, message, and date
- **Diff Search**: Search for code changes (diffs) in pull/merge requests
- **HTTP/SSE Transport**: Server exposes MCP interface over HTTP with Server-Sent Events

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- A [Sourcegraph](https://sourcegraph.com/) instance and API token

## Quick Start

1. Clone the repository or download the source code

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Sourcegraph URL and API token:

```
SOURCEGRAPH_URL=https://your-instance.sourcegraph.com
SOURCEGRAPH_TOKEN=your_api_token
PORT=3001
```

4. Build the server:

```bash
npm run build
```

5. Start the MCP server:

```bash
npm run start:mcp
```

The MCP server will run on port 3002 by default, while the main API server can be started with `npm start` and runs on port 3001 (or the PORT specified in your .env file).

## Connecting to MCP Clients

This MCP server can be used with any MCP-compatible client. Here's how to connect to it:

### Claude Desktop

1. Open Claude Desktop app
2. Go to Settings > MCP Servers
3. Click "Add Server"
4. Enter the server URL: `http://localhost:3002`
5. Click "Add"

Claude will automatically discover the tools provided by this MCP server.

### MCP Inspector

To test the server with [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

1. Install MCP Inspector
2. Run MCP Inspector and connect to `http://localhost:3002`
3. Explore available tools and test functionality

### Other MCP Clients

Any client that supports the Model Context Protocol can connect to the server at `http://localhost:3002`.

## Available Search Tools

The server exposes the following MCP tools:

### search-code

Search for code across repositories.

**Parameters:**
- `query`: The search query string
- `type`: Optional search type (file, commit, diff). Default: file

### search-commits

Search for commits in repositories.

**Parameters:**
- `author`: Optional: filter by commit author
- `message`: Optional: filter by commit message
- `after`: Optional: filter for commits after a specific date (YYYY-MM-DD)

### search-diffs

Search for code changes (diffs) in repositories.

**Parameters:**
- `query`: Optional: the search query string
- `author`: Optional: filter by commit author
- `after`: Optional: filter for diffs after a specific date (YYYY-MM-DD)

## Testing

You can test the MCP server using the included test script:

```bash
node search-example.js
```

This will connect to the MCP server and test the available tools.

You can also test direct access to the Sourcegraph API:

```bash
node direct-search.js
```

## License

MIT