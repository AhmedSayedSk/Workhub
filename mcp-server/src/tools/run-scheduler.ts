import { z } from 'zod';
import { getCampaign, runCampaign } from '../lib/social-scheduler.js';

export const runSchedulerSchema = {
  // Free-form: the valid keys come from the operator's private campaign config,
  // so they must not be enumerated in this public repo. Unknown keys are
  // rejected below with the same error an enum would have produced.
  campaign: z.string().describe('Which campaign scheduler to run now (key from the campaign config)'),
  dryRun: z.boolean().optional().describe('Preview only, post nothing (if the campaign supports a dry mode)'),
};

export async function runScheduler(args: { campaign: string; dryRun?: boolean }) {
  const c = getCampaign(args.campaign);
  if (!c) {
    return { content: [{ type: 'text' as const, text: `Error: unknown campaign \`${args.campaign}\`.` }], isError: true };
  }
  const dry = !!args.dryRun;
  if (dry && !c.runDry) {
    return { content: [{ type: 'text' as const, text: `**${c.name}** has no dry-run mode. Re-run without dryRun to execute it live.` }] };
  }
  try {
    const out = await runCampaign(c, dry);
    const tail = out.trim().split('\n').slice(-10).join('\n');
    return {
      content: [{
        type: 'text' as const,
        text: `Ran the **${c.name}** scheduler (${dry ? 'dry-run — nothing posted' : 'LIVE'}):\n\n\`\`\`\n${tail || '(no output)'}\n\`\`\``,
      }],
    };
  } catch (error) {
    return { content: [{ type: 'text' as const, text: `Error running ${c.name}: ${(error as Error).message}` }], isError: true };
  }
}
