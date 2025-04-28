"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const llm_1 = require("../services/llm");
const sourcegraph_2 = require("../services/sourcegraph");
const router = (0, express_1.Router)();
/**
 * Helper function that either calls LLM or uses direct query.
 */
async function buildFinalQuery(naturalOrDirectQuery, isDirect, defaultType) {
    let sgQuery = '';
    if (isDirect) {
        // We assume the user has provided a valid Sourcegraph query
        sgQuery = naturalOrDirectQuery.trim();
    }
    else {
        // Convert from natural language -> Sourcegraph syntax
        sgQuery = await (0, llm_1.convertQueryToSourcegraphSyntax)(naturalOrDirectQuery);
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
router.post('/code', async (req, res) => {
    try {
        const { query, directQuery = false } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Missing query field in request body' });
        }
        // Build or convert query for searching code (type:file)
        const finalQuery = await buildFinalQuery(query, directQuery, 'file');
        const results = await (0, sourcegraph_2.searchSourcegraph)(finalQuery);
        return res.json({ finalQuery, results });
    }
    catch (err) {
        console.error('Error in /search/code:', err);
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /search/commits
 * Body: { query: string, directQuery?: boolean }
 */
router.post('/commits', async (req, res) => {
    try {
        const { query, directQuery = false } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Missing query field in request body' });
        }
        // Build or convert query for searching commits (type:commit)
        const finalQuery = await buildFinalQuery(query, directQuery, 'commit');
        const results = await (0, sourcegraph_2.searchSourcegraph)(finalQuery);
        return res.json({ finalQuery, results });
    }
    catch (err) {
        console.error('Error in /search/commits:', err);
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /search/diffs
 * Body: { query: string, directQuery?: boolean }
 */
router.post('/diffs', async (req, res) => {
    try {
        const { query, directQuery = false } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Missing query field in request body' });
        }
        // Build or convert query for searching diffs (type:diff)
        const finalQuery = await buildFinalQuery(query, directQuery, 'diff');
        const results = await (0, sourcegraph_2.searchSourcegraph)(finalQuery);
        return res.json({ finalQuery, results });
    }
    catch (err) {
        console.error('Error in /search/diffs:', err);
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
