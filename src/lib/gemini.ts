import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { GeminiModel } from '@/types'
import type { CreativeScene } from '@/types'
import { VALID_ICON_NAMES, ICON_LIBRARY } from '@/lib/task-icons'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Available models with descriptions
export const GEMINI_MODELS: { value: GeminiModel; label: string; description: string; pricing: string; badge?: string; badgeColor?: string }[] = [
  {
    value: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    description: 'State-of-the-art reasoning with powerful agentic and coding capabilities (1M context)',
    pricing: '$2.00 / $12.00 per 1M tokens (input/output)',
    badge: 'Most Capable',
    badgeColor: 'purple',
  },
  {
    value: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash',
    description: 'Fast frontier-class performance with upgraded visual and spatial reasoning',
    pricing: '$0.50 / $3.00 per 1M tokens (input/output) • Free tier available',
    badge: 'Recommended',
    badgeColor: 'green',
  },
  {
    value: 'gemini-2.5-pro-preview-05-06',
    label: 'Gemini 2.5 Pro',
    description: 'Advanced model with enhanced reasoning and coding capabilities',
    pricing: '$1.25 / $10.00 per 1M tokens (input/output)',
  },
  {
    value: 'gemini-2.5-flash-preview-05-20',
    label: 'Gemini 2.5 Flash',
    description: 'Fast and powerful with great performance',
    pricing: '$0.30 / $2.50 per 1M tokens (input/output)',
  },
]

// Default model (using latest Gemini 3)
let currentModel: GeminiModel = 'gemini-3-flash-preview'

// Function to get the current Gemini model instance
export function getGeminiModel(modelName?: GeminiModel): GenerativeModel {
  return genAI.getGenerativeModel({ model: modelName || currentModel })
}

// Function to set the default model
export function setCurrentModel(model: GeminiModel) {
  currentModel = model
}

// For backward compatibility
export const geminiModel = getGeminiModel()

export interface TaskBreakdownRequest {
  featureName: string
  featureDescription: string
  projectContext?: string
}

export interface TimeEstimateRequest {
  taskName: string
  taskDescription: string
  subtasks?: string[]
  historicalData?: {
    similarTasks: { name: string; actualHours: number }[]
  }
}

export interface InsightRequest {
  type: 'productivity' | 'project_health' | 'recommendations'
  data: {
    projects?: { name: string; status: string; completedTasks: number; totalTasks: number }[]
    timeEntries?: { date: string; hours: number; project: string }[]
    tasks?: { name: string; status: string; priority: string; createdAt: string }[]
  }
}

export async function generateTaskBreakdown(
  request: TaskBreakdownRequest,
  model?: GeminiModel
): Promise<string[]> {
  const prompt = `You are a project management assistant. Break down the following feature into specific, actionable tasks.

Feature: ${request.featureName}
Description: ${request.featureDescription}
${request.projectContext ? `Project Context: ${request.projectContext}` : ''}

Return a JSON array of task names. Each task should be:
- Specific and actionable
- Small enough to complete in 1-4 hours
- Clearly scoped

Example response format:
["Task 1 name", "Task 2 name", "Task 3 name"]

Only return the JSON array, no other text.`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    const response = result.response.text()

    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return []
  } catch (error) {
    console.error('Error generating task breakdown:', error)
    throw error
  }
}

export async function generateTimeEstimate(
  request: TimeEstimateRequest,
  model?: GeminiModel
): Promise<number> {
  const prompt = `You are a project estimation assistant. Estimate the time required for this task in hours.

Task: ${request.taskName}
Description: ${request.taskDescription}
${request.subtasks?.length ? `Subtasks: ${request.subtasks.join(', ')}` : ''}
${
  request.historicalData?.similarTasks?.length
    ? `Historical data for similar tasks: ${JSON.stringify(request.historicalData.similarTasks)}`
    : ''
}

Consider:
- Task complexity
- Potential blockers
- Testing time
- Code review time

Return only a number representing estimated hours. Be realistic.

Example response: 4.5`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    const response = result.response.text().trim()

    const hours = parseFloat(response)
    if (!isNaN(hours)) {
      return hours
    }

    return 2 // Default fallback
  } catch (error) {
    console.error('Error generating time estimate:', error)
    throw error
  }
}

export async function generateInsight(
  request: InsightRequest,
  model?: GeminiModel
): Promise<string> {
  let prompt = ''

  switch (request.type) {
    case 'productivity':
      prompt = `You are a productivity analyst. Analyze the following work data and provide insights.

Time Entries: ${JSON.stringify(request.data.timeEntries)}

Provide a brief, actionable insight about:
- Work patterns
- Peak productivity times
- Suggestions for improvement

Keep the response under 150 words.`
      break

    case 'project_health':
      prompt = `You are a project health analyst. Analyze the following project data.

Projects: ${JSON.stringify(request.data.projects)}

Provide a brief assessment of:
- Overall project health
- Projects needing attention
- Progress summary

Keep the response under 150 words.`
      break

    case 'recommendations':
      prompt = `You are a work management advisor. Based on the following data, provide recommendations.

Tasks: ${JSON.stringify(request.data.tasks)}
Time Entries: ${JSON.stringify(request.data.timeEntries)}

Provide:
- Top 3 priorities for today
- Any tasks at risk
- Quick wins available

Keep the response under 150 words.`
      break
  }

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    return result.response.text()
  } catch (error) {
    console.error('Error generating insight:', error)
    throw error
  }
}

/** Pre-filter icons by keyword overlap with the task text, returning a short candidate list */
function prefilterIcons(text: string, maxCandidates = 25): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return VALID_ICON_NAMES.slice(0, maxCandidates)

  // Score each icon by how many of its tags overlap with the task words
  const scored = ICON_LIBRARY.map((entry) => {
    let score = 0
    for (const word of words) {
      if (entry.name.includes(word) || word.includes(entry.name)) score += 3
      for (const tag of entry.tags) {
        if (tag.includes(word) || word.includes(tag)) score += 1
      }
    }
    return { name: entry.name, score }
  })

  scored.sort((a, b) => b.score - a.score)

  const top = scored.filter((s) => s.score > 0).slice(0, maxCandidates).map((s) => s.name)
  if (top.length === 0) return VALID_ICON_NAMES.slice(0, maxCandidates)
  return top
}

