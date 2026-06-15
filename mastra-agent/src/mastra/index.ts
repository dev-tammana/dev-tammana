import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';

// Default Weather template items
import { weatherWorkflow } from './workflows/weather-workflow';
import { policyDrivenDevWorkflow } from './workflows/policy-driven-dev-workflow';
import { weatherAgent } from './agents/weather-agent';
import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer';

// Specialized AI Agents
import { hiringCopilotAgent } from './agents/hiring-copilot-agent';
import { financeAgent } from './agents/finance-agent';
import { legalAgent } from './agents/legal-agent';
import { studentSolverAgent } from './agents/student-solver-agent';
import { policyGuardianAgent } from './agents/policy-guardian-agent';
import { codeReviewerAgent } from './agents/code-reviewer-agent';
import { codeGeneratorAgent } from './agents/code-generator-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow, 'policy-driven-dev-workflow': policyDrivenDevWorkflow },
  agents: { 
    'weather-agent': weatherAgent,
    'hiring-copilot-agent': hiringCopilotAgent,
    'finance-agent': financeAgent,
    'legal-agent': legalAgent,
    'student-solver-agent': studentSolverAgent,
    'policy-guardian': policyGuardianAgent,
    'code-reviewer': codeReviewerAgent,
    'code-generator': codeGeneratorAgent
  },
  scorers: { toolCallAppropriatenessScorer, completenessScorer, translationScorer },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: "mastra-storage",
      url: "file:./mastra.db",
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    }
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new MastraStorageExporter(),
          new MastraPlatformExporter(),
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
      },
    },
  }),
});
