import { Router, Request, Response } from 'express';
import { createServer } from '../mcp-server';

const router = Router();
const mcpServer = createServer();

// Cast to allow access to invoke method
const server = mcpServer as any;

/**
 * POST /api/search
 * Body: { query: string, type?: string }
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, type = 'file' } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Natural language search is disabled
    if (type === 'natural') {
      return res.status(400).json({ error: 'Natural language search is disabled' });
    }
    
    // Handle standard search
    const result = await server.invoke('search-code', { query, type });
    return res.json(result);
  } catch (error: any) {
    console.error('Error in /api/search:', error);
    return res.status(500).json({ error: `Search failed: ${error.message || 'Unknown error'}` });
  }
});

/**
 * GET /api/tools - List available tools
 */
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const result = await server.invoke('debug', {});
    return res.json(result);
  } catch (error: any) {
    console.error('Error listing tools:', error);
    return res.status(500).json({ error: `Failed to list tools: ${error.message || 'Unknown error'}` });
  }
});

export default router;