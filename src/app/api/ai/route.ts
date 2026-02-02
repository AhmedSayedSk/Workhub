import { NextRequest, NextResponse } from 'next/server'
import {
  generateTaskBreakdown,
  generateTimeEstimate,
  generateInsight,
  askAI,
} from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'task_breakdown': {
        const { featureName, featureDescription, projectContext } = data
        const suggestions = await generateTaskBreakdown({
          featureName,
          featureDescription,
          projectContext,
        })
        return NextResponse.json({ success: true, data: { suggestions } })
      }

      case 'time_estimate': {
        const { taskName, taskDescription, subtasks, historicalData } = data
        const estimate = await generateTimeEstimate({
          taskName,
          taskDescription,
          subtasks,
          historicalData,
        })
        return NextResponse.json({ success: true, data: { estimate } })
      }

      case 'insight': {
        const { type, insightData } = data
        const insight = await generateInsight({
          type,
          data: insightData,
        })
        return NextResponse.json({ success: true, data: { insight } })
      }

      case 'ask': {
        const { question, context } = data
        const response = await askAI(question, context)
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
