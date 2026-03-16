'use client'

import { useState, useEffect, useRef } from 'react'
import { ClaudeSessionFileChange } from '@/types'
import { FilePlus2, Pencil, Files, GitBranch, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToolCategory = 'read' | 'write' | 'edit' | 'bash' | 'search' | 'agent' | 'timer' | 'task-mgmt' | 'mcp' | 'todo' | 'other'

export interface OutputLine {
  text: string
  type: 'system' | 'assistant' | 'tool-call' | 'tool-result' | 'code-add' | 'code-remove' | 'error' | 'info' | 'user'
  toolCategory?: ToolCategory
}

export const toolCategoryColors: Record<ToolCategory, string> = {
  read:       'text-cyan-400/90 border-cyan-400/30',
  write:      'text-green-400/90 border-green-400/30',
  edit:       'text-amber-400/90 border-amber-400/30',
  bash:       'text-orange-400/90 border-orange-400/30',
  search:     'text-blue-400/90 border-blue-400/30',
  agent:      'text-purple-400/90 border-purple-400/30',
  timer:      'text-emerald-300 border-emerald-400/40',
  'task-mgmt':'text-indigo-400/90 border-indigo-400/30',
  mcp:        'text-pink-400/90 border-pink-400/30',
  todo:       'text-gray-600 border-gray-700/30',
  other:      'text-yellow-400/90 border-yellow-400/30',
}

export function parseTranscriptLine(raw: string): OutputLine | null {
  try {
    return JSON.parse(raw) as OutputLine
  } catch {
    return null
  }
}

export function TranscriptLine({ line }: { line: OutputLine }) {
  if (line.type === 'tool-call') {
    const cat = line.toolCategory || 'other'

    if (cat === 'timer') {
      return (
        <div className="my-1 mx-1 px-3 py-1.5 rounded-md bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[13px] flex items-center gap-2">
          <span className="opacity-70">&#9201;&#65039;</span>
          <span>{line.text.replace(/^⏱️\s*/, '')}</span>
        </div>
      )
    }

    if (cat === 'todo') {
      return (
        <div className="text-gray-600 text-xs py-0.5 pl-2 border-l border-gray-700/20 opacity-50">
          {line.text}
        </div>
      )
    }

    return (
      <div className={cn('break-words text-[13px] py-0.5 pl-2 border-l-2', toolCategoryColors[cat])}>
        {line.text}
      </div>
    )
  }

  if (line.type === 'code-add') {
    return (
      <pre className="text-xs py-0.5 pl-4 ml-2 bg-green-950/30 text-green-400/80 border-l-2 border-green-600/40 overflow-x-auto whitespace-pre">
        {line.text.split('\n').map((l, j) => <div key={j}>+ {l}</div>)}
      </pre>
    )
  }

  if (line.type === 'code-remove') {
    return (
      <pre className="text-xs py-0.5 pl-4 ml-2 bg-red-950/30 text-red-400/80 border-l-2 border-red-600/40 overflow-x-auto whitespace-pre">
        {line.text.split('\n').map((l, j) => <div key={j}>- {l}</div>)}
      </pre>
    )
  }

  if (line.type === 'user') {
    return (
      <div className="flex justify-end my-1">
        <div className="max-w-[80%] px-3 py-1.5 rounded-lg bg-blue-600/90 text-white text-sm whitespace-pre-wrap">
          <span className="text-[10px] font-medium text-blue-200 block mb-0.5">You:</span>
          {line.text}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'break-words',
        line.type === 'system' && 'text-blue-400 text-[13px] opacity-80 py-0.5',
        line.type === 'assistant' && 'text-gray-200 py-1 whitespace-pre-wrap',
        line.type === 'tool-result' && 'text-gray-500 text-[13px] py-0.5 pl-2 border-l-2 border-gray-600/30',
        line.type === 'error' && 'text-red-400 py-0.5',
        line.type === 'info' && 'text-gray-400 text-[13px] py-0.5',
      )}
    >
      {line.text}
    </div>
  )
}

/* ─── File Changes Panel (reusable) ──────────────────────────── */

