import { createOpenAI } from '@ai-sdk/openai';

const githubModels = createOpenAI({
  baseURL: 'https://models.inference.ai.azure.com',
  apiKey: process.env.GITHUB_TOKEN,
  compatibility: 'compatible',
});

export const AGENT_MODEL = githubModels.chat('gpt-4o-mini');
