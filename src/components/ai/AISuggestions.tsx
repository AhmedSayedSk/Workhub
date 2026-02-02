'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAI } from '@/hooks/useAI'
import { Sparkles, Loader2, Check, Plus, Clock } from 'lucide-react'

interface TaskBreakdownProps {
  featureName: string
  featureDescription: string
  projectContext?: string
  onAcceptTask: (taskName: string) => void
}

export function TaskBreakdownSuggestions({
  featureName,
  featureDescription,
  projectContext,
  onAcceptTask,
}: TaskBreakdownProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [acceptedTasks, setAcceptedTasks] = useState<Set<string>>(new Set())
  const { loading, getTaskBreakdown } = useAI()

  const handleGenerate = async () => {
    const tasks = await getTaskBreakdown(
      featureName,
      featureDescription,
      projectContext
    )
    setSuggestions(tasks)
    setAcceptedTasks(new Set())
  }

  const handleAccept = (task: string) => {
    onAcceptTask(task)
    setAcceptedTasks((prev) => new Set(prev).add(task))
  }

  const handleAcceptAll = () => {
    suggestions.forEach((task) => {
      if (!acceptedTasks.has(task)) {
        onAcceptTask(task)
      }
    })
    setAcceptedTasks(new Set(suggestions))
  }

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-base">AI Task Breakdown</CardTitle>
        </div>
        <CardDescription>
          Let AI suggest how to break down this feature into tasks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.length === 0 ? (
          <Button
            onClick={handleGenerate}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Task Suggestions
          </Button>
        ) : (
          <>
            <div className="space-y-2">
              {suggestions.map((task, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background"
                >
                  <span className="text-sm">{task}</span>
                  <Button
                    size="sm"
                    variant={acceptedTasks.has(task) ? 'secondary' : 'default'}
                    onClick={() => handleAccept(task)}
                    disabled={acceptedTasks.has(task)}
                  >
                    {acceptedTasks.has(task) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAcceptAll}
                disabled={acceptedTasks.size === suggestions.length}
                className="flex-1"
              >
                Accept All
              </Button>
              <Button onClick={handleGenerate} variant="outline" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Regenerate'
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface TimeEstimateProps {
  taskName: string
  taskDescription: string
  subtasks?: string[]
  onAcceptEstimate: (hours: number) => void
}

export function TimeEstimateSuggestion({
  taskName,
  taskDescription,
  subtasks,
  onAcceptEstimate,
}: TimeEstimateProps) {
  const [estimate, setEstimate] = useState<number | null>(null)
  const { loading, getTimeEstimate } = useAI()

  const handleGenerate = async () => {
    const hours = await getTimeEstimate(taskName, taskDescription, subtasks)
    setEstimate(hours)
  }

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">AI Time Estimate</span>
          </div>

          {estimate === null ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Estimate
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {estimate}h
              </Badge>
              <Button
                size="sm"
                onClick={() => onAcceptEstimate(estimate)}
              >
                Use
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