export async function suggestTaskIcon(
  { taskName, taskDescription, taskType }: { taskName: string; taskDescription?: string; taskType?: string },
  model?: GeminiModel
): Promise<string | null> {
  const text = [taskName, taskDescription || '', taskType || ''].join(' ')
  const candidates = prefilterIcons(text)

  const prompt = `Pick ONE icon for this task. Reply with ONLY the icon name.

Task: ${taskName}${taskType ? ` [${taskType}]` : ''}
${taskDescription ? `Info: ${taskDescription.slice(0, 150)}` : ''}

Icons: ${candidates.join(', ')}`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    const raw = result.response.text().trim().toLowerCase()
    // Strip quotes, backticks, markdown, newlines
    const response = raw.replace(/[`"'*\n\r]/g, '').trim()

    // Exact match
    if (VALID_ICON_NAMES.includes(response)) {
      return response
    }

    // The AI might return extra text — find first valid icon name anywhere in response
    for (const name of candidates) {
      if (response.includes(name)) {
        return name
      }
    }
    // Broader: check all valid names
    for (const name of VALID_ICON_NAMES) {
      if (response.includes(name)) {
        return name
      }
    }
    return null
  } catch (error) {
    console.error('Error suggesting task icon:', error)
    return null
  }
}

const VALID_TASK_TYPES = ['task', 'bug', 'feature', 'improvement', 'documentation', 'research'] as const
export type GeneratedTaskType = (typeof VALID_TASK_TYPES)[number]

export interface GeneratedTaskSuggestion {
  title: string
  taskType: GeneratedTaskType
}

export async function generateTaskSuggestion(
  { description }: { description: string },
  model?: GeminiModel,
): Promise<GeneratedTaskSuggestion | null> {
  const trimmed = description.trim()
  if (trimmed.length < 10) return null

  const prompt = `Analyze the following task description and return a concise title and the best-fitting task type.

Rules for title:
- Maximum 80 characters
- Use imperative mood (e.g., "Add", "Fix", "Implement", "Refactor", "Update")
- Single line only
- No quotes, no markdown, no trailing period
- Match the language of the description
- Focus on the core action or outcome, not details

Valid task types (pick exactly one):
- task: generic work item, chore, or setup
- bug: fixing incorrect or broken behavior
- feature: adding new user-facing functionality
- improvement: enhancing existing functionality, refactoring, performance
- documentation: writing or updating docs, READMEs, comments
- research: investigation, spike, proof of concept, exploration

Description:
${trimmed.slice(0, 2000)}

Reply with ONLY a compact JSON object on a single line, no markdown, no code fences, in this exact shape:
{"title":"...","taskType":"..."}`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    const raw = result.response.text()

    // Strip code fences if Gemini added any
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    // Find the first JSON object in the response
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null

    let parsed: { title?: unknown; taskType?: unknown }
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return null
    }

    if (typeof parsed.title !== 'string' || typeof parsed.taskType !== 'string') return null

    // Clean title
    const title = parsed.title
      .replace(/^["'`*_\s]+|["'`*_\s]+$/g, '')
      .replace(/[.!?]+$/, '')
      .trim()
    if (!title) return null

    const safeTitle = title.length > 120 ? title.slice(0, 117).trimEnd() + '…' : title

    // Validate taskType
    const taskTypeCandidate = parsed.taskType.toLowerCase().trim() as GeneratedTaskType
    const taskType = VALID_TASK_TYPES.includes(taskTypeCandidate) ? taskTypeCandidate : 'task'

    return { title: safeTitle, taskType }
  } catch (error) {
    console.error('Error generating task suggestion:', error)
    return null
  }
}

export async function summarizeRepoReadme(
  params: { repoName: string; readme: string },
  model?: GeminiModel
): Promise<string> {
  const truncated = params.readme.slice(0, 12_000)
  const prompt = `You are summarizing a code repository for a project-management dashboard card.

Repository name: ${params.repoName}

README content:
"""
${truncated}
"""

Write a ONE-LINE functional summary of what this repository does (max 15 words, single sentence). Focus on the function/purpose, not setup instructions or badges. Plain text only — no markdown, no quotes, no trailing period.`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    return result.response.text().trim().replace(/^["']|["']$/g, '').split('\n')[0].slice(0, 140)
  } catch (error) {
    console.error('Error summarizing repo readme:', error)
    throw error
  }
}

export async function summarizeDeployNotes(
  params: { kind: 'infrastructure' | 'security'; content: string },
  model?: GeminiModel
): Promise<string> {
  const prompt = `You are condensing ${params.kind} documentation for a project-management dashboard.

Content:
"""
${params.content.slice(0, 12_000)}
"""

Rewrite as the MAIN POINTS ONLY: a plain-text bullet list ("- " prefix), max 7 bullets, each bullet max 12 words. Keep concrete facts (names, numbers, versions); drop filler and explanations. No markdown headings, no intro/outro text — bullets only.`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    return result.response.text().trim()
  } catch (error) {
    console.error('Error summarizing deploy notes:', error)
    throw error
  }
}

export interface GeneratedDeployRec {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  area: 'security' | 'infrastructure' | 'optimization'
  title: string
  detail: string
}

export async function generateDeployRecommendations(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedDeployRec[]> {
  const prompt = `You are a senior DevOps/security engineer reviewing a project's deployment.

Project context (servers, domains, stack, infrastructure/security notes, repo summaries, and ALREADY-TRACKED recommendations):
"""
${params.context.slice(0, 14_000)}
"""

Suggest NEW deployment recommendations — security vulnerabilities, infrastructure gaps, or optimizations — that are NOT already tracked (do not repeat or rephrase the already-tracked list). Be concrete and grounded in the context; skip generic advice that doesn't apply to this stack.

Respond with ONLY a JSON array (no markdown fences, no commentary), max 5 items:
[{"severity":"critical|high|medium|low|info","area":"security|infrastructure|optimization","title":"<max 12 words>","detail":"<2-4 sentences: the risk and the concrete fix>"}]

If you find nothing genuinely new, respond with [].`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    // Strip accidental code fences
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedDeployRec[]
    const validSev = ['critical', 'high', 'medium', 'low', 'info']
    const validArea = ['security', 'infrastructure', 'optimization']
    return parsed
      .filter((r) => r && typeof r.title === 'string' && typeof r.detail === 'string')
      .map((r) => ({
        severity: validSev.includes(r.severity) ? r.severity : 'medium',
        area: validArea.includes(r.area) ? r.area : 'security',
        title: r.title.slice(0, 120),
        detail: r.detail.slice(0, 1500),
      }))
      .slice(0, 5)
  } catch (error) {
    console.error('Error generating deploy recommendations:', error)
    throw error
  }
}

export interface GeneratedNextStep {
  title: string
  why: string
  how: string
  stage: 'shape' | 'design' | 'build' | 'deploy' | 'market' | 'launch'
  effort: 'minutes' | 'hours' | 'days'
}

export async function generateNextSteps(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedNextStep[]> {
  const prompt = `You are a pragmatic startup operator coaching a solo product owner. Below is the COMPLETE current state of one of their projects. Your job: tell them the highest-leverage things to do next, ranked. Think like an owner, not a backlog — what actually moves this project forward right now?

Rules:
- Ground every suggestion in the actual state below (reference real open decisions, real findings, real progress gaps).
- Never suggest anything in the "Next-step history" section.
- Prefer unblocking moves: open decisions blocking build, security findings blocking launch, missing positioning blocking marketing.
- Be concrete: a step the owner can start today.

PROJECT STATE:
"""
${params.context.slice(0, 20_000)}
"""

Respond with ONLY a JSON array of EXACTLY 3 items, ranked most-important first (no fences):
[{"title":"<imperative action, max 10 words>","why":"<ONE short sentence citing the actual project state>","how":"<1-2 short sentences: how to start>","stage":"shape|design|build|deploy|market|launch","effort":"minutes|hours|days"}]

Keep it tight — the owner reads this on a small card. No filler words.`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedNextStep[]
    const stages = ['shape', 'design', 'build', 'deploy', 'market', 'launch']
    const efforts = ['minutes', 'hours', 'days']
    return parsed
      .filter((s) => s && typeof s.title === 'string')
      .map((s) => ({
        title: s.title.slice(0, 100),
        why: String(s.why ?? '').slice(0, 250),
        how: String(s.how ?? '').slice(0, 400),
        stage: stages.includes(s.stage) ? s.stage : 'build',
        effort: efforts.includes(s.effort) ? s.effort : 'hours',
      }))
      .slice(0, 3)
  } catch (error) {
    console.error('Error generating next steps:', error)
    throw error
  }
}

export interface GeneratedShape {
  visionStatement: string
  inScope: string[]
  outOfScope: string[]
  constraints: string[]
}

export async function generateShape(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedShape | null> {
  const prompt = `You are a senior product strategist helping a developer lock the shape of their product: vision, scope boundaries, and constraints.

Project context (description, repos, deployment, existing drafts):
"""
${params.context.slice(0, 14_000)}
"""

Respond with ONLY a JSON object (no fences):
{
  "visionStatement": "<2-4 sentences: what this is, for whom, and the core direction — concrete, no fluff>",
  "inScope": ["<4-7 items that ARE part of this product's committed scope>"],
  "outOfScope": ["<3-6 tempting things explicitly NOT being built (with version hints like 'v2' where sensible)>"],
  "constraints": ["<3-6 hard constraints: technical, market, budget, platform>"]
}`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedShape
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).slice(0, 8) : [])
    return {
      visionStatement: String(parsed.visionStatement ?? '').slice(0, 1500),
      inScope: arr(parsed.inScope),
      outOfScope: arr(parsed.outOfScope),
      constraints: arr(parsed.constraints),
    }
  } catch (error) {
    console.error('Error generating shape:', error)
    throw error
  }
}

