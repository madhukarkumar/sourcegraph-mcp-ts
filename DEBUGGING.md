# Debugging the MCP Server

## Testing MCP Tools

To test the MCP protocol tools specifically, you can use the MCP Inspector or create a direct connection to the MCP server. Here's how to do it:

### Option 1: Use MCP Inspector

1. Clone the MCP Inspector repository:
   ```bash
   git clone https://github.com/anthropics/mcp-inspector.git
   cd mcp-inspector
   npm install
   npm start
   ```

2. Open http://localhost:8080 in your browser

3. Connect to your MCP server:
   - Enter the URL: `http://localhost:3002`
   - Click "Connect"

4. Try the test tools first:
   - `test-connection`: Make sure your Sourcegraph connection works
   - `test-nl-search`: Test natural language parsing
   - `nl-search-help`: Get help on how to use natural language search

5. Then try the actual search tools:
   - `natural-search`: Try searching with natural language
   - `search-code`: Search with direct Sourcegraph syntax

### Option 2: Direct API Testing

If you don't want to use MCP protocol, test the direct API endpoint:

```bash
# Test with curl
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Find authentication code", "type":"natural"}'

# Or use the included test script
node simplest-test.js
```

## Common Issues and Solutions

### "No active connections" Error

This happens when trying to send a message without establishing a connection first. In MCP protocol, you must:

1. First establish a connection with `POST /connect`
2. Then send messages to that connection with `POST /messages`

Check that your connection ID is properly passed between requests.

### MCP Server Not Starting

If the MCP server doesn't start, check:

1. Make sure ports are available: `lsof -i :3002`
2. Check environment variables: `SOURCEGRAPH_URL` and `SOURCEGRAPH_TOKEN`
3. Look at server logs for other errors

### Sourcegraph API Errors

Test your Sourcegraph API connection directly:

```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://your-sourcegraph-instance/.api/graphql \
  -d '{"query":"query { currentUser { username } }"}'
```

### Natural Language Processing Issues

If natural language processing isn't working correctly:

1. Use the `test-nl-search` tool to see how the query is being parsed
2. Check your query structure - be specific about what you're looking for
3. Include repository names when possible to narrow the search

## Debugging Output

To get more debugging information, enable debug mode:

```bash
DEBUG=true node test-natural-search.js
```

This will output detailed information about API requests, responses, and error details.