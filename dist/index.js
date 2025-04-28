"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_2 = __importDefault(require("dotenv"));
const search_1 = __importDefault(require("./routes/search"));
const api_1 = __importDefault(require("./routes/api"));
// Import the HTTP server directly instead of calling setup function
require("./http-server"); // This will start the MCP server when imported
dotenv_2.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Parse JSON request bodies
app.use(express_1.default.json());
// Mount the search router under /search
app.use('/search', search_1.default);
// Mount the API router under /api
app.use('/api', api_1.default);
// Basic health check
app.get('/', (req, res) => {
    res.send('Sourcegraph Multi-Search Server is running');
});
// Log config for debugging
console.log(`Config: SOURCEGRAPH_URL=${process.env.SOURCEGRAPH_URL?.substring(0, 10)}... LLM_PROVIDER=${process.env.LLM_PROVIDER}`);
// Start main API server
app.listen(port, () => {
    console.log(`Main API server listening on port ${port}`);
});
// The MCP server is automatically started when http-server.ts is imported