export interface GeneratedDecision {
  title: string
  rationale: string
}

export async function generateShapeDecisions(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedDecision[]> {
  const prompt = `You are a senior product strategist. Identify the CRITICAL OPEN DECISIONS this project must lock before/while building — the choices that are expensive to reverse or that block other work.

Project context (vision, scope, constraints, repos, and ALREADY-TRACKED decisions to NOT repeat):
"""
${params.context.slice(0, 14_000)}
"""

Respond with ONLY a JSON array (no fences), 3-6 items:
[{"title":"<the decision as a question, max 14 words>","rationale":"<1-3 sentences: why it matters now and the trade-off>"}]`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedDecision[]
    return parsed
      .filter((d) => d && typeof d.title === 'string')
      .map((d) => ({
        title: d.title.slice(0, 140),
        rationale: String(d.rationale ?? '').slice(0, 600),
      }))
      .slice(0, 6)
  } catch (error) {
    console.error('Error generating shape decisions:', error)
    throw error
  }
}

export interface GeneratedMarketPlan {
  positioning: string
  audience: string
  pricing: string
  channels: string[]
}

export async function generateMarketPlan(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedMarketPlan | null> {
  const prompt = `You are a senior go-to-market strategist helping a solo developer market their product. They have NO marketing experience — be concrete and jargon-free.

Product context (description, repo summaries, deployment, domains):
"""
${params.context.slice(0, 14_000)}
"""

Produce a starter marketing plan. Respond with ONLY a JSON object (no markdown fences):
{
  "positioning": "<2-3 sentences: what it is, for whom, why it beats alternatives — written so it can be pasted on a landing page>",
  "audience": "<2-3 sentences: the specific buyer/user personas and where they hang out online>",
  "pricing": "<2-3 sentences: a concrete suggested pricing model with numbers, grounded in comparable tools>",
  "channels": ["<5-7 specific channels ranked by fit, e.g. 'Product Hunt', 'r/SaaS', 'Hacker News (Show HN)'>"]
}`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedMarketPlan
    return {
      positioning: String(parsed.positioning ?? '').slice(0, 1200),
      audience: String(parsed.audience ?? '').slice(0, 1200),
      pricing: String(parsed.pricing ?? '').slice(0, 1200),
      channels: Array.isArray(parsed.channels) ? parsed.channels.map(String).slice(0, 7) : [],
    }
  } catch (error) {
    console.error('Error generating market plan:', error)
    throw error
  }
}

