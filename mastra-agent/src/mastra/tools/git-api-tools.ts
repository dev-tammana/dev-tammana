import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Config loaded from environment variables
const getGitConfig = () => {
  return {
    token: process.env.GITHUB_TOKEN || process.env.GOOGLE_API_KEY || '', // Fallback or user placeholder
    owner: process.env.GIT_REPO_OWNER || 'Chief-Strategist-J',
    repo: process.env.GIT_REPO_NAME || 'demo-factorial-module',
    defaultBranch: process.env.GIT_DEFAULT_BRANCH || 'main',
  };
};

const makeGithubRequest = async (path: string, options: RequestInit = {}) => {
  const { token } = getGitConfig();
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Mastra-Agent',
    ...(token ? { 'Authorization': `token ${token}` } : {}),
    ...options.headers,
  };

  const url = `https://api.github.com/${path}`;
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`GitHub API Error (${response.status}): ${response.statusText}. ${errorBody}`);
  }

  return response.json();
};

export const githubReadFileTool = createTool({
  id: 'github-read-file',
  description: 'Reads the content of a file from the GitHub repository via API.',
  inputSchema: z.object({
    filePath: z.string().describe('Path of the file relative to the repo root.'),
    branch: z.string().optional().describe('Branch to read from. Defaults to main.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    content: z.string().optional(),
    sha: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ filePath, branch }) => {
    try {
      const config = getGitConfig();
      const targetBranch = branch || config.defaultBranch;
      const cleanPath = filePath.replace(/^\//, '');
      const pathParam = encodeURIComponent(cleanPath);
      
      const data = await makeGithubRequest(
        `repos/${config.owner}/${config.repo}/contents/${pathParam}?ref=${targetBranch}`
      ) as { content: string; sha: string };

      // GitHub returns base64 content with newlines
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { success: true, content, sha: data.sha };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});

export const githubWriteFileTool = createTool({
  id: 'github-write-file',
  description: 'Creates or updates a file directly in the GitHub repository via API, making a commit.',
  inputSchema: z.object({
    filePath: z.string().describe('Path where the file should be created/updated relative to the repo root.'),
    content: z.string().describe('The new file content.'),
    commitMessage: z.string().describe('A descriptive commit message.'),
    branch: z.string().optional().describe('Branch to commit to. Defaults to main.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    commitSha: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ filePath, content, commitMessage, branch }) => {
    try {
      const config = getGitConfig();
      const targetBranch = branch || config.defaultBranch;
      const cleanPath = filePath.replace(/^\//, '');
      const pathParam = encodeURIComponent(cleanPath);

      // Check if file exists to get its SHA (required for updates)
      let sha: string | undefined;
      try {
        const fileInfo = await makeGithubRequest(
          `repos/${config.owner}/${config.repo}/contents/${pathParam}?ref=${targetBranch}`
        ) as { sha: string };
        sha = fileInfo.sha;
      } catch {
        // File does not exist yet; sha remains undefined
      }

      const body = {
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch: targetBranch,
        ...(sha ? { sha } : {}),
      };

      const res = await makeGithubRequest(
        `repos/${config.owner}/${config.repo}/contents/${pathParam}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }
      ) as { commit: { sha: string } };

      return { success: true, commitSha: res.commit.sha };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});

export const githubListFilesTool = createTool({
  id: 'github-list-files',
  description: 'Lists contents of a directory in the GitHub repository via API.',
  inputSchema: z.object({
    directoryPath: z.string().default('').describe('Directory path relative to the repo root.'),
    branch: z.string().optional().describe('Branch name. Defaults to main.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    items: z.array(z.object({
      name: z.string(),
      path: z.string(),
      type: z.string(),
    })).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ directoryPath, branch }) => {
    try {
      const config = getGitConfig();
      const targetBranch = branch || config.defaultBranch;
      const cleanPath = directoryPath.replace(/^\//, '');
      const pathParam = cleanPath ? encodeURIComponent(cleanPath) : '';
      
      const data = await makeGithubRequest(
        `repos/${config.owner}/${config.repo}/contents/${pathParam}?ref=${targetBranch}`
      ) as { name: string; path: string; type: string }[];

      const items = data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
      }));

      return { success: true, items };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});

export const githubCheckCIStatusTool = createTool({
  id: 'github-check-ci-status',
  description: 'Checks the status of GitHub Action workflows (tests) for the specified branch.',
  inputSchema: z.object({
    branch: z.string().optional().describe('Branch name to check workflow runs for. Defaults to main.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    status: z.string().optional(),
    conclusion: z.string().optional(),
    runs: z.array(z.any()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ branch }) => {
    try {
      const config = getGitConfig();
      const targetBranch = branch || config.defaultBranch;
      
      const data = await makeGithubRequest(
        `repos/${config.owner}/${config.repo}/actions/runs?branch=${targetBranch}&per_page=5`
      ) as { workflow_runs: { status: string; conclusion: string; html_url: string }[] };

      if (!data.workflow_runs || data.workflow_runs.length === 0) {
        return { success: true, status: 'no_runs', conclusion: 'none' };
      }

      const latestRun = data.workflow_runs[0];
      const simplifiedRuns = data.workflow_runs.map((run: any) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
      }));
      return {
        success: true,
        status: latestRun.status, // e.g. completed, in_progress
        conclusion: latestRun.conclusion, // e.g. success, failure, cancelled
        runs: simplifiedRuns,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});
