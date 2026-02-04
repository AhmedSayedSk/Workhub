'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAI } from '@/hooks/useAI'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { Sparkles, Send, Loader2, Bot, Trash2, CheckCircle2, XCircle, AlertCircle, Plus, MessageSquare, MoreHorizontal, Check, X, ListTodo, Clock, Search, Globe, GitBranch, Pencil } from 'lucide-react'
import { subtasks as subtasksApi } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  pendingTasks?: PendingTask[]
  pendingSubtasks?: PendingSubtask[]
  duration?: number // Response time in milliseconds
}

interface PendingTask {
  id: string
  projectId: string
  projectName?: string
  name: string
  description: string
  priority: string
  taskType: string
  estimatedHours: number
  status: 'pending' | 'approved' | 'rejected'
}

interface PendingSubtask {
  id: string
  taskId: string
  taskName?: string
  projectName?: string
  name: string
  estimatedMinutes: number
  status: 'pending' | 'approved' | 'rejected'
}

interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

// Icon components for replacing emojis
const StatusIcon = ({ type }: { type: 'success' | 'error' | 'warning' }) => {
  if (type === 'success') {
    return <CheckCircle2 className="inline-block h-4 w-4 text-green-600 dark:text-green-400 mr-1" />
  }
  if (type === 'error') {
    return <XCircle className="inline-block h-4 w-4 text-red-600 dark:text-red-400 mr-1" />
  }
  return <AlertCircle className="inline-block h-4 w-4 text-amber-600 dark:text-amber-400 mr-1" />
}

