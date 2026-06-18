import { z } from 'zod';
import { getCampaign, runCampaign } from '../lib/social-scheduler.js';

export const runSchedulerSchema = {
  campaign: z.enum(['coffeepos', 'sikasio']).describe('Which campaign scheduler to run now'),
  dryRun: z.boolean().optional().describe('Preview only, post nothing (if the campaign supports a dry mode)'),
};

export async function runScheduler(args: { campaign: 'coffeepos' | 'sikasio'; dryRun?: boolean }) {
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
