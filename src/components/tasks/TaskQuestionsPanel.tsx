'use client'

import { useState } from 'react'
import {
  HelpCircle,
  Pencil,
  Loader2,
  Check,
  MessageSquareWarning,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { useTaskQuestions } from '@/hooks/useTaskQuestions'
import { TaskQuestion } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface PanelProps {
  taskId: string
  taskName: string
}

/**
 * Right-sidebar button-panel that opens the questions dialog.
 * Hidden when the task has no questions.
 */
export function TaskQuestionsPanel({ taskId, taskName }: PanelProps) {
  const { questions, loading, unansweredCount, answerQuestion } = useTaskQuestions(taskId)
  const [open, setOpen] = useState(false)

  if (loading || questions.length === 0) {
    return null
  }

  const total = questions.length
  const allAnswered = unansweredCount === 0

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          Questions
        </Label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            allAnswered
              ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
              : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {allAnswered ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            ) : (
              <MessageSquareWarning className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span className="text-sm font-medium">
              {allAnswered ? 'All answered' : 'Needs your answer'}
            </span>
            {!allAnswered && (
              <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                {unansweredCount}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {total} question{total === 1 ? '' : 's'}
            {!allAnswered && ` · ${unansweredCount} pending`}
            {' · click to review'}
          </p>
        </button>
      </div>

      <TaskQuestionsDialog
        open={open}
        onOpenChange={setOpen}
        taskName={taskName}
        questions={questions}
        unansweredCount={unansweredCount}
        onAnswer={answerQuestion}
      />
    </>
  )
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskName: string
  questions: TaskQuestion[]
  unansweredCount: number
  onAnswer: (id: string, answer: string) => Promise<void>
}

function TaskQuestionsDialog({
  open,
  onOpenChange,
  taskName,
  questions,
  unansweredCount,
  onAnswer,
}: DialogProps) {
  // Pending first, then answered (oldest first within each group)
  const sorted = [...questions].sort((a, b) => {
    const aPending = a.answer === null ? 0 : 1
    const bPending = b.answer === null ? 0 : 1
    if (aPending !== bPending) return aPending - bPending
    return (a.askedAt?.toMillis() ?? 0) - (b.askedAt?.toMillis() ?? 0)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-7xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            Questions
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="font-medium text-foreground block">{taskName}</span>
            <span className="text-xs">
              {questions.length} total
              {unansweredCount > 0 && ` · ${unansweredCount} pending your answer`}
              {unansweredCount === 0 && ' · all answered'}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {sorted.map((q) => (
            <QuestionCard key={q.id} question={q} onSave={(t) => onAnswer(q.id, t)} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Question parsing — Claude writes a specific format we want to render structurally:
//   **[Optional tag]** Question prose? **A)** Option A. **B)** Option B. *(★ Recommend X — reasoning)*
//
// We split it into { tag, lead, options[], recommendation } so each piece can be
// laid out distinctly: bold question, options on separate lines, and the
// recommendation in its own visually distinct block.
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedOption {
  label: string
  text: string
  recommended: boolean
}

interface ParsedQuestion {
  tag: string | null
  lead: string
  options: ParsedOption[]
  recommendation: string | null
}

// Two option formats are supported:
//   1. `**A)**` (older format) — bold-wrapped letter, no per-option recommend mark
//   2. `A★)` or `A)` (newer inline format) — plain letter with optional ★ marking the option as recommended
//
// The `(?<=^|[\s,;:])` lookbehind requires a boundary before the marker so we don't match `B)` inside prose like "API (B) is preferred".
const OPTION_REGEX = /(?<=^|[\s,;:])(\*\*)?([A-Z])(★*)\)(\*\*)?\s*/g

function parseQuestion(text: string): ParsedQuestion {
  const original = text.trim()

  // Leading **[Tag]** (optional)
  const tagMatch = original.match(/^\*\*\[([^\]]+)\]\*\*\s*/)
  const tag = tagMatch ? tagMatch[1].trim() : null
  const afterTag = tagMatch ? original.slice(tagMatch[0].length) : original

  // Trailing *(★ recommendation text)* — non-greedy, anchored to end (still supported for older questions)
  const recMatch = afterTag.match(/\*\(★\s*(.+?)\s*\)\*\s*$/)
  const recommendation = recMatch ? recMatch[1] : null
  const body = recMatch ? afterTag.slice(0, recMatch.index).trim() : afterTag.trim()

  const matches = [...body.matchAll(OPTION_REGEX)]
  if (matches.length === 0) {
    return { tag, lead: body, options: [], recommendation }
  }

  const lead = body.slice(0, matches[0].index).trim()
  const options: ParsedOption[] = matches.map((m, i) => {
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length
    return {
      label: m[2],
      text: body.slice(start, end).trim().replace(/[,;.\s]+$/, ''),
      recommended: (m[3] || '').length > 0,
    }
  })

  return { tag, lead, options, recommendation }
}

// Inline markdown renderer — handles **bold**, *italic*, and `code` without
// spinning up a Tiptap editor instance per option (would be 20–30 instances
// in a dialog with several questions).
function InlineMD({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[1]) {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-muted font-mono text-[0.85em]"
        >
          {match[1].slice(1, -1)}
        </code>,
      )
    } else if (match[2]) {
      parts.push(<strong key={key++}>{match[2].slice(2, -2)}</strong>)
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3].slice(1, -1)}</em>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return <>{parts}</>
}

// Toggle a letter in/out of the answer draft.
// - Empty draft → set to the letter.
// - Letter-only draft (e.g. "A", "A, C", "A+C+E") → toggle this letter, preserving the user's existing separator.
// - Freeform draft (sentences, prose) → append ", <letter>" at the end (no toggle, since the regex can't safely
//   identify the letter as a "selection" inside arbitrary prose).
function toggleLetterInDraft(draft: string, letter: string): string {
  const trimmed = draft.trim()
  if (trimmed === '') return letter

  const letterOnlyRegex = /^[A-Z](\s*[,+]\s*[A-Z])*$/
  if (letterOnlyRegex.test(trimmed)) {
    const sep = trimmed.includes('+') ? '+' : ', '
    const tokens = trimmed.split(/\s*[,+]\s*/).filter(Boolean)
    if (tokens.includes(letter)) {
      return tokens.filter((t) => t !== letter).join(sep)
    }
    return [...tokens, letter].join(sep)
  }

  // Freeform — already-typed prose. Append unless letter is the last visible token.
  if (new RegExp(`(^|[^A-Za-z])${letter}\\s*$`).test(trimmed)) return draft
  return `${trimmed}, ${letter}`
}

// Returns the set of letters currently "selected" in the draft (only meaningful in letter-only mode).
function selectedLetters(draft: string): Set<string> {
  const trimmed = draft.trim()
  if (!/^[A-Z](\s*[,+]\s*[A-Z])*$/.test(trimmed)) return new Set()
  return new Set(trimmed.split(/\s*[,+]\s*/).filter(Boolean))
}

/**
 * Renders a saved answer. If the answer text follows the same option-marker format as questions
 * (e.g. lead text + `A) Foo, B★) Bar`), render it with the same structured layout. Otherwise,
 * fall back to plain markdown rendering.
 */
function StructuredAnswer({ text }: { text: string }) {
  const parsed = parseQuestion(text)
  const hasStructure = parsed.options.length > 0

  if (!hasStructure) {
    return <MarkdownContent content={text} className="prose-viewer comment-markdown text-sm" />
  }

  return (
    <div className="space-y-2 text-sm">
      {parsed.lead && (
        <div className="leading-relaxed">
          <InlineMD text={parsed.lead} />
        </div>
      )}
      <div className="space-y-1 pl-1">
        {parsed.options.map((opt) => (
          <div key={opt.label} className="flex items-start gap-2.5 leading-relaxed">
            <span
              className={`relative font-bold shrink-0 w-7 h-6 flex items-center justify-center rounded select-none ${
                opt.recommended
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                  : 'text-primary'
              }`}
            >
              {opt.label}
              {opt.recommended && (
                <span className="absolute -top-1 -right-1 text-[9px] leading-none text-amber-500" aria-hidden>
                  ★
                </span>
              )}
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <InlineMD text={opt.text} />
            </div>
          </div>
        ))}
      </div>
      {parsed.recommendation && (
        <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 italic">
          <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <InlineMD text={parsed.recommendation} />
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionCard({
  question,
  onSave,
}: {
  question: TaskQuestion
  onSave: (text: string) => Promise<void>
}) {
  const isAnswered = question.answer !== null
  const [editing, setEditing] = useState(!isAnswered)
  const [draft, setDraft] = useState(question.answer ?? '')
  const [saving, setSaving] = useState(false)

  const handlePickOption = (letter: string) => {
    setEditing(true)
    setDraft((current) => toggleLetterInDraft(current, letter))
  }

  // For visual highlighting — only meaningful when in edit mode + letter-only draft
  const selected = editing ? selectedLetters(draft) : new Set<string>()

  const handleSave = async () => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const askedAt = question.askedAt?.toDate
    ? formatDistanceToNow(question.askedAt.toDate(), { addSuffix: true })
    : ''
  const answeredAt = question.answeredAt?.toDate
    ? formatDistanceToNow(question.answeredAt.toDate(), { addSuffix: true })
    : ''

  const parsed = parseQuestion(question.question)

  return (
    <div
      className={`rounded-lg border ${
        isAnswered
          ? 'border-border bg-card'
          : 'border-amber-500/40 bg-amber-500/5'
      }`}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-muted/30 dark:bg-muted/10 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          {isAnswered ? (
            <Badge variant="secondary" className="gap-1 shrink-0">
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              Answered
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1 shrink-0">
              <MessageSquareWarning className="h-3 w-3" />
              Pending
            </Badge>
          )}
          {parsed.tag && (
            <Badge variant="outline" className="text-xs font-medium truncate">
              {parsed.tag}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate shrink-0">
          {question.askedBy}
          {askedAt && ` · ${askedAt}`}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Lead question — bold */}
        {parsed.lead && (
          <div className="font-bold text-base leading-relaxed">
            <InlineMD text={parsed.lead} />
          </div>
        )}

        {/* Options — each on its own line, letter prominent. Click to toggle letter into the answer textarea.
            Options marked with ★ in the source (e.g. `A★)`) render as "recommended" with an amber tint + star marker. */}
        {parsed.options.length > 0 && (
          <div className="space-y-1 pl-1">
            {parsed.options.map((opt) => {
              const isSelected = selected.has(opt.label)
              const tooltip = `Click to ${isSelected ? 'remove' : 'insert'} option ${opt.label} in your answer${
                opt.recommended ? ' (recommended)' : ''
              }`
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handlePickOption(opt.label)}
                  title={tooltip}
                  className={`group w-full flex items-start gap-2.5 text-left text-sm leading-relaxed rounded-md px-2 py-1.5 transition-colors ${
                    isSelected
                      ? 'bg-primary/15 ring-1 ring-primary/30'
                      : opt.recommended
                        ? 'hover:bg-amber-500/10'
                        : 'hover:bg-muted/60'
                  }`}
                >
                  <span
                    className={`relative font-bold shrink-0 w-7 h-6 flex items-center justify-center rounded select-none transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : opt.recommended
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 group-hover:bg-amber-500/25'
                          : 'text-primary group-hover:bg-primary/10'
                    }`}
                  >
                    {opt.label}
                    {opt.recommended && (
                      <span
                        className={`absolute -top-1 -right-1 text-[9px] leading-none ${
                          isSelected ? 'text-amber-200' : 'text-amber-500'
                        }`}
                        aria-hidden
                      >
                        ★
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <InlineMD text={opt.text} />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Recommendation — distinct amber block on its own line */}
        {parsed.recommendation && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm italic text-amber-900 dark:text-amber-200">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <InlineMD text={parsed.recommendation} />
            </div>
          </div>
        )}

        {/* Fallback: if parsing produced nothing usable, render as raw markdown */}
        {!parsed.lead && parsed.options.length === 0 && !parsed.recommendation && (
          <MarkdownContent
            content={question.question}
            className="prose-viewer comment-markdown text-sm"
          />
        )}
      </div>

      {/* Answer area */}
      <div className="border-t px-4 py-3 bg-muted/20 dark:bg-muted/5 rounded-b-lg">
        {editing ? (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {isAnswered ? 'Edit your answer' : 'Your answer'}
            </Label>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                parsed.options.length > 0
                  ? `Type your answer (e.g. "${parsed.options[0].label}" or your own — markdown supported)`
                  : 'Type your answer (markdown supported)...'
              }
              className="min-h-[100px] text-sm bg-background"
            />
            <div className="flex justify-end gap-2">
              {isAnswered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(question.answer ?? '')
                    setEditing(false)
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving || !draft.trim()}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                Save answer
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">
                Answer{answeredAt && ` · ${answeredAt}`}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            <StructuredAnswer text={question.answer ?? ''} />
          </div>
        )}
      </div>
    </div>
  )
}
