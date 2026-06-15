import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const policyDrivenDevStep = createStep({
  id: 'policy-driven-dev-step',
  description: 'Orchestrates the self-correcting cycle of code generation, policy validation, and code review.',
  inputSchema: z.object({
    prompt: z.string().describe('The feature or code change request.'),
  }),
  outputSchema: z.object({
    complianceReport: z.string(),
    generationLog: z.string(),
    reviewVerdict: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('No input data provided');

    const codeGenerator = mastra?.getAgent('code-generator');
    const policyGuardian = mastra?.getAgent('policy-guardian');
    const codeReviewer = mastra?.getAgent('code-reviewer');

    if (!codeGenerator || !policyGuardian || !codeReviewer) {
      throw new Error('Required agents not found');
    }

    const prompt = inputData.prompt;
    let attempts = 0;
    const maxAttempts = 3;
    let success = false;
    let complianceReport = '';
    let generationLog = '';
    let reviewVerdict = '';

    while (attempts < maxAttempts && !success) {
      attempts++;

      // 1. Generate code (injecting feedback from previous attempt if any)
      let genPrompt = prompt;
      if (attempts > 1) {
        genPrompt = `We attempted to implement this change but encountered issues. Please correct the implementation based on the feedback below:
Original requested change: ${prompt}

Feedback / Compliance Issues:
${complianceReport}

Code Review Verdict:
${reviewVerdict}

Please address all issues, update the code, write/fix tests, and update the change log.`;
      } else {
        genPrompt = `Implement the following feature directly on GitHub using your tools. Make sure to commit each logical change, update contracts first, write tests, and update logs/change.log: \n\n${prompt}`;
      }

      const genResult = await codeGenerator.generate(genPrompt);
      generationLog = genResult.text;

      // 2. Validate compliance and review code in parallel
      const [validationResult, reviewResult] = await Promise.all([
        policyGuardian.generate(`Please validate if the following requested change adheres to all policies. Write a compliance report: \n\n${prompt}`),
        codeReviewer.generate(`Audit the changes made during generation and check if GitHub Actions CI/CD tests have passed: \n\n${generationLog}`)
      ]);

      complianceReport = validationResult.text;
      reviewVerdict = reviewResult.text;

      const isCompliant = !complianceReport.includes('COMPLIANCE STATUS: NON-COMPLIANT');
      const reviewPassed = !reviewVerdict.includes('VERDICT: CHANGES_REQUIRED');

      if (isCompliant && reviewPassed) {
        success = true;
      }
    }

    return {
      complianceReport,
      generationLog,
      reviewVerdict,
      success,
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
  .then(policyDrivenDevStep);

policyDrivenDevWorkflow.commit();
