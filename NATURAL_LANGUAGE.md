# Natural Language Search with Sourcegraph MCP Server

## Overview

The Sourcegraph MCP Server now supports intelligent natural language search using LLM-based query translation. This feature translates plain English queries into Sourcegraph search syntax, making it much easier to find relevant code without knowing the exact syntax.

## How It Works

1. You provide a natural language query like "find all files that have stdio related code"
2. The query is sent to an LLM (OpenAI GPT-4o by default) with a specialized prompt
3. The LLM analyzes your query and converts it to proper Sourcegraph syntax
4. The resulting structured query is executed against the Sourcegraph API
5. Results are formatted in a human-readable way

## Usage Examples

| Natural Language Query | Converted Sourcegraph Query |
|------------------------|-----------------------------|
| "Find all files that have stdio related code" | `stdio type:file` |
| "Show authentication code in the frontend" | `authentication frontend type:file` |
| "Find commits by Jane from last week" | `author:Jane after:"1 week ago" type:commit` |
| "Look for database connection files" | `database connection type:file` |
| "Show PRs related to API changes" | `API type:diff` |

## Using the Natural Language Search

### MCP Tools for AI Assistants

```json
{
  "name": "natural-search",
  "params": {
    "query": "find files using supabase for authentication"
  }
}
```

### Direct API for Applications

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"find files using supabase for authentication", "type":"natural"}'
```

## Testing the Query Translator

You can see how your query is being translated without actually performing a search:

```json
{
  "name": "test-nl-search",
  "params": {
    "query": "files where authentication is handled in the frontend"
  }
}
```

This will show you both the original query and how it gets translated to Sourcegraph syntax.

## Configuration

The LLM translation settings can be configured in your `.env` file:

```
LLM_PROVIDER=openai      # 'openai' or 'anthropic'
OPENAI_API_KEY=your_key  # Only needed if using OpenAI
OPENAI_MODEL=gpt-4o      # Model to use with OpenAI

ANTHROPIC_API_KEY=your_key  # Only needed if using Anthropic
ANTHROPIC_MODEL=claude-2    # Model to use with Anthropic
```

## Query Tips

1. Be specific about what you're looking for
2. Mention repository names when possible: "in the sourcegraph repository"
3. Include file types when relevant: "Java files with..."
4. For commits, mention author names and timeframes
5. For diffs/PRs, mention what kind of changes you're looking for

## Fallback Mechanism

If the LLM-based translation fails for any reason (API issue, network error, etc.), the system will fall back to the rule-based parsing which was the original implementation.

## Implementation Details

The LLM-based translation is implemented in the following files:

- `src/services/llm.ts` - Main LLM integration service
- `src/utils/formatter.ts` - Enhanced query analysis with LLM support
- `src/services/natural-language.ts` - Natural language search service

The implementation aims to be provider-agnostic, supporting both OpenAI and Anthropic APIs.