export interface GeneratedCampaign {
  name: string
  channel: string
  notes: string
}

export async function generateMarketCampaigns(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedCampaign[]> {
  const prompt = `You are a go-to-market coach proposing concrete marketing campaigns for a solo developer with NO marketing experience. Each campaign must be a specific, runnable initiative — not a vague channel name.

Product context (positioning, audience, channels, playbook, and ALREADY-TRACKED campaigns to NOT repeat):
"""
${params.context.slice(0, 14_000)}
"""

Respond with ONLY a JSON array (no fences), 3-5 items:
[{"name":"<campaign name, max 8 words>","channel":"<where it runs>","notes":"<2-3 sentences: the goal, the concrete steps, and what success looks like (with a number)>"}]`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedCampaign[]
    return parsed
      .filter((c) => c && typeof c.name === 'string')
      .map((c) => ({
        name: c.name.slice(0, 80),
        channel: String(c.channel ?? '').slice(0, 60),
        notes: String(c.notes ?? '').slice(0, 1000),
      }))
      .slice(0, 5)
  } catch (error) {
    console.error('Error generating market campaigns:', error)
    throw error
  }
}

export interface GeneratedListing {
  marketplace: string
  model: 'one_time' | 'subscription' | 'freemium'
  price: string
  why: string
  prepItems: string[]
}

export async function generateMarketListings(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedListing[]> {
  const prompt = `You are a distribution strategist for indie software products. Suggest where to LIST/SELL this product — script marketplaces (CodeCanyon, Codester, Gumroad), deal platforms (AppSumo), app stores, or direct SaaS — whichever genuinely fit.

Product context (positioning, pricing, stack, and ALREADY-TRACKED listings to NOT repeat):
"""
${params.context.slice(0, 14_000)}
"""

Respond with ONLY a JSON array (no fences), 2-4 items, ranked by fit:
[{"marketplace":"<platform name>","model":"one_time|subscription|freemium","price":"<concrete suggested price for that platform>","why":"<1-2 sentences why this platform fits>","prepItems":["<3-5 concrete submission requirements for this platform, e.g. 'Record 2-min demo video', 'Prepare 590x300 preview image'>"]}]`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedListing[]
    const models = ['one_time', 'subscription', 'freemium']
    return parsed
      .filter((l) => l && typeof l.marketplace === 'string')
      .map((l) => ({
        marketplace: l.marketplace.slice(0, 60),
        model: models.includes(l.model) ? l.model : 'one_time',
        price: String(l.price ?? '').slice(0, 60),
        why: String(l.why ?? '').slice(0, 500),
        prepItems: Array.isArray(l.prepItems) ? l.prepItems.map(String).slice(0, 5) : [],
      }))
      .slice(0, 4)
  } catch (error) {
    console.error('Error generating market listings:', error)
    throw error
  }
}

export interface GeneratedCampaignPost {
  caption: string
  hashtags: string[]
  imagePrompt: string
  headline: string // short text to render ON the image (a few words)
  body: string // longer supporting text to render ON the image (1-2 short sentences)
}

