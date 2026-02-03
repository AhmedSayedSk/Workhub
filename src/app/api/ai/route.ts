import { NextRequest, NextResponse } from 'next/server'
import {
  generateTaskBreakdown,
  generateTimeEstimate,
  generateInsight,
  askAI,
} from '@/lib/gemini'
import { appSettings } from '@/lib/firestore'
import { GeminiModel } from '@/types'

export async function POST(request: NextRequest) {
  try {
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
export async function GET() {
  try {
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
