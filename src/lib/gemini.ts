import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { GeminiModel } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Available models with descriptions
export const GEMINI_MODELS: { value: GeminiModel; label: string; description: string; pricing: string; badge?: string; badgeColor?: string }[] = [
  {
    value: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro',
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