// Plan a cohesive multi-post social campaign (caption + hashtags + image prompt
// per post). Powers the Image Generator's Campaign wizard.
export async function generateCampaignPosts(
  params: {
    context: string
    brandName: string
    goal: string
    audience: string
    tone: string
    count: number
    language: 'en' | 'ar'
    includeLink?: boolean
    link?: string
    includeHowTo?: boolean
    includeEdge?: boolean
    edge?: string
    cta?: string
  },
  model?: GeminiModel
): Promise<GeneratedCampaignPost[]> {
  const count = Math.max(1, Math.min(20, Math.round(params.count || 4)))
  const langLine =
    params.language === 'ar'
      ? 'Write the "caption" and "hashtags" in ARABIC (Modern Standard, natural marketing tone). CRITICAL: the "imagePrompt" field MUST be written ENTIRELY in ENGLISH — never Arabic, no Arabic words at all — it is a technical instruction for the image engine, not audience-facing copy.'
      : 'Write everything in English.'
  // Optional content emphasis toggled per-campaign — woven across the posts.
  const emphasis: string[] = []
  if (params.includeLink && params.link) emphasis.push(`Include the link ${params.link} as the call-to-action in at least one post (place it in the caption text).`)
  if (params.includeHowTo) emphasis.push(`Dedicate at least one post to HOW TO USE it — a concrete quick-start or usage example.`)
  if (params.includeEdge) emphasis.push(`Dedicate at least one post to why it beats the alternatives${params.edge ? ` (context: ${params.edge})` : ''} — frame it as positive benefits/differentiators, never attacks.`)
  const emphasisBlock = emphasis.length
    ? `\nAcross the ${count} posts you MUST also cover these (spread them out — don't cram into one post):\n${emphasis.map((e) => `- ${e}`).join('\n')}\n`
    : ''
  const prompt = `You are a senior social-media creative producing a cohesive ${count}-post campaign for the brand "${params.brandName}".

Campaign goal: ${params.goal || 'grow awareness and drive signups'}
Audience: ${params.audience || "the product's ideal customers"}
Tone: ${params.tone || 'confident, friendly, concrete'}
${params.cta ? `Primary call to action: ${params.cta} — every caption's closing CTA must drive THIS action (written natively in the campaign language, naturally varied).` : ''}
${langLine}

Product/brand context (description, repos, domains):
"""
${(params.context || '').slice(0, 12_000)}
"""
${emphasisBlock}
Produce exactly ${count} DISTINCT posts that build on each other (vary the angle: hook/benefit, key feature, how-it-works, social proof, clear CTA). Respond with ONLY a JSON array (no markdown fences), ${count} items:
[{"caption":"<1-3 short sentences ending in a clear CTA; platform-ready; use \\n for line breaks>","hashtags":["<3-6 relevant tags WITHOUT the # symbol>"],"imagePrompt":"<describe ONLY the SUBJECT, scene, composition and mood in English — do NOT specify an art style or colors (those are applied separately by the campaign). NO text overlays, NO logos.>","headline":"<a SHORT punchy headline of 2-6 words to display ON the image${params.language === 'ar' ? ', in ARABIC' : ''}>","body":"<one short supporting sentence (max ~12 words) to display ON the image${params.language === 'ar' ? ', in ARABIC' : ''}>"}]`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedCampaignPost[]
    const posts = parsed
      .filter((p) => p && typeof p.caption === 'string')
      .map((p) => ({
        caption: String(p.caption ?? '').slice(0, 2200),
        hashtags: Array.isArray(p.hashtags)
          ? p.hashtags.map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean).slice(0, 8)
          : [],
        imagePrompt: String(p.imagePrompt ?? '').slice(0, 1000), // enforced English below
        headline: String(p.headline ?? '').slice(0, 120),
        body: String(p.body ?? '').slice(0, 240),
      }))
      .slice(0, count)
    // HARD guarantee: image prompts are always English. On Arabic campaigns the
    // model occasionally drifts — detect Arabic script and translate those
    // prompts back to English scene descriptions in one batch call. Image
    // engines design far better from English prompts.
    const AR = /[؀-ۿݐ-ݿ]/
    const drifted = posts.map((p, i) => (AR.test(p.imagePrompt) ? i : -1)).filter((i) => i >= 0)
    if (drifted.length) {
      try {
        const gemini2 = getGeminiModel(model)
        const res2 = await gemini2.generateContent(
          `Translate each Arabic image-scene description below into a natural ENGLISH image-generation prompt (subject, scene, composition, mood only — no style/colors, no text overlays). Respond with ONLY a JSON array of ${drifted.length} strings, same order:\n${JSON.stringify(drifted.map((i) => posts[i].imagePrompt))}`
        )
        let t2 = res2.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
        const arr = JSON.parse(t2.slice(t2.indexOf('['), t2.lastIndexOf(']') + 1))
        drifted.forEach((pi, k) => {
          if (typeof arr[k] === 'string' && arr[k].trim() && !AR.test(arr[k])) posts[pi].imagePrompt = arr[k].trim().slice(0, 1000)
        })
      } catch { /* keep originals — better than failing the plan */ }
    }
    return posts
  } catch (error) {
    console.error('Error generating campaign posts:', error)
    throw error
  }
}

// Deterministic fallback: a valid copy-scene script from the campaign basics,
// used when Gemini fails so a creative video still renders.
export function fallbackVideoScenes(params: {
  brandName: string; goal: string; domain?: string; postHeadlines: string[]; cta?: string
}): CreativeScene[] {
  const scenes: CreativeScene[] = [
    { type: 'hook', headline: params.brandName, underline: params.brandName, kicker: 'Introducing' },
  ]
  for (const h of params.postHeadlines.filter(Boolean).slice(0, 3)) scenes.push({ type: 'beat', title: h })
  if (!scenes.some((s) => s.type === 'beat')) scenes.push({ type: 'beat', title: params.goal || 'See what we made' })
  scenes.push({ type: 'cta', text: (params.cta || 'Get started').slice(0, 40), ...(params.domain ? { url: params.domain } : {}) })
  return scenes
}

// Turns a campaign into a punchy, video-paced script (copy scenes only). The
// route interleaves the real campaign images as `showcase` scenes afterwards.
export async function generateCampaignVideoScript(
  params: {
    brandName: string; goal: string; audience: string; tone: string
    language: 'en' | 'ar'; domain?: string
    cultureNote?: string
    cta?: string
    posts: Array<{ headline?: string; body?: string; caption?: string }>
  },
  model?: GeminiModel
): Promise<CreativeScene[]> {
  const langLine = params.language === 'ar'
    ? 'Write all "headline", "underline", "kicker", "title", "sub", "label", "text" in ARABIC, following the target market\'s dialect guidance above (default to clear Modern Standard Arabic / فصحى — natural, premium marketing tone; avoid heavy colloquial slang unless the market note asks for it).'
    : 'Write everything in English.'
  const copy = params.posts.map((p) => [p.headline, p.body, p.caption].filter(Boolean).join(' — ')).filter(Boolean).slice(0, 8).join('\n')
  const prompt = `You are a senior motion-graphics copywriter scripting a short vertical promo VIDEO for the brand "${params.brandName}".
Goal: ${params.goal || 'grow awareness and drive signups'}
Audience: ${params.audience || "the product's ideal customers"}
Tone: ${params.tone || 'confident, punchy, concrete'}
${langLine}
Target market & culture: ${params.cultureNote || 'international audience'} Write copy that fits this market's customs, values and way of speaking.
Source campaign copy:
"""
${copy.slice(0, 6000)}
"""
Write a tight, PUNCHY video script — short kinetic lines, not paragraphs. Respond with ONLY a JSON array (no markdown fences) of scene objects, in play order, following EXACTLY:
- exactly 1 hook: {"type":"hook","headline":"<2 short lines, use \\n between them>","underline":"<the 1-3 word key phrase inside headline to underline>","kicker":"<1-2 word eyebrow, optional>"}
- exactly ${Math.min(6, Math.max(2, params.posts.length))} beats (one per campaign image, same order as the source copy): {"type":"beat","title":"<a benefit in <=7 words>","sub":"<supporting line <=10 words, optional>"}
- 0 to 2 stats (only if a number is truthful/likely): {"type":"stat","value":"<e.g. 18% or 3x or $52k>","label":"<what it measures, <=6 words>"}
- exactly 1 cta LAST: {"type":"cta","text":"<${params.cta ? `a punchy button label (<=5 words) for exactly this action: ${params.cta}` : 'call to action <=6 words'}>","url":"${params.domain || ''}"}
Order: hook first, cta last, beats/stats in between. Do NOT include images.`
  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const s = text.indexOf('['), e = text.lastIndexOf(']')
    if (s === -1 || e === -1) throw new Error('no json array')
    const raw = JSON.parse(text.slice(s, e + 1)) as any[]
    const scenes = raw.map((x) => sanitizeScene(x)).filter(Boolean) as CreativeScene[]
    const hasHook = scenes.some((s2) => s2.type === 'hook')
    const hasCta = scenes.some((s2) => s2.type === 'cta')
    if (!hasHook || !hasCta || scenes.length < 3) throw new Error('script incomplete')
    return scenes
  } catch (error) {
    console.error('Error generating video script:', error)
    return fallbackVideoScenes({ brandName: params.brandName, goal: params.goal, domain: params.domain, postHeadlines: params.posts.map((p) => p.headline || '') })
  }
}

// Asks the model for a premium video color system harmonized with the brand.
// Returns raw hex proposals (or null) — the caller runs them through
// finalizePalette() which enforces WCAG contrast, so taste here is enough.
export async function generateVideoPalette(
  params: { brandName: string; brandColor?: string | null; tone?: string; goal?: string },
  model?: GeminiModel
): Promise<Record<string, string> | null> {
  const prompt = `You are a senior brand & motion designer. Design the color system for a premium, cinematic vertical brand video.
Brand: "${params.brandName}". Brand color: ${params.brandColor || 'none provided'}. Tone: ${params.tone || 'confident, modern'}. Goal: ${params.goal || 'brand awareness'}.
Respond with ONLY a JSON object (no markdown fences) of 6-digit hex colors:
{"bg1":"<gradient top: deep dark cinematic tone subtly tinted with the brand hue — never pure black>",
 "bg2":"<gradient bottom: same family, noticeably darker>",
 "accent":"<vivid saturated accent harmonious with the brand color (may be the brand color) — used for underlines, bars and the CTA button>",
 "text":"<near-white headline color with a subtle tint matching the palette>",
 "muted":"<light desaturated supporting-text color>",
 "ctaText":"<text color ON the accent CTA button: very dark or white, whichever fits>"}
Keep it tasteful and minimal: the background gradient should be subtle (two close dark tones), the accent should carry the energy.`
  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s === -1 || e === -1) return null
    const raw = JSON.parse(text.slice(s, e + 1))
    return raw && typeof raw === 'object' ? raw : null
  } catch (error) {
    console.error('Error generating video palette:', error)
    return null
  }
}

export interface HookOption {
  style: 'question' | 'bold' | 'pain' | 'stat' | 'curiosity'
  lang: 'en' | 'ar'
  headline: string
  underline?: string
  kicker?: string
}

// Hook options in BOTH English and Arabic — one per proven ad-hook archetype
// per language — written from the campaign's own copy. Never throws.
export async function generateHookOptions(
  params: {
    brandName: string; goal?: string; audience?: string; tone?: string
    language: 'en' | 'ar'; postsCopy: string; cultureNote?: string
  },
  model?: GeminiModel
): Promise<HookOption[]> {
  const prompt = `You write scroll-stopping OPENING HOOKS for short vertical brand ad videos ("${params.brandName}").
Goal: ${params.goal || 'awareness'} · Audience: ${params.audience || 'ideal customers'} · Tone: ${params.tone || 'confident, modern'}
Target market & culture: ${params.cultureNote || 'international audience'} Hooks MUST be deeply localized to THIS market: its language, customs, values and the topics/angles that resonate in that country — written the way top ads sound THERE, never generic translations.
Source campaign copy:
"""${params.postsCopy.slice(0, 3000)}"""
Produce EXACTLY 10 hooks, ALL in ${params.language === 'ar' ? `ARABIC (lang "ar") — natural native marketing Arabic following the market note's dialect guidance` : `ENGLISH (lang "en")`}: the 5 archetypes below, TWO distinct variants each (different angles). Each must be scroll-stopping in the first second.
Archetypes: question (a provocative question the audience instantly says YES to) · bold (an audacious claim/promise) · pain (bluntly call out the audience's pain) · stat (number-led, truthful/plausible from the copy) · curiosity (tease a secret/shortcut).
Respond with ONLY a JSON array of 10 objects:
[{"style":"question","lang":"en","headline":"<max 2 short lines, use \\n>","underline":"<1-3 word phrase copied exactly from the headline>","kicker":"<1-2 word eyebrow>"}, ...]`
  const fallback: HookOption[] = params.language === 'ar'
    ? [
        { style: 'question', lang: 'ar', headline: `هل أنت مستعد\nللمستوى التالي؟`, kicker: params.brandName.slice(0, 30) },
        { style: 'pain', lang: 'ar', headline: `توقف عن إضاعة الوقت`, kicker: params.brandName.slice(0, 30) },
      ]
    : [
        { style: 'question', lang: 'en', headline: `Ready for\nthe next level?`, kicker: params.brandName.slice(0, 30) },
        { style: 'bold', lang: 'en', headline: params.brandName, underline: params.brandName },
      ]
  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const s = text.indexOf('['), e = text.lastIndexOf(']')
    if (s === -1 || e === -1) return fallback
    const raw = JSON.parse(text.slice(s, e + 1)) as any[]
    const str = (v: any, n: number) => String(v ?? '').slice(0, n)
    const out: HookOption[] = []
    for (const x of raw) {
      if (!x || !x.headline || !['question', 'bold', 'pain', 'stat', 'curiosity'].includes(x.style)) continue
      const lang = x.lang === 'ar' ? 'ar' : 'en'
      const underline = str(x.underline, 60), kicker = str(x.kicker, 40)
      out.push({ style: x.style, lang, headline: str(x.headline, 120), ...(underline ? { underline } : {}), ...(kicker ? { kicker } : {}) })
    }
    return out.length >= 4 ? out.slice(0, 10) : fallback
  } catch (error) {
    console.error('Error generating hook options:', error)
    return fallback
  }
}

export const VOICEOVER_RATES = [0.9, 1, 1.1, 1.25, 1.5] as const

// Deterministic pace heuristic — the fallback when the AI director is
// unavailable, and the sanity floor for its answer.
export function heuristicVoiceoverRate(params: {
  language: 'en' | 'ar'; tone?: string; totalChars?: number; sceneCount?: number
}): number {
  const tone = (params.tone || '').toLowerCase()
  let rate = params.language === 'ar' ? 1 : 1.1 // Arabic favors clarity
  if (/energetic|exciting|urgent|bold|punchy|fun|dynamic|youth/i.test(tone)) rate = 1.25
  if (/calm|luxur|premium|elegant|trust|serious|profession/i.test(tone)) rate = 1
  // Lots of copy -> pick up the pace one step so the reel stays tight.
  const chars = params.totalChars || 0
  const scenes = params.sceneCount || 0
  if (chars > 550 || scenes > 7) {
    const i = VOICEOVER_RATES.indexOf(rate as (typeof VOICEOVER_RATES)[number])
    rate = VOICEOVER_RATES[Math.min(VOICEOVER_RATES.length - 1, Math.max(0, i) + 1)]
  }
  return rate
}

// AI voiceover pace director: reasons over the campaign's energy, language and
// copy volume and picks the ideal speaking rate. Snaps to the allowed set;
// never throws (falls back to the heuristic).
export async function chooseVoiceoverRate(
  params: {
    brandName: string; tone?: string; audience?: string; goal?: string
    language: 'en' | 'ar'; mode: string; sceneCount: number; sampleCopy: string; totalChars: number
  },
  model?: GeminiModel
): Promise<number> {
  const fallback = heuristicVoiceoverRate(params)
  try {
    const gemini = getGeminiModel(model)
    const prompt = `You are a voiceover director for short vertical brand ad videos. Choose the ideal narration speaking-pace multiplier for this video. Think about:
- Language: ${params.language === 'ar' ? 'Arabic (clarity matters — do not rush unless the copy demands it)' : 'English'}
- Tone: ${params.tone || 'confident, modern'} · Audience: ${params.audience || 'general'} · Goal: ${params.goal || 'awareness'}
- Video style: ${params.mode === 'creative' ? 'fast-cut animated reel' : 'image slideshow'} with ${params.sceneCount} scenes, ~${params.totalChars} characters of narration total (more copy => a quicker pace keeps the reel tight; sparse copy => natural pace breathes better)
Sample of the narration copy:
"""${params.sampleCopy.slice(0, 700)}"""
Respond with ONLY JSON: {"rate": <exactly one of 0.9, 1, 1.1, 1.25, 1.5>, "reason": "<one short sentence>"}`
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const s = text.indexOf('{'), e = text.lastIndexOf('}')
    if (s === -1 || e === -1) return fallback
    const raw = JSON.parse(text.slice(s, e + 1))
    const n = Number(raw?.rate)
    if (!Number.isFinite(n)) return fallback
    // Snap to the nearest allowed value.
    const snapped = VOICEOVER_RATES.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a))
    console.log(`[voiceover] auto rate ${snapped} — ${String(raw?.reason || '').slice(0, 120)}`)
    return snapped
  } catch (error) {
    console.error('Error choosing voiceover rate:', error)
    return fallback
  }
}

function sanitizeScene(x: any): CreativeScene | null {
  if (!x || typeof x !== 'object') return null
  const str = (v: any, n: number) => String(v ?? '').slice(0, n)
  // Omit empty optionals entirely — Firestore rejects `undefined` values, so
  // an absent field must not appear as a key at all.
  switch (x.type) {
    case 'hook': {
      if (!x.headline) return null
      const underline = str(x.underline, 60), kicker = str(x.kicker, 40)
      return { type: 'hook', headline: str(x.headline, 120), ...(underline ? { underline } : {}), ...(kicker ? { kicker } : {}) }
    }
    case 'beat': {
      if (!x.title) return null
      const sub = str(x.sub, 120)
      return { type: 'beat', title: str(x.title, 80), ...(sub ? { sub } : {}) }
    }
    case 'stat': return x.value && x.label ? { type: 'stat', value: str(x.value, 16), label: str(x.label, 60) } : null
    case 'cta': {
      if (!x.text) return null
      const url = str(x.url, 200)
      return { type: 'cta', text: str(x.text, 60), ...(url ? { url } : {}) }
    }
    default: return null
  }
}

export interface GeneratedCampaignBrief {
  name: string
  goal: string
  audience: string
  tone: string
  cta: string
  language: 'en' | 'ar'
  count: number
  cadenceDays: number
}

// Read a project's details and propose a sensible campaign brief to pre-fill the
// Campaign wizard. The user can edit anything before generating the plan.
export async function generateCampaignBrief(
  params: { context: string; language?: 'en' | 'ar' },
  model?: GeminiModel
): Promise<GeneratedCampaignBrief | null> {
  // When the user has already chosen a campaign language, write the human-facing
  // fields (name, goal, audience, tone) in THAT language; otherwise let the AI pick.
  const forced = params.language === 'ar' || params.language === 'en' ? params.language : null
  const langLine = forced === 'ar'
    ? 'IMPORTANT: Write "name", "goal", "audience" and "tone" in ARABIC (natural, native marketing tone — not translated word-for-word), and set "language" to "ar".'
    : forced === 'en'
      ? 'Write "name", "goal", "audience" and "tone" in ENGLISH, and set "language" to "en".'
      : ''
  const langField = forced
    ? `"${forced}" — the campaign language the user selected; keep it exactly`
    : 'en or ar — pick the audience\'s primary language; use ar ONLY if the product clearly targets an Arabic-speaking market'
  const prompt = `You are a social-media strategist. Read the product/project details below and propose a sensible social-media campaign brief tailored to THIS product.
${langLine}

Project details (name, description, type, client, domains):
"""
${(params.context || '').slice(0, 12_000)}
"""

Respond with ONLY a JSON object (no markdown fences):
{
  "name": "<short campaign name, max 6 words, referencing the product>",
  "goal": "<1-2 sentences: the concrete goal of this campaign for this specific product>",
  "audience": "<1 sentence: the specific target audience and where they are>",
  "tone": "<3-5 comma-separated adjectives that fit the brand voice>",
  "cta": "<the single best call-to-action for THIS product, e.g. 'Download the mobile app', 'Visit the website', 'Sign up for an account', 'Book a demo' — in ENGLISH>",
  "language": ${JSON.stringify(langField)},
  "count": <integer 4-8: how many posts this campaign should have>,
  "cadenceDays": <integer 1-4: days between posts>
}`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    const p = JSON.parse(text.slice(start, end + 1))
    return {
      name: String(p.name ?? '').slice(0, 80),
      goal: String(p.goal ?? '').slice(0, 500),
      audience: String(p.audience ?? '').slice(0, 300),
      tone: String(p.tone ?? '').slice(0, 120),
      cta: String(p.cta ?? '').slice(0, 80),
      language: forced || (p.language === 'ar' ? 'ar' : 'en'),
      count: Math.max(1, Math.min(20, Math.round(Number(p.count) || 6))),
      cadenceDays: Math.max(1, Math.min(14, Math.round(Number(p.cadenceDays) || 2))),
    }
  } catch (error) {
    console.error('Error generating campaign brief:', error)
    throw error
  }
}

// One shared "art direction" for a campaign so every post looks like the same set.
export async function generateCampaignArtDirection(
  params: { context: string; brandName: string; goal: string; tone: string; style: string; colors: string[]; instructions?: string },
  model?: GeminiModel
): Promise<string> {
  const prompt = `You are an art director defining ONE consistent visual identity for a brand's social campaign, so every post looks unmistakably part of the same set.

Brand: ${params.brandName}
Goal: ${params.goal || 'grow awareness'}
Tone: ${params.tone || 'confident, friendly'}
Base visual style: ${params.style || 'realistic'}
Brand colors: ${(params.colors || []).join(', ') || 'the brand palette'}
${params.instructions?.trim() ? `MUST honor these custom instructions: ${params.instructions.trim()}` : ''}

Product/brand context:
"""
${(params.context || '').slice(0, 6000)}
"""

Write ONE concise art-direction paragraph (3-5 sentences, English) describing the SHARED visual identity to apply IDENTICALLY to every image: lighting, composition & framing, color treatment, mood, background treatment, recurring motifs/props, and the rendering finish. Be specific and decisive so all posts feel cohesive and recognizably one campaign. Output ONLY the paragraph — no preamble, no markdown.`
  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    return result.response
      .text()
      .trim()
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/, '')
      .slice(0, 1500)
  } catch (error) {
    console.error('Error generating campaign art direction:', error)
    return ''
  }
}

export interface GeneratedPlaybookItem {
  phase: 'pre_launch' | 'launch' | 'post_launch'
  title: string
  detail: string
}

export async function generateMarketPlaybook(
  params: { context: string },
  model?: GeminiModel
): Promise<GeneratedPlaybookItem[]> {
  const prompt = `You are a go-to-market coach building a step-by-step launch playbook for a solo developer with NO marketing experience. Every item must be an actionable task with a concrete how-to, not vague advice.

Product context (positioning, audience, channels, repos, deployment, existing playbook items to NOT repeat):
"""
${params.context.slice(0, 14_000)}
"""

Respond with ONLY a JSON array (no fences), 9-15 items spread across the three phases:
[{"phase":"pre_launch|launch|post_launch","title":"<max 10 words, imperative>","detail":"<2-4 sentences: exactly what to do, where, and what good looks like>"}]`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    let text = result.response.text().trim()
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    if (start === -1 || end === -1) return []
    const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedPlaybookItem[]
    const phases = ['pre_launch', 'launch', 'post_launch']
    return parsed
      .filter((i) => i && typeof i.title === 'string')
      .map((i) => ({
        phase: phases.includes(i.phase) ? i.phase : 'pre_launch',
        title: i.title.slice(0, 100),
        detail: String(i.detail ?? '').slice(0, 1200),
      }))
      .slice(0, 15)
  } catch (error) {
    console.error('Error generating market playbook:', error)
    throw error
  }
}

export async function askAI(
  question: string,
  context?: string,
  model?: GeminiModel
): Promise<string> {
  const prompt = `You are WorkHub AI, an assistant for a work management system. Answer the user's question helpfully and concisely.

${context ? `Context: ${context}\n\n` : ''}User Question: ${question}

Keep your response concise and actionable.`

  try {
    const gemini = getGeminiModel(model)
    const result = await gemini.generateContent(prompt)
    return result.response.text()
  } catch (error) {
    console.error('Error in AI response:', error)
    throw error
  }
}
