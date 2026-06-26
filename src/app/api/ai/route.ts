import { NextRequest, NextResponse } from 'next/server'
import {
  generateTaskBreakdown,
  generateTimeEstimate,
  generateInsight,
  askAI,
  suggestTaskIcon,
  generateTaskSuggestion,
  summarizeRepoReadme,
  summarizeDeployNotes,
  generateDeployRecommendations,
  generateMarketPlan,
  generateMarketPlaybook,
  generateMarketCampaigns,
  generateCampaignPosts,
  generateCampaignBrief,
  generateMarketListings,
  generateShape,
  generateShapeDecisions,
  generateNextSteps,
} from '@/lib/gemini'
import { requireAuth, verifyAuth } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { getAppSettingsServer } from '@/lib/server/app-settings'
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

    // Get model from request, or fetch from settings via Admin SDK (bypasses rules)
    let model: GeminiModel | undefined = requestModel
    if (!model) {
      const settings = await getAppSettingsServer()
      if (settings?.aiEnabled === false) {
        return NextResponse.json(
          { success: false, error: 'AI features are disabled' },
          { status: 403 }
        )
      }
      model = settings?.aiModel
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

      case 'campaign_plan': {
        const { context, brandName, goal, audience, tone, count, language } = data
        const posts = await generateCampaignPosts(
          { context, brandName, goal, audience, tone, count, language },
          model
        )
        return NextResponse.json({ success: true, data: { posts } })
      }

      case 'campaign_brief': {
        const { context } = data
        const brief = await generateCampaignBrief({ context }, model)
        return NextResponse.json({ success: true, data: { brief } })
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

      case 'summarize_repo': {
        const { repoName, readme } = data
        if (!readme || typeof readme !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Missing readme content' },
            { status: 400 }
          )
        }
        const summary = await summarizeRepoReadme({ repoName: repoName ?? 'repository', readme }, model)
        return NextResponse.json({ success: true, data: { summary } })
      }

      case 'generate_market_plan': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing context' }, { status: 400 })
        }
        const plan = await generateMarketPlan({ context }, model)
        return NextResponse.json({ success: true, data: { plan } })
      }

      case 'generate_next_steps': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing context' }, { status: 400 })
        }
        const steps = await generateNextSteps({ context }, model)
        return NextResponse.json({ success: true, data: { steps } })
      }

      case 'generate_shape': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing context' }, { status: 400 })
        }
        const shape = await generateShape({ context }, model)
        return NextResponse.json({ success: true, data: { shape } })
      }

      case 'generate_shape_decisions': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing context' }, { status: 400 })
        }
        const decisions = await generateShapeDecisions({ context }, model)
        return NextResponse.json({ success: true, data: { decisions } })
      }

      case 'generate_market_listings': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing context' }, { status: 400 })
        }
        const listings = await generateMarketListings({ context }, model)
        return NextResponse.json({ success: true, data: { listings } })
      }

      case 'generate_market_campaigns': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing context' }, { status: 400 })
        }
        const campaigns = await generateMarketCampaigns({ context }, model)
        return NextResponse.json({ success: true, data: { campaigns } })
      }

      case 'generate_market_playbook': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json({ success: false, error: 'Missing context' }, { status: 400 })
        }
        const items = await generateMarketPlaybook({ context }, model)
        return NextResponse.json({ success: true, data: { items } })
      }

      case 'generate_deploy_recs': {
        const { context } = data
        if (!context || typeof context !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Missing context' },
            { status: 400 }
          )
        }
        const recommendations = await generateDeployRecommendations({ context }, model)
        return NextResponse.json({ success: true, data: { recommendations } })
      }

      case 'summarize_deploy_notes': {
        const { kind, content } = data
        if (!content || typeof content !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Missing notes content' },
            { status: 400 }
          )
        }
        const summary = await summarizeDeployNotes(
          { kind: kind === 'security' ? 'security' : 'infrastructure', content },
          model
        )
        return NextResponse.json({ success: true, data: { summary } })
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
    const settings = await getAppSettingsServer()
    return NextResponse.json({
      success: true,
      data: {
        model: settings?.aiModel,
        enabled: settings?.aiEnabled !== false,
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
