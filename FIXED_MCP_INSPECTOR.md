# How to Fix MCP Inspector Issues

## Problem Analysis

The issues you encountered with MCP Inspector are related to console logging conflicting with the JSON response structure in the MCP protocol. When you see errors like:

```
Error from MCP server: SyntaxError: Unexpected token 'A', "Adding tes"... is not valid JSON
```

This happens because console.log() outputs are being interleaved with the JSON responses, breaking the parser.

## Solution Implemented

I've made several changes to fix these issues:

1. **Removed console.log statements** from critical paths in the server
2. **Disabled debug mode** in the production MCP server
3. **Created a separate debug server** for development
4. **Fixed error handling** in the SSE connection management

## How to Test Now

### Option 1: Use the Fixed Production Server

The main MCP server no longer outputs debug statements that break the JSON protocol:

```bash
# Build the project
npm run build

# Start the server
npm run start:mcp
```

Now connect to it with MCP Inspector at http://localhost:3002.

### Option 2: Use the Debug Server for Testing (RECOMMENDED)

For testing, use the simple debug server that responds to MCP requests without breaking JSON format:

```bash
# Run the debug server on port 3003
node scripts/debug-server.js
```

This debug server logs all requests and responses clearly in the console, making it easier to debug issues.

## Testing the Natural Language Tools

Now you can test the natural language search tools in MCP Inspector:

1. First try the **test-connection** tool to verify your Sourcegraph API credentials
2. Then try the **test-nl-search** tool with a query like "Find authentication code"
3. Finally use the actual **natural-search** tool to perform a real search

### Option 3: Direct API Testing

For the most reliable approach, test the direct API endpoint:

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Find authentication code", "type":"natural"}'
```

## MCP Inspector Connection Tips

1. Make sure the server is running first (`npm run start:mcp` or `node scripts/debug-server.js`)
2. When connecting MCP Inspector, use the exact URL (`http://localhost:3002` or `http://localhost:3003`)
3. In the MCP Inspector interface, try these tools in order:
   * **`echo`**: Simple message test ("Hello World")
   * **`test-nl-search`**: Try "Find authentication code"
   * **`test-connection`**: Test Sourcegraph connectivity
   * Only then try **`natural-search`**

## Common Problems and Fixes

- **"No active connections"**: The MCP server requires a connection ID, make sure the `/connect` request completed successfully
- **JSON parse errors**: Check the server console for unexpected console.log outputs
- **Headers already sent errors**: These happen when a response is attempted after the headers have already been sent