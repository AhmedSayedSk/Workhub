import type { Project, Task } from '@/types'
import {
  projectShape, decisions, projectDesign, designPrototypes, designScreens,
  features as featuresApi, tasks as tasksApi,
  projectDeploy, deployServers, deployDomains, deployRecommendations,
  projectMarket, marketChannels, marketCampaigns, marketListings, marketPlaybook, launchAssets,
  projectLaunch, launchChecklist, postLaunchIssues,
  repoSummaries, projectRepos, nextSteps,
} from '@/lib/firestore'

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1
  return out
}

function fmtCounts(c: Record<string, number>): string {
  return Object.entries(c).map(([k, n]) => `${n} ${k}`).join(', ')
}

/**
 * Aggregate EVERYTHING WorkHub knows about a project into one compact
 * structured brief for AI consumption (~3-4k tokens). Every fetch is
 * fault-tolerant — a missing stage simply doesn't appear in the brief.
 */
export async function buildFullProjectContext(project: Project): Promise<string> {
  const pid = project.id
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback)

  const [
    shape, decs, design, protos, screens,
    feats, allTasks,
    deploy, servers, domains, recs,
    market, channels, campaigns, listings, playbook, assets,
    launch, checklist, issues,
    repos, repoList, history,
  ] = await Promise.all([
    safe(projectShape.get(pid), null),
    safe(decisions.listByProject(pid), []),
    safe(projectDesign.get(pid), null),
    safe(designPrototypes.listByProject(pid), []),
    safe(designScreens.listByProject(pid), []),
    safe(featuresApi.getAll(pid), []),
    safe(tasksApi.getAll(undefined, pid), []),
    safe(projectDeploy.get(pid), null),
    safe(deployServers.listByProject(pid), []),
    safe(deployDomains.listByProject(pid), []),
    safe(deployRecommendations.listByProject(pid), []),
    safe(projectMarket.get(pid), null),
    safe(marketChannels.listByProject(pid), []),
    safe(marketCampaigns.listByProject(pid), []),
    safe(marketListings.listByProject(pid), []),
    safe(marketPlaybook.listByProject(pid), []),
    safe(launchAssets.listByProject(pid), []),
    safe(projectLaunch.get(pid), null),
    safe(launchChecklist.listByProject(pid), []),
    safe(postLaunchIssues.listByProject(pid), []),
    safe(repoSummaries.listByProject(pid), []),
    safe(projectRepos.get(pid), null),
    safe(nextSteps.listByProject(pid), []),
  ])

  const activeTasks = allTasks.filter((t: Task) => !t.archived)
  const inProgress = activeTasks.filter((t) => t.status === 'in_progress')
  const todo = activeTasks.filter((t) => t.status === 'todo')
  const openDecs = decs.filter((d) => d.status === 'open')
  const openRecs = recs.filter((r) => r.status === 'open')
  const resolvedSteps = history.filter((s) => s.status !== 'pending')

  // Codebase view: prefer the synced repo snapshot (names + groups) joined to
  // each repo's summary; fall back to bare summaries if no snapshot exists.
  const summaryByRepoId: Record<string, string> = {}
  for (const r of repos) summaryByRepoId[r.repoId] = r.summary
  const codebaseLines: string[] = (repoList?.repos ?? []).length > 0
    ? repoList!.repos.map((r) =>
        `- ${r.name}${r.group ? ` [${r.group}]` : ''}: ${summaryByRepoId[r.id] ?? '(no summary)'}`)
    : repos.map((r) => `- ${r.summary}`)

  const sections: (string | false)[] = [
    `# Project: ${project.name}`,
    !!project.description?.trim() && `Description: ${project.description}`,
    `Status: ${project.status} | Payment model: ${project.paymentModel}${project.deadline ? ` | Deadline: ${project.deadline.toDate().toISOString().slice(0, 10)}` : ''}`,

    // Shape
    !!shape?.visionStatement?.trim() && `## Vision\n${shape.visionStatement}`,
    (shape?.inScope?.length ?? 0) > 0 && `In scope: ${shape!.inScope.join('; ')}`,
    (shape?.outOfScope?.length ?? 0) > 0 && `Out of scope: ${shape!.outOfScope.join('; ')}`,
    (shape?.constraints?.length ?? 0) > 0 && `Constraints: ${shape!.constraints.join('; ')}`,
    decs.length > 0 &&
      `## Decisions (${openDecs.length} OPEN of ${decs.length})\n${decs.map((d) => `- [${d.status}] ${d.title}`).join('\n')}`,

    // Design
    (protos.length > 0 || screens.length > 0 || !!design) &&
      `## Design\nPrototypes: ${protos.length === 0 ? 'none' : protos.map((p) => `${p.name} (${p.status})`).join('; ')}` +
      (screens.length > 0
        ? `\nScreens: ${fmtCounts(countBy(screens, (s) => s.status))} of ${screens.length} total`
        : '') +
      (design?.iconSet ? `\nDesign system: ${design.colors?.length ?? 0} colors, ${design.fonts?.length ?? 0} fonts, icons: ${design.iconSet}` : ''),

    // Build
    (feats.length > 0 || activeTasks.length > 0) &&
      `## Build\nFeatures: ${feats.map((f) => f.name).join('; ') || 'none'}` +
      `\nTasks: ${fmtCounts(countBy(activeTasks, (t) => t.status))} (total ${activeTasks.length})` +
      (inProgress.length > 0 ? `\nIn progress now: ${inProgress.slice(0, 6).map((t) => t.name).join('; ')}` : '') +
      (todo.length > 0 ? `\nTop todos: ${todo.slice(0, 8).map((t) => t.name).join('; ')}` : ''),

    // Repos (codebase view) — systems/repos with their AI summaries
    codebaseLines.length > 0 && `## Codebase (systems / repos)\n${codebaseLines.join('\n')}`,

    // Deploy
    (!!deploy || servers.length > 0 || domains.length > 0) &&
      `## Deploy\nServers: ${servers.length === 0 ? 'none' : servers.map((s) => `${s.name} (${s.provider}, ${s.status})`).join('; ')}` +
      `\nDomains: ${domains.length === 0 ? 'none' : domains.map((d) => `${d.domain} (${d.ssl})`).join('; ')}` +
      ((deploy?.technologies?.length ?? 0) > 0 ? `\nStack: ${deploy!.technologies.join(', ')}` : '') +
      (openRecs.length > 0
        ? `\nOPEN security/infra recommendations:\n${openRecs.map((r) => `- [${r.severity}] ${r.title}`).join('\n')}`
        : ''),

    // Market
    (!!market || channels.length > 0 || listings.length > 0 || playbook.length > 0) &&
      `## Market\nPositioning: ${market?.positioning?.trim() ? 'set' : 'MISSING'} | Audience: ${market?.audience?.trim() ? 'set' : 'MISSING'} | Pricing: ${market?.pricing?.trim() ? 'set' : 'MISSING'}` +
      (channels.length > 0 ? `\nChannels: ${channels.map((c) => `${c.name} (${c.status})`).join('; ')}` : '') +
      (campaigns.length > 0 ? `\nCampaigns: ${campaigns.map((c) => `${c.name} (${c.status})`).join('; ')}` : '') +
      (listings.length > 0 ? `\nMarketplace listings: ${listings.map((l) => `${l.marketplace} (${l.status})`).join('; ')}` : '') +
      (playbook.length > 0
        ? `\nGTM playbook: ${['pre_launch', 'launch', 'post_launch']
            .map((ph) => {
              const items = playbook.filter((i) => i.phase === ph)
              if (items.length === 0) return null
              return `${ph} ${items.filter((i) => i.status === 'done').length}/${items.length} done`
            })
            .filter(Boolean)
            .join(', ')}` +
          `\nNext undone playbook items: ${playbook.filter((i) => i.status !== 'done').slice(0, 6).map((i) => i.title).join('; ')}`
        : '') +
      (assets.length > 0 ? `\nLaunch assets: ${fmtCounts(countBy(assets, (a) => a.status))}` : ''),

    // Launch
    (!!launch || checklist.length > 0 || issues.length > 0) &&
      `## Launch\nRelease status: ${launch?.status ?? 'not planned'}${launch?.releaseDate ? ` | date: ${launch.releaseDate.toDate().toISOString().slice(0, 10)}` : ''}` +
      (checklist.length > 0 ? `\nChecklist: ${checklist.filter((c) => c.status === 'done').length}/${checklist.length} done` : '') +
      (issues.filter((i) => i.status !== 'resolved').length > 0
        ? `\nOpen post-launch issues: ${issues.filter((i) => i.status !== 'resolved').map((i) => `[${i.severity}] ${i.title}`).join('; ')}`
        : ''),

    // Next-step history — critical for dedup
    resolvedSteps.length > 0 &&
      `## Next-step history (do NOT suggest these again)\n${resolvedSteps.slice(0, 20).map((s) => `- [${s.status}] ${s.title}`).join('\n')}`,
  ]

  return sections.filter(Boolean).join('\n\n')
}
