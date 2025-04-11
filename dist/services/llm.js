"use strict";
/**
 * LLM Integration Service
 * Handles communication with LLM providers for query translation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertQueryToSourcegraphSyntax = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// LLM configuration from environment
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-2';
/**
 * Convert a natural language query to Sourcegraph syntax
 * using an LLM provider (OpenAI or Anthropic)
 */
async function convertQueryToSourcegraphSyntax(naturalQuery) {
    try {
        // Select the appropriate LLM provider based on configuration
        switch (LLM_PROVIDER.toLowerCase()) {
            case 'openai':
                return await convertWithOpenAI(naturalQuery);
            case 'anthropic':
                return await convertWithAnthropic(naturalQuery);
            default:
                throw new Error(`Unsupported LLM provider: ${LLM_PROVIDER}`);
        }
    }
    catch (error) {
        console.error('Error converting query with LLM:', error.message);
        // Fall back to using the query directly with minimal processing
        return fallbackQueryConversion(naturalQuery);
    }
}
exports.convertQueryToSourcegraphSyntax = convertQueryToSourcegraphSyntax;
/**
 * Convert a query using OpenAI's API
 */
async function convertWithOpenAI(naturalQuery) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }
    const prompt = createOpenAIPrompt(naturalQuery);
    const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
        model: OPENAI_MODEL,
        messages: [
            {
                role: 'system',
                content: 'You are a specialized assistant that converts natural language queries into Sourcegraph search syntax.'
            },
            { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 100 // Limit response length since we only need the syntax
    }, {
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    // Extract the translated query from the response
    const translatedQuery = response.data.choices[0]?.message?.content?.trim();
    if (!translatedQuery) {
        throw new Error('Empty or invalid response from OpenAI');
    }
    return translatedQuery;
}
/**
 * Convert a query using Anthropic's API
 */
async function convertWithAnthropic(naturalQuery) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key not configured');
    }
    const prompt = createAnthropicPrompt(naturalQuery);
    const response = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
        model: ANTHROPIC_MODEL,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 100
    }, {
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        }
    });
    // Extract the translated query from the response
    const translatedQuery = response.data.content[0]?.text?.trim();
    if (!translatedQuery) {
        throw new Error('Empty or invalid response from Anthropic');
    }
    return translatedQuery;
}
/**
 * Create a detailed prompt for OpenAI
 */
function createOpenAIPrompt(naturalQuery) {
    return `
Convert the following natural language query into a Sourcegraph search query syntax.

Guidelines:
- Extract the key search terms
- Use appropriate Sourcegraph operators (repo:, type:, lang:, etc.)
- If specific repositories are mentioned, include them with repo: operator
- Don't include terms like "show me", "find", etc. in the translated query
- For code searches, use type:file or add specific language filters with lang:
- For commit searches, use type:commit and add author: or after: if specified
- For diff searches, use type:diff and add appropriate filters

Examples:
- "Find authentication code in the frontend" → "authentication frontend type:file"
- "Show commits by Jane from last week" → "author:Jane after:"1 week ago" type:commit"
- "Files using supabase for authentication" → "supabase authentication type:file"
- "Show all Java files with SQL queries" → "lang:java SQL type:file"
- "Find changes to the API in March" → "api after:2023-03-01 before:2023-04-01 type:diff"

Natural language query: ${naturalQuery}

Sourcegraph query: 
`;
}
/**
 * Create a detailed prompt for Anthropic
 */
function createAnthropicPrompt(naturalQuery) {
    return `
Convert the following natural language query into a Sourcegraph search query syntax.

Guidelines:
- Extract the key search terms
- Use appropriate Sourcegraph operators (repo:, type:, lang:, etc.)
- If specific repositories are mentioned, include them with repo: operator
- Don't include terms like "show me", "find", etc. in the translated query
- For code searches, use type:file or add specific language filters with lang:
- For commit searches, use type:commit and add author: or after: if specified
- For diff searches, use type:diff and add appropriate filters

Examples:
- "Find authentication code in the frontend" → "authentication frontend type:file"
- "Show commits by Jane from last week" → "author:Jane after:"1 week ago" type:commit"
- "Files using supabase for authentication" → "supabase authentication type:file"
- "Show all Java files with SQL queries" → "lang:java SQL type:file"
- "Find changes to the API in March" → "api after:2023-03-01 before:2023-04-01 type:diff"

Natural language query: ${naturalQuery}

Sourcegraph query: 
`;
}
/**
 * Simple fallback method if LLM translation fails
 */
function fallbackQueryConversion(naturalQuery) {
    // Remove common filler phrases
    const cleanedQuery = naturalQuery
        .replace(/^(show me|find|search for|look for|get|retrieve)\s+/i, '')
        .replace(/\b(all|the|those|any)\s+/g, '')
        .replace(/\s+(files?|code|results?)\s+/g, ' ')
        .replace(/\s+in\s+(the\s+)?repos?(itory)?\s+/g, ' repo:');
    // Default to file search if not specified
    if (!cleanedQuery.includes('type:')) {
        return `${cleanedQuery.trim()} type:file`;
    }
    return cleanedQuery.trim();
}
