import { NextRequest, NextResponse } from 'next/server'
import {
  generateTaskBreakdown,
  generateTimeEstimate,
  generateInsight,
  askAI,
  suggestTaskIcon,
  generateTaskSuggestion,
} from '@/lib/gemini'
import { requireAuth, verifyAuth } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { appSettings } from '@/lib/firestore'
import { GeminiModel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAuth(request)
    if (authError) return authError
    const decoded = await verifyAuth(request)
    const rateLimited = checkRateLimit(`ai:${decoded?.uid}`, 30, 60_000) // 30 req/min
    if (rateLimited) return rateLimited
    const body = await request.json()
    const { action, data, model: requestModel } = body

    // Get model from request, or fetch from settings
    let model: GeminiModel | undefined = requestModel
    if (!model) {
      try {
        const settings = await appSettings.get()
        if (settings?.aiEnabled === false) {
          return NextResponse.json(
            { success: false, error: 'AI features are disabled' },
            { status: 403 }
          )
        }
        model = settings?.aiModel
      } catch (e) {
        console.warn('Could not fetch settings, using default model:', e)
      }
    }

    switch (action) {
      case 'task_breakdown': {
        const { featureName, featureDescription, projectContext } = data
        const suggestions = await generateTaskBreakdown(
          {
            featureName,
            featureDescription,
            projectContext,
          },
          model
        )
        return NextResponse.json({ success: true, data: { suggestions } })
      }

      case 'time_estimate': {
        const { taskName, taskDescription, subtasks, historicalData } = data
        const estimate = await generateTimeEstimate(
          {
            taskName,
            taskDescription,
            subtasks,
            historicalData,
          },
          model
        )
        return NextResponse.json({ success: true, data: { estimate } })
      }

      case 'insight': {
        const { type, insightData } = data
        const insight = await generateInsight(
          {
            type,
            data: insightData,
          },
          model
        )
        return NextResponse.json({ success: true, data: { insight } })
      }

      case 'ask': {
        const { question, context } = data
        const response = await askAI(question, context, model)
        return NextResponse.json({ success: true, data: { response } })
      }

      case 'suggest_task_icon': {
        const { taskName, taskDescription, taskType } = data
        const iconName = await suggestTaskIcon({ taskName, taskDescription, taskType }, model)
        return NextResponse.json({ success: true, data: { iconName } })
      }

      case 'generate_task_suggestion': {
        const { description } = data
        const suggestion = await generateTaskSuggestion({ description }, model)
        return NextResponse.json({ success: true, data: { suggestion } })
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('AI API Error:', error)
    return NextResponse.json(
      { success: false, error: 'AI request failed' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch current AI settings
export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuth(request)
    if (authError) return authError
    const settings = await appSettings.getOrCreate()
    return NextResponse.json({
      success: true,
      data: {
        model: settings.aiModel,
        enabled: settings.aiEnabled,
      },
    })
  } catch (error) {
    console.error('Error fetching AI settings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}
