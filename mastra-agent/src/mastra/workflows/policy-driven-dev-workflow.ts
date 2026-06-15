import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const validatePolicyStep = createStep({
  id: 'validate-policy',
  description: 'Validates feature plan compliance using the Policy Guardian agent.',
  inputSchema: z.object({
    prompt: z.string().describe('The feature or bug fix prompt to validate.'),
  }),
  outputSchema: z.object({
    complianceReport: z.string(),
    isCompliant: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('No input data provided');

    const agent = mastra?.getAgent('policy-guardian');
    if (!agent) throw new Error('Policy Guardian agent not found');

    const promptText = `Please validate if the following requested change adheres to all policies. Write a compliance report: \n\n${inputData.prompt}`;
    const result = await agent.generate(promptText);
    const reportText = result.text;
    const isCompliant = !reportText.includes('COMPLIANCE STATUS: NON-COMPLIANT');

    return {
      complianceReport: reportText,
      isCompliant,
    };
  },
});

const generateCodeStep = createStep({
  id: 'generate-code',
  description: 'Implements the feature on GitHub using the Code Generator agent.',
  inputSchema: z.object({
    prompt: z.string(),
    complianceReport: z.string(),
    isCompliant: z.boolean(),
  }),
  outputSchema: z.object({
    generationLog: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('No input data provided');
    if (!inputData.isCompliant) {
      return {
        generationLog: `Skipped code generation because Policy Guardian flagged compliance issues:\n${inputData.complianceReport}`,
        success: false,
      };
    }

    const agent = mastra?.getAgent('code-generator');
    if (!agent) throw new Error('Code Generator agent not found');

    const promptText = `Implement the following feature directly on GitHub using your tools. Make sure to commit each logical change, update contracts first, write tests, and update logs/change.log: \n\n${inputData.prompt}`;
    const result = await agent.generate(promptText);

    return {
      generationLog: result.text,
      success: true,
    };
  },
});

const reviewCodeStep = createStep({
  id: 'review-code',
  description: 'Audits the committed code and checks test execution via GitHub Actions.',
  inputSchema: z.object({
    generationLog: z.string(),
    success: z.boolean(),
  }),
  outputSchema: z.object({
    reviewVerdict: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('No input data provided');
    if (!inputData.success) {
      return {
        reviewVerdict: 'Skipped code review because generation was not completed.',
        success: false,
      };
    }

    const agent = mastra?.getAgent('code-reviewer');
    if (!agent) throw new Error('Code Reviewer agent not found');

    const promptText = `Audit the changes made during generation and check if GitHub Actions CI/CD tests have passed: \n\n${inputData.generationLog}`;
    const result = await agent.generate(promptText);

    return {
      reviewVerdict: result.text,
      success: !result.text.includes('VERDICT: CHANGES_REQUIRED'),
    };
  },
});

export const policyDrivenDevWorkflow = createWorkflow({
  id: 'policy-driven-dev-workflow',
  inputSchema: z.object({
    prompt: z.string().describe('Describe the feature or code change request.'),
  }),
  outputSchema: z.object({
    complianceReport: z.string(),
    generationLog: z.string(),
    reviewVerdict: z.string(),
    success: z.boolean(),
  }),
})
  .then(validatePolicyStep)
  .then(generateCodeStep)
  .then(reviewCodeStep);

policyDrivenDevWorkflow.commit();