// Enhanced markdown renderer for AI responses
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: { content: string; ordered: boolean; number?: number }[] = []

  const processInlineMarkdown = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let remaining = line
    let key = 0

    while (remaining.length > 0) {
      // Priority order: emojis, code, bold, italic, highlight, underline, links
      const successEmojiMatch = remaining.match(/✅/)
      const errorEmojiMatch = remaining.match(/❌/)
      const warningEmojiMatch = remaining.match(/⚠️/)
      const codeMatch = remaining.match(/`([^`]+)`/)
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/)
      const highlightMatch = remaining.match(/==([^=]+)==/)
      const underlineMatch = remaining.match(/__([^_]+)__/)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

      // Find the earliest match
      const matches = [
        { match: successEmojiMatch, type: 'success-emoji' },
        { match: errorEmojiMatch, type: 'error-emoji' },
        { match: warningEmojiMatch, type: 'warning-emoji' },
        { match: codeMatch, type: 'code' },
        { match: boldMatch, type: 'bold' },
        { match: italicMatch, type: 'italic' },
        { match: highlightMatch, type: 'highlight' },
        { match: underlineMatch, type: 'underline' },
        { match: linkMatch, type: 'link' },
      ].filter(m => m.match !== null)
        .sort((a, b) => (a.match!.index || 0) - (b.match!.index || 0))

      if (matches.length === 0) {
        // Process priority keywords with colors
        const coloredText = processColorKeywords(remaining, key)
        if (typeof coloredText === 'string') {
          parts.push(remaining)
        } else {
          parts.push(coloredText)
        }
        break
      }

      const earliest = matches[0]
      const match = earliest.match!
      const before = remaining.slice(0, match.index)

      if (before) {
        const coloredBefore = processColorKeywords(before, key)
        parts.push(coloredBefore)
        key++
      }

      switch (earliest.type) {
        case 'success-emoji':
          parts.push(<StatusIcon key={key++} type="success" />)
          break
        case 'error-emoji':
          parts.push(<StatusIcon key={key++} type="error" />)
          break
        case 'warning-emoji':
          parts.push(<StatusIcon key={key++} type="warning" />)
          break
        case 'code':
          parts.push(
            <code key={key++} className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm text-purple-600 dark:text-purple-400">
              {match[1]}
            </code>
          )
          break
        case 'bold':
          parts.push(
            <strong key={key++} className="font-semibold text-foreground">
              {match[1]}
            </strong>
          )
          break
        case 'italic':
          parts.push(<em key={key++} className="italic">{match[1]}</em>)
          break
        case 'highlight':
          parts.push(
            <mark key={key++} className="px-1 rounded bg-yellow-200 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-200">
              {match[1]}
            </mark>
          )
          break
        case 'underline':
          parts.push(
            <span key={key++} className="underline decoration-2 underline-offset-2">
              {match[1]}
            </span>
          )
          break
        case 'link':
          parts.push(
            <a key={key++} href={match[2]} className="text-blue-600 dark:text-blue-400 underline hover:no-underline" target="_blank" rel="noopener noreferrer">
              {match[1]}
            </a>
          )
          break
      }

      remaining = remaining.slice(match.index! + match[0].length)
    }

    if (parts.length === 1) return parts[0]
    return <>{parts.map((part, i) => typeof part === 'string' ? <span key={`p-${i}`}>{part}</span> : <span key={`pe-${i}`}>{part}</span>)}</>
  }

  // Color keywords based on context
  const processColorKeywords = (text: string, baseKey: number): React.ReactNode => {
    const patterns = [
      { regex: /\b(High Priority|Urgent|Critical)\b/gi, className: 'text-red-600 dark:text-red-400 font-medium' },
      { regex: /\b(Medium Priority|Normal)\b/gi, className: 'text-amber-600 dark:text-amber-400 font-medium' },
      { regex: /\b(Low Priority)\b/gi, className: 'text-green-600 dark:text-green-400 font-medium' },
      { regex: /\b(Completed|Done|Finished)\b/gi, className: 'text-green-600 dark:text-green-400 font-medium' },
      { regex: /\b(In Progress|Working|Active)\b/gi, className: 'text-blue-600 dark:text-blue-400 font-medium' },
      { regex: /\b(Todo|Pending|Not Started)\b/gi, className: 'text-slate-600 dark:text-slate-400 font-medium' },
      { regex: /\b(Blocked|Stuck|Paused)\b/gi, className: 'text-orange-600 dark:text-orange-400 font-medium' },
      { regex: /\b(Deadline|Due|Overdue)\b/gi, className: 'text-red-500 dark:text-red-400 font-medium' },
    ]

    let result: React.ReactNode[] = []
    let key = baseKey

    for (const pattern of patterns) {
      const newResult: React.ReactNode[] = []
      for (const part of (result.length ? result : [text])) {
        if (typeof part !== 'string') {
          newResult.push(part)
          continue
        }

        let lastIndex = 0
        let match
        const regex = new RegExp(pattern.regex.source, 'gi')

        while ((match = regex.exec(part)) !== null) {
          if (match.index > lastIndex) {
            newResult.push(part.slice(lastIndex, match.index))
          }
          newResult.push(
            <span key={key++} className={pattern.className}>
              {match[0]}
            </span>
          )
          lastIndex = regex.lastIndex
        }

        if (lastIndex < part.length) {
          newResult.push(part.slice(lastIndex))
        }
      }
      result = newResult.length ? newResult : result
    }

    if (result.length === 0) return text
    if (result.length === 1) return result[0]
    return <>{result.map((part, i) => typeof part === 'string' ? <span key={`c-${i}`}>{part}</span> : <span key={`ce-${i}`}>{part}</span>)}</>
  }

  const flushList = () => {
    if (listItems.length > 0) {
      const isOrdered = listItems[0].ordered
      if (isOrdered) {
        elements.push(
          <ol key={elements.length} className="space-y-2 my-3">
            {listItems.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                  {item.number || i + 1}
                </span>
                <span className="flex-1 pt-0.5">{processInlineMarkdown(item.content)}</span>
              </li>
            ))}
          </ol>
        )
      } else {
        elements.push(
          <ul key={elements.length} className="space-y-1.5 my-2">
            {listItems.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary mt-1.5">•</span>
                <span className="flex-1">{processInlineMarkdown(item.content)}</span>
              </li>
            ))}
          </ul>
        )
      }
      listItems = []
    }
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    // Check for headers
    if (trimmedLine.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={elements.length} className="text-base font-semibold mt-4 mb-2 text-foreground">
          {processInlineMarkdown(trimmedLine.slice(4))}
        </h3>
      )
      return
    }
    if (trimmedLine.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={elements.length} className="text-lg font-semibold mt-4 mb-2 text-foreground border-b pb-1">
          {processInlineMarkdown(trimmedLine.slice(3))}
        </h2>
      )
      return
    }

    // Check for numbered lists (1. item)
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/)
    if (numberedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) {
        flushList()
      }
      listItems.push({ content: numberedMatch[2], ordered: true, number: parseInt(numberedMatch[1]) })
      return
    }

    // Check for bullet points
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      if (listItems.length > 0 && listItems[0].ordered) {
        flushList()
      }
      listItems.push({ content: trimmedLine.slice(2), ordered: false })
      return
    }

    flushList()

    if (trimmedLine === '') {
      // Empty line - add spacing
      if (index > 0 && index < lines.length - 1) {
        elements.push(<div key={elements.length} className="h-2" />)
      }
    } else {
      // Check if this is an action question (highlighted prompt for user)
      const isActionQuestion = /^(Would you like|Do you want|Should I|Shall I|Want me to|Let me know if).+\?$/i.test(trimmedLine)

      if (isActionQuestion) {
        elements.push(
          <p key={elements.length} className="leading-relaxed mt-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary font-medium">
            {processInlineMarkdown(trimmedLine)}
          </p>
        )
      } else {
        // Regular paragraph
        elements.push(
          <p key={elements.length} className="leading-relaxed text-muted-foreground">
            {processInlineMarkdown(trimmedLine)}
          </p>
        )
      }
    }
  })

  flushList()

  return <div className="space-y-1">{elements}</div>
}

// Memoized message content component
function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
  const rendered = useMemo(() => {
    if (isUser) return content
    return renderMarkdown(content)
  }, [content, isUser])

  return <>{rendered}</>
}

const SESSIONS_STORAGE_KEY = 'workhub-ai-sessions'
const CURRENT_SESSION_KEY = 'workhub-ai-current-session'

const defaultMessage: Message = {
  id: '1',
  role: 'assistant',
  content:
    "Hi! I'm your WorkHub AI assistant. I can help you find tasks, check deadlines, create new tasks, and provide productivity insights. What would you like to know?",
}

const createNewSession = (): Session => ({
  id: Date.now().toString(),
  title: 'New Chat',
  messages: [defaultMessage],
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

type AIState = 'idle' | 'searching' | 'thinking'

const PROMPT_HISTORY_KEY = 'workhub-ai-prompt-history'
const MAX_HISTORY = 10

export default function AssistantPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [aiState, setAiState] = useState<AIState>('idle')
  const [stateStartTime, setStateStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [promptHistory, setPromptHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [tempInput, setTempInput] = useState('')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingSessionTitle, setEditingSessionTitle] = useState('')
  const { loading, askQuestion, createTask } = useAI()
  const { user } = useAuth()
  const { projects } = useProjects()
  const { tasks, refetch: refetchTasks } = useTasks()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Timer for counting up during searching/thinking
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (aiState !== 'idle' && stateStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - stateStartTime)
      }, 100)
    } else {
      setElapsedTime(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [aiState, stateStartTime])

  // Web search function (DuckDuckGo - free, no API key, unlimited)
  const searchWeb = async (query: string): Promise<string> => {
    try {
      const response = await fetch('/api/web/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, num: 5 }),
      })
      const result = await response.json()

      if (!result.success) {
        return `[Search failed: ${result.error}]`
      }

      const { organic, instant } = result.data
      let searchContext = `\n\n--- WEB SEARCH RESULTS FOR: "${query}" ---\n`

      if (instant) {
        searchContext += `\nInstant Answer: ${instant.title}\n${instant.text}\n`
        if (instant.url) {
          searchContext += `Source: ${instant.url}\n`
        }
      }

      if (organic && organic.length > 0) {
        searchContext += `\nTop Results:\n`
        organic.forEach((item: { position: number; title: string; link: string; snippet: string }, i: number) => {
          searchContext += `${i + 1}. ${item.title}\n   URL: ${item.link}\n   ${item.snippet}\n\n`
        })
      }

      if (!instant && (!organic || organic.length === 0)) {
        searchContext += `\nNo results found for this query.\n`
      }

      return searchContext
    } catch (error) {
      console.error('Search error:', error)
      return '[Search failed due to an error]'
    }
  }

  // URL fetch function
  const fetchUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch('/api/web/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const result = await response.json()

      if (!result.success) {
        return `[Failed to fetch ${url}: ${result.error}]`
      }

      const { title, description, content } = result.data
      let urlContext = `\n\n--- CONTENT FROM: ${url} ---\n`
      if (title) urlContext += `Title: ${title}\n`
      if (description) urlContext += `Description: ${description}\n`
      urlContext += `\nPage Content:\n${content.substring(0, 5000)}${content.length > 5000 ? '...' : ''}\n`

      return urlContext
    } catch (error) {
      console.error('Fetch error:', error)
      return `[Failed to fetch ${url}]`
    }
  }

  // Detect if message needs web access
  const detectWebNeeds = (message: string): { needsSearch: boolean; searchQueries: string[]; urls: string[] } => {
    const urls: string[] = []
    const searchQueries: string[] = []

    // Detect URLs
    const urlRegex = /https?:\/\/[^\s]+/g
    const urlMatches = message.match(urlRegex)
    if (urlMatches) {
      urls.push(...urlMatches)
    }

    // Detect search intent keywords
    const searchKeywords = [
      /search\s+(?:for\s+)?(?:about\s+)?["']?([^"'\n]+)["']?/i,
      /look\s+up\s+["']?([^"'\n]+)["']?/i,
      /find\s+(?:information\s+)?(?:about\s+)?["']?([^"'\n]+)["']?/i,
      /what\s+is\s+["']?([^"'\n?]+)["']?\??/i,
      /who\s+is\s+["']?([^"'\n?]+)["']?\??/i,
      /check\s+(?:if\s+)?["']?([^"'\n]+)["']?(?:\s+(?:is\s+)?available)?/i,
      /(?:dns|domain)\s+(?:availability|check)\s+(?:for\s+)?["']?([^"'\n]+)["']?/i,
    ]

    // Check for explicit search requests
    const lowerMessage = message.toLowerCase()
    if (lowerMessage.includes('search') || lowerMessage.includes('look up') ||
        lowerMessage.includes('find online') || lowerMessage.includes('check online') ||
        lowerMessage.includes('browse') || lowerMessage.includes('website')) {
      // Extract potential search query from the message
      for (const regex of searchKeywords) {
        const match = message.match(regex)
        if (match && match[1]) {
          searchQueries.push(match[1].trim())
        }
      }

      // If no specific query found but search intent detected, use the whole message
      if (searchQueries.length === 0 && (lowerMessage.includes('search') || lowerMessage.includes('look up'))) {
        // Clean up the message to use as search query
        const cleanQuery = message
          .replace(/search\s*(for|about)?/gi, '')
          .replace(/look\s*up/gi, '')
          .replace(/please|can you|could you/gi, '')
          .trim()
        if (cleanQuery.length > 5) {
          searchQueries.push(cleanQuery)
        }
      }
    }

    return {
      needsSearch: searchQueries.length > 0 || urls.length > 0,
      searchQueries,
      urls,
    }
  }

  // Get current session
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === currentSessionId) || null
  }, [sessions, currentSessionId])

  const messages = currentSession?.messages || [defaultMessage]

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY)
    const savedCurrentId = localStorage.getItem(CURRENT_SESSION_KEY)

    let loadedSessions: Session[] = []

    if (savedSessions) {
      try {
        loadedSessions = JSON.parse(savedSessions)
      } catch (e) {
        console.error('Failed to parse saved sessions:', e)
      }
    }

    // If no sessions exist, create a default one
    if (loadedSessions.length === 0) {
      const newSession = createNewSession()
      loadedSessions = [newSession]
    }

    setSessions(loadedSessions)

    // Set current session
    if (savedCurrentId && loadedSessions.find(s => s.id === savedCurrentId)) {
      setCurrentSessionId(savedCurrentId)
    } else {
      setCurrentSessionId(loadedSessions[0].id)
    }

    setIsLoaded(true)
  }, [])

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
    }
  }, [sessions, isLoaded])

  // Save current session ID
  useEffect(() => {
    if (isLoaded && currentSessionId) {
      localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId)
    }
  }, [currentSessionId, isLoaded])

  // Load prompt history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem(PROMPT_HISTORY_KEY)
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        if (Array.isArray(parsed)) {
          setPromptHistory(parsed)
        }
      } catch (e) {
        console.error('Failed to parse prompt history:', e)
      }
    }
  }, [])

  // Add prompt to history
  const addToHistory = useCallback((prompt: string) => {
    setPromptHistory(prev => {
      // Don't add duplicates of the most recent entry
      if (prev[0] === prompt) return prev

      const newHistory = [prompt, ...prev].slice(0, MAX_HISTORY)
      localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(newHistory))
      return newHistory
    })
    setHistoryIndex(-1)
    setTempInput('')
  }, [])

  // Handle keyboard navigation through history
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (promptHistory.length === 0) return

      if (historyIndex === -1) {
        // Save current input before navigating
        setTempInput(input)
        setHistoryIndex(0)
        setInput(promptHistory[0])
      } else if (historyIndex < promptHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(promptHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return

      if (historyIndex === 0) {
        // Return to the temp input
        setHistoryIndex(-1)
        setInput(tempInput)
      } else {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(promptHistory[newIndex])
      }
    }
  }, [promptHistory, historyIndex, input, tempInput])

  // Get user initials for fallback
  const userInitials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U'

  // Build context from real data
  const dataContext = useMemo(() => {
    const projectsContext = projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.clientName || 'Internal',
      paymentModel: p.paymentModel,
      startDate: p.startDate ? formatDate(p.startDate) : 'Not set',
      deadline: p.deadline ? formatDate(p.deadline) : 'No deadline',
      totalAmount: p.totalAmount,
      paidAmount: p.paidAmount,
    }))

    const tasksContext = tasks.map((t) => {
      const project = projects.find((p) => p.id === t.projectId)
      return {
        id: t.id,
        name: t.name,
        status: t.status,
        priority: t.priority,
        type: t.taskType || 'task',
        projectId: t.projectId,
        projectName: project?.name || 'Unknown',
        deadline: t.deadline ? formatDate(t.deadline) : 'No deadline',
        estimatedHours: t.estimatedHours || 0,
        actualHours: t.actualHours || 0,
      }
    })

    return `
