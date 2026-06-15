import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const AGENT_MODEL = groq('llama-3.3-70b-versatile');
