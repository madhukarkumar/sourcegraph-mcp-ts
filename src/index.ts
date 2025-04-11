import express from 'express';
import dotenv from 'dotenv';
import searchRouter from './routes/search';
import apiRouter from './routes/api';
// Import the HTTP server directly instead of calling setup function
import './http-server'; // This will start the MCP server when imported

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON request bodies
app.use(express.json());

// Mount the search router under /search
app.use('/search', searchRouter);

// Mount the API router under /api
app.use('/api', apiRouter);

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