interface FileChangesPanelProps {
  fileChanges: ClaudeSessionFileChange[]
  branchName?: string | null
  className?: string
}

export function FileChangesPanel({ fileChanges, branchName, className }: FileChangesPanelProps) {
  const [selectedFile, setSelectedFile] = useState<ClaudeSessionFileChange | null>(null)

  return (
    <div className={cn('bg-[#252526] overflow-y-auto font-mono', className)}>
      <div className="sticky top-0 z-10 bg-[#252526] border-b border-gray-700 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-300">
          <Files className="h-3.5 w-3.5" />
          <span>File Changes</span>
          {fileChanges.length > 0 && (
            <span className="ml-auto text-[10px] text-gray-500">
              {fileChanges.length} {fileChanges.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
        {branchName && (
          <div className="flex items-center gap-1.5 text-[11px] text-purple-400 bg-purple-950/30 rounded px-2 py-1">
            <GitBranch className="h-3 w-3 shrink-0" />
            <span className="truncate flex-1">{branchName}</span>
          </div>
        )}
      </div>
      {fileChanges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-600">
          <Files className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs">No file changes yet</p>
        </div>
      ) : (
        <div className="p-2 space-y-0.5">
          {fileChanges.map((fc) => {
            const totalAdded = fc.edits.reduce((sum, e) => {
              if (e.type === 'create' && e.content) return sum + e.content.split('\n').length
              if (e.type === 'edit' && e.newString) return sum + e.newString.split('\n').length
              return sum
            }, 0)
            const totalRemoved = fc.edits.reduce((sum, e) => {
              if (e.type === 'edit' && e.oldString) return sum + e.oldString.split('\n').length
              return sum
            }, 0)

            return (
              <button
                key={fc.filePath}
                onClick={() => setSelectedFile(fc)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs rounded hover:bg-[#2a2d2e] transition-colors text-left"
              >
                {fc.changeType === 'created' ? (
                  <FilePlus2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                ) : (
                  <Pencil className="h-3 w-3 text-amber-400 shrink-0" />
                )}
                <span className="truncate text-gray-300 flex-1" title={fc.filePath}>
                  {fc.shortPath}
                </span>
                <span className="flex items-center gap-1.5 shrink-0 ml-1">
                  {totalAdded > 0 && <span className="text-green-400 text-[10px]">+{totalAdded}</span>}
                  {totalRemoved > 0 && <span className="text-red-400 text-[10px]">-{totalRemoved}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* File diff modal */}
      {selectedFile && (
        <FileDiffModal file={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </div>
  )
}

/* ─── File Diff Modal ─────────────────────────────────────────── */

function FileDiffModal({ file, onClose }: { file: ClaudeSessionFileChange; onClose: () => void }) {
  const totalAdded = file.edits.reduce((sum, e) => {
    if (e.type === 'create' && e.content) return sum + e.content.split('\n').length
    if (e.type === 'edit' && e.newString) return sum + e.newString.split('\n').length
    return sum
  }, 0)
  const totalRemoved = file.edits.reduce((sum, e) => {
    if (e.type === 'edit' && e.oldString) return sum + e.oldString.split('\n').length
    return sum
  }, 0)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-[#252526] rounded-t-lg shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {file.changeType === 'created' ? (
              <FilePlus2 className="h-4 w-4 text-green-400 shrink-0" />
            ) : (
              <Pencil className="h-4 w-4 text-amber-400 shrink-0" />
            )}
            <span className="text-sm font-medium text-gray-200 truncate" title={file.filePath}>
              {file.filePath}
            </span>
            <span className="text-xs text-gray-500 shrink-0">
              ({file.changeType === 'created' ? 'new file' : `${file.edits.length} edit${file.edits.length !== 1 ? 's' : ''}`})
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-2 text-xs">
              {totalAdded > 0 && <span className="text-green-400">+{totalAdded}</span>}
              {totalRemoved > 0 && <span className="text-red-400">-{totalRemoved}</span>}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Edits */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
          {file.edits.map((edit, ei) => (
            <div key={ei} className="rounded-md overflow-hidden border border-gray-800">
              <div className="px-3 py-1.5 text-xs text-gray-400 bg-[#252526] border-b border-gray-800 flex items-center justify-between">
                <span>{edit.type === 'create' ? 'File created' : `Edit ${ei + 1} of ${file.edits.length}`}</span>
                <span className="text-gray-600">
                  {edit.type === 'create' && edit.content && `${edit.content.split('\n').length} lines`}
                  {edit.type === 'edit' && (
                    <>
                      {edit.oldString && <span className="text-red-400/70">-{edit.oldString.split('\n').length}</span>}
                      {edit.oldString && edit.newString && <span className="mx-1">/</span>}
                      {edit.newString && <span className="text-green-400/70">+{edit.newString.split('\n').length}</span>}
                    </>
                  )}
                </span>
              </div>

              {edit.type === 'create' && edit.content && (
                <pre className="p-3 text-[12px] text-green-400/80 whitespace-pre overflow-x-auto leading-relaxed">
                  {edit.content.split('\n').map((l, j) => (
                    <div key={j} className="hover:bg-green-950/20">
                      <span className="inline-block w-10 text-right text-gray-600 select-none mr-3">{j + 1}</span>
                      <span className="text-green-600 select-none mr-1">+</span>{l}
                    </div>
                  ))}
                </pre>
              )}

              {edit.type === 'edit' && (
                <>
                  {edit.oldString && (
                    <pre className="p-3 text-[12px] bg-red-950/10 text-red-400/80 whitespace-pre overflow-x-auto leading-relaxed border-b border-gray-800">
                      {edit.oldString.split('\n').map((l, j) => (
                        <div key={j} className="hover:bg-red-950/20">
                          <span className="inline-block w-10 text-right text-gray-600 select-none mr-3">{j + 1}</span>
                          <span className="text-red-600 select-none mr-1">-</span>{l}
                        </div>
                      ))}
                    </pre>
                  )}
                  {edit.newString && (
                    <pre className="p-3 text-[12px] bg-green-950/10 text-green-400/80 whitespace-pre overflow-x-auto leading-relaxed">
                      {edit.newString.split('\n').map((l, j) => (
                        <div key={j} className="hover:bg-green-950/20">
                          <span className="inline-block w-10 text-right text-gray-600 select-none mr-3">{j + 1}</span>
                          <span className="text-green-600 select-none mr-1">+</span>{l}
                        </div>
                      ))}
                    </pre>
                  )}
                </>
              )}

              {edit.type === 'create' && !edit.content && (
                <div className="px-3 py-4 text-xs text-gray-600 italic">File content not captured</div>
              )}
              {edit.type === 'edit' && !edit.oldString && !edit.newString && (
                <div className="px-3 py-4 text-xs text-gray-600 italic">Edit details not captured</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Transcript Viewer (with optional file changes panel) ──── */

interface TranscriptViewerProps {
  transcript: string[]
  fileChanges?: ClaudeSessionFileChange[]
  branchName?: string | null
  autoScroll?: boolean
  className?: string
}

export function TranscriptViewer({ transcript, fileChanges, branchName, autoScroll, className }: TranscriptViewerProps) {
  const lines = transcript.map(parseTranscriptLine).filter(Boolean) as OutputLine[]
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [transcript.length, autoScroll])

  const hasFileChanges = fileChanges && fileChanges.length > 0

  return (
    <div className={cn('flex rounded-lg overflow-hidden', className)}>
      {/* Transcript */}
      <div
        ref={containerRef}
        className={cn(
          'bg-[#1e1e1e] overflow-y-auto p-4 font-mono text-sm leading-relaxed',
          hasFileChanges ? 'flex-1 min-w-0' : 'w-full',
        )}
      >
        {lines.length === 0 ? (
          <p className="text-gray-500 text-sm">No transcript data available.</p>
        ) : (
          lines.map((line, i) => <TranscriptLine key={i} line={line} />)
        )}
      </div>

      {/* File Changes side panel */}
      {hasFileChanges && (
        <FileChangesPanel
          fileChanges={fileChanges}
          branchName={branchName}
          className="w-72 shrink-0 border-l border-gray-700"
        />
      )}
    </div>
  )
}
