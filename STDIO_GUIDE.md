# Using the STDIO MCP Server with MCP Inspector

## Troubleshooting Guide

If you're having issues connecting the MCP Inspector to the STDIO server, follow these steps:

### Step 1: Verify Server Script

First, run the simplified STDIO server script directly to verify it works:

```bash
node scripts/stdio-server.js
```

You should see output like:
```
Starting Simplified MCP Server with STDIO transport...
SOURCEGRAPH_URL: Set
SOURCEGRAPH_TOKEN: Set (redacted)
Connecting to STDIO transport...
Sourcegraph MCP Server running in STDIO mode
- Server is waiting for JSONRPC messages on stdin
- Tools available: echo, deep-code-researcher, debug
```

### Step 2: Configure MCP Inspector

1. Open MCP Inspector
2. Click "Add Connection"
3. Select "Process" as the connection type
4. Configure the connection:
   - **Command**: `node`
   - **Arguments**: Enter the FULL PATH to the script
     - Example: `/Users/yourname/sourcegraph/code/gitrepos/mcp_servers/sg-ts-mcp-server/scripts/stdio-server.js`
   - **Environment Variables**: (Optional) If needed, add `SOURCEGRAPH_URL` and `SOURCEGRAPH_TOKEN`

### Step 3: Test Connection

Once connected, try these tools:

1. Echo tool:
```json
{
  "name": "echo",
  "params": {
    "message": "Hello World"
  }
}
```

2. Debug tool (lists available tools):
```json
{
  "name": "debug",
  "params": {}
}
```

3. Deep Code Researcher tool:
```json
{
  "name": "deep-code-researcher",
  "params": {
    "query": "authentication",
    "repo": "supabase/supabase"
  }
}
```

### Common Issues

1. **Path Issues**: Ensure you're using the full, absolute path to the script
2. **Module Not Found**: If you get module errors, try installing dependencies globally: `npm install -g zod dotenv @modelcontextprotocol/sdk`
3. **Environment Variables**: Check that your .env file contains valid SOURCEGRAPH_URL and SOURCEGRAPH_TOKEN values

### Alternative: Use HTTP Mode

If STDIO mode continues to give issues, try using the HTTP mode instead:

1. Start the HTTP server: `npm run start:mcp`
2. In MCP Inspector, add a new connection using the URL: `http://localhost:3002/sse`