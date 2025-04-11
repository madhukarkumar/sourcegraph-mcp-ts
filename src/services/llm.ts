import axios from 'axios';

const provider = process.env.LLM_PROVIDER || 'openai';
const openAiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openAiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
const anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-2';

/**
 * Convert a natural language query into a valid Sourcegraph search query.
 * This is a simplistic approach using either OpenAI or Anthropic.
 */
export async function convertQueryToSourcegraphSyntax(naturalQuery: string): Promise<string> {
  // If no LLM provider is configured, return the query as is with a basic transformation
  if (!process.env.LLM_PROVIDER || (!openAiKey && !anthropicKey)) {
    console.log('No LLM provider configured, returning simplified query');
    return `${naturalQuery}`;
  }

  if (!provider || provider === 'openai') {
    return convertQueryWithOpenAI(naturalQuery);
  } else if (provider === 'anthropic') {
    return convertQueryWithAnthropic(naturalQuery);
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

async function convertQueryWithOpenAI(naturalQuery: string): Promise<string> {
  if (!openAiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  const headers = {
    'Authorization': `Bearer ${openAiKey}`,
    'Content-Type': 'application/json'
  };
  const body = {
    model: openAiModel,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that turns natural language into Sourcegraph search queries. Provide only the query.'
      },
      {
        role: 'user',
        content: `Convert the following natural language into a Sourcegraph code search query:\n\n"${naturalQuery}"`
      }
    ],
    temperature: 0
  };

  const response = await axios.post(apiUrl, body, { headers });
  const assistantMessage = response.data.choices[0].message.content;
  return assistantMessage.trim();
}

async function convertQueryWithAnthropic(naturalQuery: string): Promise<string> {
  if (!anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const apiUrl = 'https://api.anthropic.com/v1/complete';
  const headers = {
    'x-api-key': anthropicKey,
    'Content-Type': 'application/json'
  };
  // Build a prompt that instructs the AI to output only the query
  const prompt = `\n\nHuman: Convert this natural language into a Sourcegraph code search query:\n\n"${naturalQuery}"\n\nAssistant:`;
  const body = {
    model: anthropicModel,
    prompt,
    max_tokens_to_sample: 100,
    temperature: 0,
    stop_sequences: ["\n\nHuman:"]
  };

  const response = await axios.post(apiUrl, body, { headers });
  const completion = response.data.completion as string;
  return completion.trim();
}