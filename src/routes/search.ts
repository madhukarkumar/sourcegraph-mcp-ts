import { Router, Request, Response } from 'express';
import { convertQueryToSourcegraphSyntax } from '../services/llm';
import { searchSourcegraph } from '../services/sourcegraph';

const router = Router();

/**
 * Helper function that either calls LLM or uses direct query.
 */
async function buildFinalQuery(naturalOrDirectQuery: string, isDirect: boolean, defaultType: string): Promise<string> {
  let sgQuery = '';
  if (isDirect) {
    // We assume the user has provided a valid Sourcegraph query
    sgQuery = naturalOrDirectQuery.trim();
  } else {
    // Convert from natural language -> Sourcegraph syntax
    sgQuery = await convertQueryToSourcegraphSyntax(naturalOrDirectQuery);
  }

  // If the query does not contain type:, append it
  // e.g. "repo:myorg/myrepo functionName"
  // We'll assume `defaultType` is something like 'file', 'commit', 'diff'
  if (!/\btype:\w+/.test(sgQuery)) {
    sgQuery += ` type:${defaultType}`;
  }

  // Ensure we get all results
  if (!/\bcount:/.test(sgQuery)) {
    sgQuery += ' count:all';
  }

  return sgQuery.trim();
}

/**
 * POST /search/code
 * Body: { query: string, directQuery?: boolean }
 */
router.post('/code', async (req: Request, res: Response) => {
  try {
    const { query, directQuery = false } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Missing query field in request body' });
    }

    // Build or convert query for searching code (type:file)
    const finalQuery = await buildFinalQuery(query, directQuery, 'file');
    const results = await searchSourcegraph(finalQuery);
    return res.json({ finalQuery, results });
  } catch (err: any) {
    console.error('Error in /search/code:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /search/commits
 * Body: { query: string, directQuery?: boolean }
 */
router.post('/commits', async (req: Request, res: Response) => {
  try {
    const { query, directQuery = false } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Missing query field in request body' });
    }

    // Build or convert query for searching commits (type:commit)
    const finalQuery = await buildFinalQuery(query, directQuery, 'commit');
    const results = await searchSourcegraph(finalQuery);
    return res.json({ finalQuery, results });
  } catch (err: any) {
    console.error('Error in /search/commits:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /search/diffs
 * Body: { query: string, directQuery?: boolean }
 */
router.post('/diffs', async (req: Request, res: Response) => {
  try {
    const { query, directQuery = false } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Missing query field in request body' });
    }

    // Build or convert query for searching diffs (type:diff)
    const finalQuery = await buildFinalQuery(query, directQuery, 'diff');
    const results = await searchSourcegraph(finalQuery);
    return res.json({ finalQuery, results });
  } catch (err: any) {
    console.error('Error in /search/diffs:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;