'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAI } from '@/hooks/useAI'
import { Sparkles, Send, Loader2, X, User, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface AIAssistantProps {
  open: boolean
  onClose: () => void
  context?: string
}

// Simple markdown renderer for AI responses
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  const processInlineMarkdown = (line: string): React.ReactNode => {
    // Process bold (**text**) and italic (*text*)
    const parts: React.ReactNode[] = []
    let remaining = line
    let key = 0

    while (remaining.length > 0) {
      // Check for bold **text**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
      // Check for italic *text* (but not **)
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/)

      if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
        const before = remaining.slice(0, boldMatch.index)
        if (before) parts.push(before)
        parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>)
        remaining = remaining.slice(boldMatch.index! + boldMatch[0].length)
      } else if (italicMatch) {
        const before = remaining.slice(0, italicMatch.index)
        if (before) parts.push(before)
        parts.push(<em key={key++}>{italicMatch[1]}</em>)
        remaining = remaining.slice(italicMatch.index! + italicMatch[0].length)
      } else {
        parts.push(remaining)
        break
      }
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>
  }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="list-disc list-inside space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i}>{processInlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    // Check for bullet points
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      listItems.push(trimmedLine.slice(2))
    } else {
      flushList()

      if (trimmedLine === '') {
        // Empty line - add spacing
        if (index > 0 && index < lines.length - 1) {
          elements.push(<div key={elements.length} className="h-2" />)
        }
      } else {
        // Regular paragraph
        elements.push(
          <p key={elements.length} className="leading-relaxed">
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

export function AIAssistant({ open, onClose, context }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'm your WorkHub AI assistant. I can help you with task planning, time estimates, and productivity insights. What would you like to know?",
    },
  ])
  const [input, setInput] = useState('')
  const { loading, askQuestion } = useAI()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')

    const response = await askQuestion(input, context)

    if (response) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      }
      setMessages((prev) => [...prev, assistantMessage])
    }
  }

  if (!open) return null

  return (
    <Card className="fixed bottom-6 right-6 w-[450px] h-[600px] shadow-2xl z-50 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between border-b py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <CardTitle className="text-base">AI Assistant</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                )}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  'rounded-lg px-3 py-2 max-w-[80%] text-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <MessageContent content={message.content} isUser={message.role === 'user'} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                Thinking...
              </div>
            </div>
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <CardContent className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
