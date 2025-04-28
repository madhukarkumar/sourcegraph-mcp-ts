"use strict";
/**
 * Helper script to debug MCP connection issues
 * Shows what happens during the connection process
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_2 = require("@modelcontextprotocol/sdk/server/mcp.js");
const zod_2 = require("zod");
const express_1 = __importDefault(require("express"));
const dotenv_2 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
// Load environment variables
dotenv_2.default.config();
// Create a minimal MCP server for testing
const server = new mcp_js_2.McpServer({
    name: "connection-test-server",
    version: "1.0.0",
    debug: true, // Enable debug mode
});
// Add a basic echo tool
server.tool("echo", "Simple echo tool", { message: zod_2.z.string().describe("Message to echo") }, async ({ message }) => ({
    content: [{ type: "text", text: `Echo: ${message}` }],
}));
// Create an HTTP server
const port = Number(process.env.CONNECTION_TEST_PORT || 3003);
const app = (0, express_1.default)();
// Configure Express app
app.use(express_1.default.json());
// Create HTTP server from Express
const httpServer = http_1.default.createServer(app);
// Start listening
httpServer.listen(port, () => {
    console.log(`MCP connection test server running at http://localhost:${port}`);
    console.log("Waiting for connections...");
});
// Output server started information
console.log("\nAvailable tools:");
console.log("- echo: Simple echo tool");
// Connection events can be logged with HTTP middleware
app.use((req, res, next) => {
    console.log(`\n[REQUEST] ${req.method} ${req.path}`);
    if (req.path === '/connect') {
        console.log('New connection attempt');
    }
    if (req.path === '/messages' && req.method === 'POST') {
        console.log('New message received');
    }
    next();
});
// Setup MCP server endpoints
app.post('/connect', (req, res) => {
    console.log('Connection request:', req.body);
    res.json({ connectionId: `test-${Date.now()}` });
});
app.post('/messages', (req, res) => {
    console.log('Message received:', req.body);
    // Handle echo tool
    if (req.body?.content?.methodCall?.method === 'tools/invoke' &&
        req.body?.content?.methodCall?.params?.name === 'echo') {
        const message = req.body.content.methodCall.params.params.message;
        res.json({
            methodResult: {
                return: {
                    content: [
                        { type: 'text', text: `Echo: ${message}` }
                    ]
                }
            }
        });
    }
    else {
        res.json({ error: 'Unknown request' });
    }
});
// Add error handling
process.on('uncaughtException', (error) => {
    console.error("\n[SERVER ERROR]", error);
});
