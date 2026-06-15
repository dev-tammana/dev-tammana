import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const fetchWebPageTool = createTool({
  id: 'fetch-web-page',
  description: 'Fetches HTML text content from a public URL to gather context or read information from the web.',
  inputSchema: z.object({
    url: z.string().url().describe('The absolute URL of the web page to fetch'),
  }),
  execute: async ({ url }) => {
    try {
      // Basic fetch timeout handling
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      
      const text = await response.text();
      // Strip scripts and styles for clean token optimization
      const cleanText = text
        .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
        .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return { 
        content: cleanText.substring(0, 4000), 
        status: 'success',
        url 
      };
    } catch (error) {
      return { 
        error: (error as Error).message || 'Failed to fetch webpage', 
        status: 'error' 
      };
    }
  }
});