Here is the current data from WorkHub:

PROJECTS (${projects.length} total):
${projectsContext.map((p) => `- [ID: ${p.id}] "${p.name}" (${p.status}) - Client: ${p.clientName}, Deadline: ${p.deadline}`).join('\n')}

TASKS (${tasks.length} total):
${tasksContext.map((t) => `- [Task ID: ${t.id}] "${t.name}" [${t.status}] - Project: ${t.projectName} (Project ID: ${t.projectId}), Priority: ${t.priority}, Type: ${t.type}`).join('\n')}

WEB ACCESS CAPABILITY:
You have access to live web search and can fetch content from URLs. When the user asks you to search, look up information, check websites, or verify DNS/domain availability, the system will automatically search the web and provide you with the results. Use this information to give accurate, up-to-date answers.

TASK CREATION CAPABILITY:
You can suggest creating tasks. When you think a task should be created (either because the user asked or it would be helpful), respond with a JSON block in this exact format:
\`\`\`json:create_task
{
  "projectId": "the-project-id-from-above",
  "name": "Task name",
  "description": "Detailed task description",
  "priority": "low|medium|high|critical",
  "taskType": "task|bug|feature|improvement|documentation|research",
  "estimatedHours": 0
}
\`\`\`

IMPORTANT: The task will NOT be created automatically. The user will see a confirmation card and must click "Create" to approve the task. Only suggest tasks when it's clearly relevant to the conversation. Do not create tasks unless the user explicitly asks for task creation OR it's highly relevant to what they're working on.

SUBTASK CREATION CAPABILITY:
When you identify that the user's request relates to an EXISTING task (check the TASKS list above), you can suggest creating a subtask instead of a new task. Use this JSON format:
\`\`\`json:create_subtask
{
  "taskId": "the-task-id-from-above",
  "name": "Subtask name",
  "estimatedMinutes": 30
}
\`\`\`

IMPORTANT: Prefer creating SUBTASKS when:
- The work is directly related to an existing task
- It's a smaller piece of work that fits under a parent task
- The user is discussing or working on a specific existing task

The subtask will NOT be created automatically - the user will see a confirmation card.
`
  }, [projects, tasks])

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Update session messages
  const updateSessionMessages = useCallback((sessionId: string, newMessages: Message[], newTitle?: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          messages: newMessages,
          title: newTitle || session.title,
          updatedAt: Date.now(),
        }
      }
      return session
    }))
  }, [])

  // Create new session
  const handleNewSession = useCallback(() => {
    const newSession = createNewSession()
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
  }, [])

  // Start editing session title
  const handleStartEditSession = useCallback((sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId)
    setEditingSessionTitle(currentTitle)
  }, [])

  // Save edited session title
  const handleSaveSessionTitle = useCallback(() => {
    if (!editingSessionId || !editingSessionTitle.trim()) {
      setEditingSessionId(null)
      return
    }

    setSessions(prev => prev.map(session => {
      if (session.id === editingSessionId) {
        return { ...session, title: editingSessionTitle.trim() }
      }
      return session
    }))
    setEditingSessionId(null)
  }, [editingSessionId, editingSessionTitle])

  // Cancel editing
  const handleCancelEditSession = useCallback(() => {
    setEditingSessionId(null)
    setEditingSessionTitle('')
  }, [])

  // Handle keyboard events for session title editing
  const handleSessionTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveSessionTitle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEditSession()
    }
  }, [handleSaveSessionTitle, handleCancelEditSession])

  // Delete session
  const handleDeleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId)
      // If we're deleting the current session, switch to another one
      if (sessionId === currentSessionId) {
        if (filtered.length > 0) {
          setCurrentSessionId(filtered[0].id)
        } else {
          // Create a new session if all are deleted
          const newSession = createNewSession()
          setCurrentSessionId(newSession.id)
          return [newSession]
        }
      }
      return filtered
    })
  }, [currentSessionId])

  const handleSend = async () => {
    if (!input.trim() || aiState !== 'idle' || !currentSessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    const updatedMessages = [...messages, userMessage]

    // Generate title from first user message if it's still "New Chat"
    const isFirstUserMessage = messages.filter(m => m.role === 'user').length === 0
    const newTitle = isFirstUserMessage
      ? input.slice(0, 40) + (input.length > 40 ? '...' : '')
      : undefined

    updateSessionMessages(currentSessionId, updatedMessages, newTitle)
    const userInput = input
    addToHistory(userInput)
    setInput('')

    // Build conversation history for context
    const conversationHistory = updatedMessages
      .slice(-10) // Keep last 10 messages for context
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    // Check if we need to search or fetch URLs
    const webNeeds = detectWebNeeds(userInput)
    let webContext = ''

    if (webNeeds.needsSearch) {
      setAiState('searching')
      setStateStartTime(Date.now())

      // Fetch URLs mentioned in the message
      for (const url of webNeeds.urls) {
        webContext += await fetchUrl(url)
      }

      // Perform web searches
      for (const query of webNeeds.searchQueries) {
        webContext += await searchWeb(query)
      }
    }

    // Switch to thinking state
    const thinkingStartTime = Date.now()
    setAiState('thinking')
    setStateStartTime(thinkingStartTime)

    const fullContext = `${dataContext}
${webContext}

CONVERSATION HISTORY:
${conversationHistory}

Important: When the user refers to "this project", "it", "this task", etc., refer back to the conversation history to understand what they're talking about.
${webContext ? '\nYou have access to web search results above. Use this information to provide accurate, up-to-date answers.' : ''}`

    const response = await askQuestion(userInput, fullContext)
    const duration = Date.now() - thinkingStartTime
    setAiState('idle')
    setStateStartTime(null)

    if (response) {
      // Check if response contains task creation JSON blocks
      const taskCreateMatches = response.matchAll(/```json:create_task\s*([\s\S]*?)```/g)
      const matches = Array.from(taskCreateMatches)

      let finalResponse = response
      const pendingTasks: PendingTask[] = []

      if (matches.length > 0) {
        for (const match of matches) {
          try {
            // Clean up the JSON - remove extra newlines and spaces
            const jsonStr = match[1]
              .replace(/\n\s*/g, ' ')
              .replace(/,\s*}/g, '}')
              .trim()

            const taskData = JSON.parse(jsonStr)
            const project = projects.find(p => p.id === taskData.projectId)

            // Add to pending tasks instead of creating immediately
            pendingTasks.push({
              id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              projectId: taskData.projectId,
              projectName: project?.name || 'Unknown Project',
              name: taskData.name,
              description: taskData.description || '',
              priority: taskData.priority || 'medium',
              taskType: taskData.taskType || 'task',
              estimatedHours: taskData.estimatedHours || 0,
              status: 'pending',
            })
          } catch (e) {
            console.error('Failed to parse task creation JSON:', e, match[1])
          }
        }

        // Remove task JSON blocks from the response
        finalResponse = finalResponse.replace(/```json:create_task[\s\S]*?```/g, '').trim()
      }

      // Check if response contains subtask creation JSON blocks
      const subtaskCreateMatches = finalResponse.matchAll(/```json:create_subtask\s*([\s\S]*?)```/g)
      const subtaskMatches = Array.from(subtaskCreateMatches)
      const pendingSubtasks: PendingSubtask[] = []

      if (subtaskMatches.length > 0) {
        for (const match of subtaskMatches) {
          try {
            const jsonStr = match[1]
              .replace(/\n\s*/g, ' ')
              .replace(/,\s*}/g, '}')
              .trim()

            const subtaskData = JSON.parse(jsonStr)
            const parentTask = tasks.find(t => t.id === subtaskData.taskId)
            const project = parentTask ? projects.find(p => p.id === parentTask.projectId) : null

            pendingSubtasks.push({
              id: `pending-subtask-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              taskId: subtaskData.taskId,
              taskName: parentTask?.name || 'Unknown Task',
              projectName: project?.name || 'Unknown Project',
              name: subtaskData.name,
              estimatedMinutes: subtaskData.estimatedMinutes || 0,
              status: 'pending',
            })
          } catch (e) {
            console.error('Failed to parse subtask creation JSON:', e, match[1])
          }
        }

        // Remove subtask JSON blocks from the response
        finalResponse = finalResponse.replace(/```json:create_subtask[\s\S]*?```/g, '').trim()
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalResponse,
        pendingTasks: pendingTasks.length > 0 ? pendingTasks : undefined,
        pendingSubtasks: pendingSubtasks.length > 0 ? pendingSubtasks : undefined,
        duration,
      }

      // Get latest messages from state
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [...session.messages, assistantMessage],
            updatedAt: Date.now(),
          }
        }
        return session
      }))
    }
  }

  // Handle task approval
  const handleApproveTask = async (messageId: string, taskId: string) => {
    const message = messages.find(m => m.id === messageId)
    const pendingTask = message?.pendingTasks?.find(t => t.id === taskId)

    if (!pendingTask || !currentSessionId) return

    const result = await createTask({
      projectId: pendingTask.projectId,
      name: pendingTask.name,
      description: pendingTask.description,
      priority: pendingTask.priority as 'low' | 'medium' | 'high' | 'critical',
      taskType: pendingTask.taskType as 'task' | 'bug' | 'feature' | 'improvement' | 'documentation' | 'research',
      estimatedHours: pendingTask.estimatedHours,
    })

    // Update the pending task status
    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: session.messages.map(msg => {
            if (msg.id === messageId && msg.pendingTasks) {
              return {
                ...msg,
                pendingTasks: msg.pendingTasks.map(t =>
                  t.id === taskId ? { ...t, status: result ? 'approved' : 'rejected' as const } : t
                ),
              }
            }
            return msg
          }),
          updatedAt: Date.now(),
        }
      }
      return session
    }))

    if (result) {
      refetchTasks?.()
    }
  }

  // Handle task rejection
  const handleRejectTask = (messageId: string, taskId: string) => {
    if (!currentSessionId) return

    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: session.messages.map(msg => {
            if (msg.id === messageId && msg.pendingTasks) {
              return {
                ...msg,
                pendingTasks: msg.pendingTasks.map(t =>
                  t.id === taskId ? { ...t, status: 'rejected' as const } : t
                ),
              }
            }
            return msg
          }),
          updatedAt: Date.now(),
        }
      }
      return session
    }))
  }

  // Handle subtask approval
  const handleApproveSubtask = async (messageId: string, subtaskId: string) => {
    const message = messages.find(m => m.id === messageId)
    const pendingSubtask = message?.pendingSubtasks?.find(s => s.id === subtaskId)

    if (!pendingSubtask || !currentSessionId) return

    try {
      await subtasksApi.create({
        taskId: pendingSubtask.taskId,
        name: pendingSubtask.name,
        status: 'todo',
        estimatedMinutes: pendingSubtask.estimatedMinutes,
      })

      // Update the pending subtask status
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: session.messages.map(msg => {
              if (msg.id === messageId && msg.pendingSubtasks) {
                return {
                  ...msg,
                  pendingSubtasks: msg.pendingSubtasks.map(s =>
                    s.id === subtaskId ? { ...s, status: 'approved' as const } : s
                  ),
                }
              }
              return msg
            }),
            updatedAt: Date.now(),
          }
        }
        return session
      }))
    } catch (e) {
      console.error('Failed to create subtask:', e)
      // Mark as rejected on error
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: session.messages.map(msg => {
              if (msg.id === messageId && msg.pendingSubtasks) {
                return {
                  ...msg,
                  pendingSubtasks: msg.pendingSubtasks.map(s =>
                    s.id === subtaskId ? { ...s, status: 'rejected' as const } : s
                  ),
                }
              }
              return msg
            }),
            updatedAt: Date.now(),
          }
        }
        return session
      }))
    }
  }

  // Handle subtask rejection
  const handleRejectSubtask = (messageId: string, subtaskId: string) => {
    if (!currentSessionId) return

    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        return {
          ...session,
          messages: session.messages.map(msg => {
            if (msg.id === messageId && msg.pendingSubtasks) {
              return {
                ...msg,
                pendingSubtasks: msg.pendingSubtasks.map(s =>
                  s.id === subtaskId ? { ...s, status: 'rejected' as const } : s
                ),
              }
            }
            return msg
          }),
          updatedAt: Date.now(),
        }
      }
      return session
    }))
  }

  const handleClearChat = () => {
    if (!currentSessionId) return
    updateSessionMessages(currentSessionId, [defaultMessage], 'New Chat')
  }

  // Sort sessions by updatedAt (most recent first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [sessions])

  return (
    <div className="h-[calc(100vh-4rem)] flex -m-6">
      {/* Sessions Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col flex-shrink-0">
        <div className="p-3 border-b">
          <Button onClick={handleNewSession} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
                  session.id === currentSessionId
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  if (editingSessionId !== session.id) {
                    setCurrentSessionId(session.id)
                  }
                }}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                {editingSessionId === session.id ? (
                  <input
                    type="text"
                    value={editingSessionTitle}
                    onChange={(e) => setEditingSessionTitle(e.target.value)}
                    onBlur={handleSaveSessionTitle}
                    onKeyDown={handleSessionTitleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className={cn(
                      'flex-1 min-w-0 w-full bg-transparent border-none outline-none text-sm px-0 py-0',
                      session.id === currentSessionId
                        ? 'text-primary-foreground placeholder:text-primary-foreground/50'
                        : 'text-foreground'
                    )}
                    style={{ maxWidth: '100%' }}
                  />
                ) : (
                  <span
                    className="flex-1 truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      handleStartEditSession(session.id, session.title)
                    }}
                    title="Double-click to rename"
                  >
                    {session.title}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity',
                        session.id === currentSessionId
                          ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                          : 'hover:bg-muted-foreground/20'
                      )}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartEditSession(session.id, session.title)
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSession(session.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AI Assistant</h1>
              <p className="text-xs text-muted-foreground">
                {currentSession?.title || 'New Chat'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearChat}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background min-h-0">
          <ScrollArea className="flex-1 p-6 min-h-0">
            <div className="space-y-6">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  {message.role === 'user' ? (
                    <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                      <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 pt-0.5">
                    {message.role === 'user' ? (
                      <span className="inline-block bg-muted/50 px-3 py-2 rounded-lg">
                        <MessageContent content={message.content} isUser={true} />
                      </span>
                    ) : (
                      <div className="relative">
                        {message.duration && (
                          <div className="absolute -top-1 right-0 flex items-center gap-1 text-xs text-muted-foreground/60 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" />
                            <span>
                              {message.duration >= 1000
                                ? `${(message.duration / 1000).toFixed(1)}s`
                                : `${message.duration}ms`}
                            </span>
                          </div>
                        )}
                        <MessageContent content={message.content} isUser={false} />
                        {/* Pending Tasks Confirmation */}
                        {message.pendingTasks && message.pendingTasks.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {message.pendingTasks.map((task) => (
                              <div
                                key={task.id}
                                className={cn(
                                  'border rounded-lg p-4 transition-colors',
                                  task.status === 'approved' && 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
                                  task.status === 'rejected' && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 opacity-60',
                                  task.status === 'pending' && 'bg-muted/50 border-border'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                    task.status === 'approved' && 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
                                    task.status === 'rejected' && 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
                                    task.status === 'pending' && 'bg-primary/10 text-primary'
                                  )}>
                                    {task.status === 'approved' ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : task.status === 'rejected' ? (
                                      <XCircle className="h-4 w-4" />
                                    ) : (
                                      <ListTodo className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                        Task
                                      </span>
                                      <span className="font-medium text-foreground">{task.name}</span>
                                      <span className={cn(
                                        'text-xs px-2 py-0.5 rounded-full',
                                        task.priority === 'high' || task.priority === 'critical'
                                          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                          : task.priority === 'medium'
                                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                            : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                      )}>
                                        {task.priority}
                                      </span>
                                      {task.estimatedHours > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          ~{task.estimatedHours}h
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Project: <span className="text-foreground">{task.projectName}</span>
                                      <span className="mx-1">•</span>
                                      <span className="text-foreground">{task.taskType}</span>
                                    </p>
                                    {task.description && (
                                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}
                                    {task.status === 'approved' && (
                                      <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Task created successfully
                                      </p>
                                    )}
                                    {task.status === 'rejected' && (
                                      <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                                        <XCircle className="h-3.5 w-3.5" />
                                        Task creation cancelled
                                      </p>
                                    )}
                                  </div>
                                  {task.status === 'pending' && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                                        onClick={() => handleRejectTask(message.id, task.id)}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Reject
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                        onClick={() => handleApproveTask(message.id, task.id)}
                                      >
                                        <Check className="h-4 w-4 mr-1" />
                                        Create
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Pending Subtasks Confirmation */}
                        {message.pendingSubtasks && message.pendingSubtasks.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {message.pendingSubtasks.map((subtask) => (
                              <div
                                key={subtask.id}
                                className={cn(
                                  'border rounded-lg p-4 transition-colors',
                                  subtask.status === 'approved' && 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
                                  subtask.status === 'rejected' && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 opacity-60',
                                  subtask.status === 'pending' && 'bg-muted/50 border-border'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                    subtask.status === 'approved' && 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
                                    subtask.status === 'rejected' && 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
                                    subtask.status === 'pending' && 'bg-primary/10 text-primary'
                                  )}>
                                    {subtask.status === 'approved' ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : subtask.status === 'rejected' ? (
                                      <XCircle className="h-4 w-4" />
                                    ) : (
                                      <GitBranch className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium">
                                        Subtask
                                      </span>
                                      <span className="font-medium text-foreground">{subtask.name}</span>
                                      {subtask.estimatedMinutes > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          ~{subtask.estimatedMinutes}min
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Parent Task: <span className="text-foreground">{subtask.taskName}</span>
                                      <span className="mx-1">•</span>
                                      Project: <span className="text-foreground">{subtask.projectName}</span>
                                    </p>
                                    {subtask.status === 'approved' && (
                                      <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Subtask created successfully
                                      </p>
                                    )}
                                    {subtask.status === 'rejected' && (
                                      <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                                        <XCircle className="h-3.5 w-3.5" />
                                        Subtask creation cancelled
                                      </p>
                                    )}
                                  </div>
                                  {subtask.status === 'pending' && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                                        onClick={() => handleRejectSubtask(message.id, subtask.id)}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Reject
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                        onClick={() => handleApproveSubtask(message.id, subtask.id)}
                                      >
                                        <Check className="h-4 w-4 mr-1" />
                                        Create
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {aiState !== 'idle' && (
                <div className="flex gap-3">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    aiState === 'searching'
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                      : 'bg-gradient-to-br from-purple-500 to-blue-500'
                  )}>
                    {aiState === 'searching' ? (
                      <Search className="h-4 w-4 text-white animate-pulse" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <span className="text-muted-foreground">
                      {aiState === 'searching' ? 'Searching the web' : 'Thinking'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 ml-2 text-xs text-muted-foreground/70">
                      {aiState === 'searching' ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {elapsedTime >= 1000
                        ? `${(elapsedTime / 1000).toFixed(1)}s`
                        : `${Math.floor(elapsedTime / 100) * 100}ms`}
                    </span>
                  </div>
                </div>
              )}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t p-4 bg-card flex-shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex gap-3"
            >
              <Input
                ref={inputRef}
                placeholder="Ask me anything about your projects, tasks, or productivity..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  // Reset history navigation when typing
                  if (historyIndex !== -1) {
                    setHistoryIndex(-1)
                  }
                }}
                onKeyDown={handleKeyDown}
                disabled={aiState !== 'idle'}
                className="text-base py-5"
              />
              <Button type="submit" size="lg" disabled={aiState !== 'idle' || !input.trim()}>
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
