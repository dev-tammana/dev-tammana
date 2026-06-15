import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);

// Resolve the root directory /home/btpl-lap-22/live/profile
const getRepoRoot = () => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Path depth: src/mastra/tools/repo-tools.ts -> src/mastra/tools -> src/mastra -> src -> mastra-agent -> dev-tammana -> profile
    return path.resolve(__dirname, '../../../../../');
  } catch {
    return '/home/btpl-lap-22/live/profile';
  }
};

const REPO_ROOT = getRepoRoot();

export const readFileTool = createTool({
  id: 'read-file',
  description: 'Reads the contents of a file relative to the git repository root.',
  inputSchema: z.object({
    filePath: z.string().describe('The path of the file to read, relative to the repository root (e.g., "policies/rules/critical.rule.md").'),
  }),
  outputSchema: z.object({
    content: z.string().optional(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ filePath }) => {
    try {
      const fullPath = path.resolve(REPO_ROOT, filePath);
      // Security check: ensure the file is within the repository
      if (!fullPath.startsWith(REPO_ROOT)) {
        throw new Error('Access denied: path is outside the repository root.');
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});

export const writeFileTool = createTool({
  id: 'write-file',
  description: 'Writes or updates a file relative to the git repository root. Automatically creates parent directories if they do not exist.',
  inputSchema: z.object({
    filePath: z.string().describe('The path of the file to write, relative to the repository root.'),
    content: z.string().describe('The full text content to write into the file.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ filePath, content }) => {
    try {
      const fullPath = path.resolve(REPO_ROOT, filePath);
      if (!fullPath.startsWith(REPO_ROOT)) {
        throw new Error('Access denied: path is outside the repository root.');
      }
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});

export const listFilesTool = createTool({
  id: 'list-files',
  description: 'Lists files and folders inside a directory relative to the repository root.',
  inputSchema: z.object({
    directoryPath: z.string().default('.').describe('The path of the directory to list, relative to the repository root.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    files: z.array(z.string()).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ directoryPath }) => {
    try {
      const fullPath = path.resolve(REPO_ROOT, directoryPath);
      if (!fullPath.startsWith(REPO_ROOT)) {
        throw new Error('Access denied: path is outside the repository root.');
      }
      const files = await fs.readdir(fullPath);
      return { success: true, files };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});

export const runCommandTool = createTool({
  id: 'run-command',
  description: 'Runs an arbitrary shell command (e.g., git commands, tests, build) inside the repository root directory.',
  inputSchema: z.object({
    command: z.string().describe('The shell command to run (e.g. "git status", "git diff", "npm test", "pytest").'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ command }) => {
    try {
      const { stdout, stderr } = await execPromise(command, { cwd: REPO_ROOT });
      return { success: true, stdout, stderr };
    } catch (error) {
      return { 
        success: false, 
        stdout: (error as any).stdout || '',
        stderr: (error as any).stderr || '',
        error: (error as Error).message 
      };
    }
  },
});
