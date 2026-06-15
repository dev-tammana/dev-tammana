import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const agentModel = {
  provider: groq,
  name: 'llama-3.3-70b-versatile',
};
