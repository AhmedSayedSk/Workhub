'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { Maximize2, ExternalLink, Loader2, AlertTriangle, GitBranch, RefreshCw, FileText, Sparkles } from 'lucide-react'
import type { Project, SikagitRepo, RepoGraphNode, RepoGraphEdge } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { projectRepoGraph, repoSummaries } from '@/lib/firestore'
import { authFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { StageEmptyState } from './StageEmptyState'
import { FloatingEdge } from './FloatingEdge'
import Link from 'next/link'

interface Props { project: Project; canEdit: boolean }

interface RepoNodeData extends Record<string, unknown> {
  repo: SikagitRepo
  preview: string
  loadingReadme: boolean
  onExpand: (repo: SikagitRepo) => void
  isPendingSource?: boolean
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 140
const SAVE_DEBOUNCE_MS = 700

function dagreLayout(repos: SikagitRepo[]): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 80 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const r of repos) g.setNode(r.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  dagre.layout(g)
  const out: Record<string, { x: number; y: number }> = {}
  for (const r of repos) {
    const n = g.node(r.id)
    if (n) out[r.id] = { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 }
  }
  return out
}

function RepoNode({ data }: { data: RepoNodeData }) {
  const { repo, preview, loadingReadme, onExpand, isPendingSource } = data
  return (
    <div
      className={`group rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow ${
        isPendingSource ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-background' : ''
      }`}
      style={{ width: NODE_WIDTH }}
    >
      {/* 4 connection circles — hidden until node is hovered. T+R outgoing, B+L incoming. */}
      <Handle id="t" type="source" position={Position.Top} className="!h-2.5 !w-2.5 !bg-cyan-500 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
      <Handle id="r" type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-cyan-500 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
      <Handle id="b" type="target" position={Position.Bottom} className="!h-2.5 !w-2.5 !bg-cyan-500 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
      <Handle id="l" type="target" position={Position.Left} className="!h-2.5 !w-2.5 !bg-cyan-500 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-semibold truncate">{repo.name}</p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onExpand(repo) }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Expand README"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 pt-2 pb-3">
        {loadingReadme ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Summarizing…
          </div>
        ) : preview ? (
          <p className="text-xs text-muted-foreground">{preview}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">No README found</p>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { repoNode: RepoNode }
const edgeTypes = { floating: FloatingEdge }

/** One-direction arrow at the target end of every wire. */
const EDGE_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 18,
  height: 18,
} as const

/** Shared wire styling. */
const EDGE_STYLE = { strokeWidth: 2 } as const

function ReposStageInner({ project, canEdit }: Props) {
  const { settings } = useSettings()
  const { user } = useAuth()

  const dbPath = settings?.sikagitDbPath ?? ''
  const pathPrefix = settings?.sikagitPathPrefix ?? ''
  const sikagitProjectId = project.sikagitProjectId ?? ''
  const sikagitRepoId = project.sikagitRepoId ?? ''

  const [repos, setRepos] = useState<SikagitRepo[]>([])
  const [readmeByRepo, setReadmeByRepo] = useState<Record<string, string | null>>({})
  const [summaryByRepo, setSummaryByRepo] = useState<Record<string, string | null>>({})
  const [summariesLoaded, setSummariesLoaded] = useState(false)
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<Node<RepoNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [expandedRepo, setExpandedRepo] = useState<SikagitRepo | null>(null)
  const [expandedReadme, setExpandedReadme] = useState<string | null>(null)
  const [expandedLoading, setExpandedLoading] = useState(false)
  const [showFullReadme, setShowFullReadme] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstLayoutRef = useRef(true)
  const summaryInflightRef = useRef<Set<string>>(new Set())

  // Latest summary/readme maps, readable at async-resolve time inside effects
  // whose dep arrays intentionally exclude them (avoids stale-closure wipes).
  const summaryMapRef = useRef(summaryByRepo)
  summaryMapRef.current = summaryByRepo
  const readmeMapRef = useRef(readmeByRepo)
  readmeMapRef.current = readmeByRepo

  // Load cached AI summaries from Firestore.
  useEffect(() => {
    let cancelled = false
    repoSummaries.listByProject(project.id)
      .then((list) => {
        if (cancelled) return
        const map: Record<string, string | null> = {}
        for (const s of list) map[s.repoId] = s.summary
        setSummaryByRepo(map)
        setSummariesLoaded(true)
      })
      .catch(() => { if (!cancelled) setSummariesLoaded(true) })
    return () => { cancelled = true }
  }, [project.id])

  /** Generate (or regenerate) the AI summary for one repo and cache it in Firestore. */
  const generateSummary = useCallback(async (repo: SikagitRepo, readme: string): Promise<string | null> => {
    if (!user) return null
    try {
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize_repo', data: { repoName: repo.name, readme } }),
      })
      const result = await response.json()
      if (!result.success || !result.data?.summary) return null
      const summary: string = result.data.summary
      setSummaryByRepo((prev) => ({ ...prev, [repo.id]: summary }))
      repoSummaries.save(project.id, repo.id, summary, user.uid).catch(() => {})
      return summary
    } catch {
      return null
    }
  }, [user, project.id])

  // Auto-generate missing summaries once READMEs arrive (one inflight per repo).
  useEffect(() => {
    if (!summariesLoaded || repos.length === 0) return
    for (const repo of repos) {
      const readme = readmeByRepo[repo.id]
      if (!readme) continue // no README → nothing to summarize
      if (summaryByRepo[repo.id]) continue // already cached
      if (summaryInflightRef.current.has(repo.id)) continue
      summaryInflightRef.current.add(repo.id)
      generateSummary(repo, readme).finally(() => {
        summaryInflightRef.current.delete(repo.id)
      })
    }
  }, [summariesLoaded, repos, readmeByRepo, summaryByRepo, generateSummary])

  // Reflect `pendingSourceId` into each node's data so RepoNode can render a ring.
  useEffect(() => {
    setNodes((curr) =>
      curr.map((n) => {
        const isPending = n.id === pendingSourceId
        if ((n.data as RepoNodeData).isPendingSource === isPending) return n
        return { ...n, data: { ...(n.data as RepoNodeData), isPendingSource: isPending } }
      }),
    )
  }, [pendingSourceId])

  // Esc cancels the pending source selection.
  useEffect(() => {
    if (pendingSourceId === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingSourceId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingSourceId])

  // Stable callback for the node's "expand" button.
  const onExpand = useCallback((repo: SikagitRepo) => {
    setExpandedRepo(repo)
    setExpandedReadme(null)
    setShowFullReadme(false)
    setExpandedLoading(true)
    if (!dbPath) {
      setExpandedReadme(null)
      setExpandedLoading(false)
      return
    }
    const params = new URLSearchParams({ dbPath })
    if (pathPrefix) params.set('pathPrefix', pathPrefix)
    fetch(`/api/sikagit/repos/${encodeURIComponent(repo.id)}/readme?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setExpandedReadme(data?.readme?.content ?? null)
      })
      .catch(() => setExpandedReadme(null))
      .finally(() => setExpandedLoading(false))
  }, [dbPath, pathPrefix])

  // 1) Load repos — either the linked sikagit project's repos, or the single linked repo
  useEffect(() => {
    if (!dbPath || (!sikagitProjectId && !sikagitRepoId)) { setRepos([]); return }
    let cancelled = false
    setLoadingRepos(true)
    setError(null)
    const params = new URLSearchParams({ dbPath })
    if (pathPrefix) params.set('pathPrefix', pathPrefix)
    const url = sikagitProjectId
      ? `/api/sikagit/projects/${encodeURIComponent(sikagitProjectId)}/repos?${params.toString()}`
      : `/api/sikagit/repos/${encodeURIComponent(sikagitRepoId)}?${params.toString()}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) { setError(data.error); setRepos([]); return }
        setRepos(data.repos ?? (data.repo ? [data.repo] : []))
      })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoadingRepos(false) })
    return () => { cancelled = true }
  }, [dbPath, pathPrefix, sikagitProjectId, sikagitRepoId])

  // 2) Fetch README previews for each repo (small)
  useEffect(() => {
    if (!dbPath || repos.length === 0) return
    let cancelled = false
    const params = new URLSearchParams({ dbPath })
    if (pathPrefix) params.set('pathPrefix', pathPrefix)
    for (const repo of repos) {
      if (readmeByRepo[repo.id] !== undefined) continue
      fetch(`/api/sikagit/repos/${encodeURIComponent(repo.id)}/readme?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          setReadmeByRepo((prev) => ({ ...prev, [repo.id]: data?.readme?.content ?? null }))
        })
        .catch(() => {
          if (!cancelled) setReadmeByRepo((prev) => ({ ...prev, [repo.id]: null }))
        })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, dbPath, pathPrefix])

  // 3) Load saved graph from Firestore, then build nodes + edges
  useEffect(() => {
    if (repos.length === 0) { setNodes([]); setEdges([]); return }
    let cancelled = false
    ;(async () => {
      const saved = await projectRepoGraph.get(project.id).catch(() => null)
      if (cancelled) return

      const savedPositions: Record<string, { x: number; y: number }> = {}
      for (const n of saved?.nodes ?? []) savedPositions[n.repoId] = { x: n.x, y: n.y }
      const missing = repos.filter((r) => !(r.id in savedPositions))
      const autoPositions = missing.length > 0 ? dagreLayout(missing) : {}

      const nextNodes: Node<RepoNodeData>[] = repos.map((repo) => {
        const pos = savedPositions[repo.id] ?? autoPositions[repo.id] ?? { x: 0, y: 0 }
        // Read through refs: this runs after an await, so state captured in the
        // effect closure may be stale by now.
        const summary = summaryMapRef.current[repo.id] ?? ''
        return {
          id: repo.id,
          type: 'repoNode',
          position: pos,
          data: {
            repo,
            preview: summary,
            loadingReadme: !summary && readmeMapRef.current[repo.id] !== null,
            onExpand,
          },
        }
      })
      const nextEdges: Edge[] = (saved?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.sourceRepoId,
        target: e.targetRepoId,
        label: e.label ?? undefined,
        type: 'floating',
        animated: false,
        markerEnd: EDGE_MARKER,
        style: EDGE_STYLE,
      }))
      setNodes(nextNodes)
      setEdges(nextEdges)
      isFirstLayoutRef.current = !saved
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, project.id, onExpand])

  // Keep node previews in sync when AI summaries arrive or change.
  useEffect(() => {
    setNodes((curr) => {
      let changed = false
      const next = curr.map((n) => {
        const r = (n.data as RepoNodeData).repo
        const preview = summaryByRepo[r.id] ?? ''
        // Still "loading" while there is (or may be) a README but no summary yet.
        const loadingReadme = !preview && readmeByRepo[r.id] !== null
        if (
          (n.data as RepoNodeData).preview === preview &&
          (n.data as RepoNodeData).loadingReadme === loadingReadme
        ) return n
        changed = true
        return { ...n, data: { ...(n.data as RepoNodeData), preview, loadingReadme } }
      })
      return changed ? next : curr
    })
  }, [summaryByRepo, readmeByRepo])

  // Persist the graph (debounced)
  const scheduleSave = useCallback((nextNodes: Node<RepoNodeData>[], nextEdges: Edge[]) => {
    if (!canEdit || !user) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      const payloadNodes: RepoGraphNode[] = nextNodes.map((n) => ({
        repoId: n.id,
        x: n.position.x,
        y: n.position.y,
      }))
      const payloadEdges: RepoGraphEdge[] = nextEdges.map((e) => ({
        id: e.id,
        sourceRepoId: e.source,
        targetRepoId: e.target,
        label: typeof e.label === 'string' ? e.label : null,
      }))
      projectRepoGraph
        .save(project.id, { nodes: payloadNodes, edges: payloadEdges }, user.uid)
        .catch((err) => console.error('Failed to save repo graph', err))
    }, SAVE_DEBOUNCE_MS)
  }, [canEdit, user, project.id])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((curr) => {
      const next = applyNodeChanges(changes, curr) as Node<RepoNodeData>[]
      // Only schedule save if there's a position change (not selection-only)
      if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
        scheduleSave(next, edges)
      }
      return next
    })
  }, [edges, scheduleSave])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((curr) => {
      const next = applyEdgeChanges(changes, curr)
      if (changes.some((c) => c.type === 'remove')) {
        scheduleSave(nodes, next)
      }
      return next
    })
  }, [nodes, scheduleSave])

  const handleConnect: OnConnect = useCallback((conn: Connection) => {
    setEdges((curr) => {
      const id = `e_${conn.source}_${conn.target}_${Date.now()}`
      const next = addEdge({ ...conn, id, type: 'floating', markerEnd: EDGE_MARKER, style: EDGE_STYLE }, curr)
      scheduleSave(nodes, next)
      return next
    })
  }, [nodes, scheduleSave])

  // ===== Right-click wiring =====
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    if (!canEdit) return
    if (pendingSourceId === null) {
      setPendingSourceId(node.id)
      return
    }
    if (pendingSourceId === node.id) {
      setPendingSourceId(null)
      return
    }
    setEdges((curr) => {
      if (curr.some((e) => e.source === pendingSourceId && e.target === node.id)) return curr
      const id = `e_${pendingSourceId}_${node.id}_${Date.now()}`
      const next = addEdge(
        { id, source: pendingSourceId, target: node.id, type: 'floating', animated: false, markerEnd: EDGE_MARKER, style: EDGE_STYLE },
        curr,
      )
      scheduleSave(nodes, next)
      return next
    })
    setPendingSourceId(null)
  }, [canEdit, pendingSourceId, nodes, scheduleSave])

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    if (!canEdit) return
    setEdges((curr) => {
      const next = curr.filter((e) => e.id !== edge.id)
      scheduleSave(nodes, next)
      return next
    })
  }, [canEdit, nodes, scheduleSave])

  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    if ('preventDefault' in event) event.preventDefault()
    setPendingSourceId(null)
  }, [])

  // Highlight wires connected to the hovered node; dim the rest.
  // Highlighted wires keep the default wire color but at full theme contrast,
  // and animate as a dash pulse flowing source → target.
  const displayEdges = useMemo(() => {
    if (!hoveredNodeId) return edges
    return edges.map((e) =>
      e.source === hoveredNodeId || e.target === hoveredNodeId
        ? {
            ...e,
            animated: true,
            style: { ...EDGE_STYLE, stroke: 'hsl(var(--foreground))', strokeWidth: 2.5 },
            zIndex: 1000,
          }
        : { ...e, style: { ...EDGE_STYLE, opacity: 0.2 } },
    )
  }, [edges, hoveredNodeId])

  // ===== Empty states =====
  if (!dbPath) {
    return (
      <div className="space-y-4">
        <StageEmptyState stage="repos" />
        <p className="text-center text-sm text-muted-foreground">
          Configure the sikagit database path in{' '}
          <Link href="/settings?tab=integrations" className="underline">Settings → Integrations</Link>.
        </p>
      </div>
    )
  }

  if (!sikagitProjectId && !sikagitRepoId) {
    return (
      <div className="space-y-4">
        <StageEmptyState stage="repos" />
        <p className="text-center text-sm text-muted-foreground">
          Link a sikagit project — or a single repo — from the project Edit dialog.
        </p>
      </div>
    )
  }

  if (loadingRepos) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading repos…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-destructive">
        <AlertTriangle className="mb-2 h-6 w-6" />
        <p className="font-medium">Could not load sikagit repos</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (repos.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        This sikagit project has no repos.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-1 lg:min-h-0">
      {canEdit && pendingSourceId && (
        <div className="flex items-center rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            Pick a target repo to connect — Esc cancels
          </span>
        </div>
      )}
      <div className="rounded-lg border bg-background flex-1 min-h-[420px]">
        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={canEdit ? handleConnect : undefined}
          onNodeContextMenu={canEdit ? handleNodeContextMenu : undefined}
          onEdgeContextMenu={canEdit ? handleEdgeContextMenu : undefined}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          edgesFocusable={canEdit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls />
          <MiniMap pannable zoomable className="!bg-background" />
        </ReactFlow>
      </div>

      <Dialog open={!!expandedRepo} onOpenChange={(open) => { if (!open) { setExpandedRepo(null); setExpandedReadme(null) } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {expandedRepo?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={expandedRepo.avatar} alt={expandedRepo.name} className="h-5 w-5 rounded" />
              ) : (
                <GitBranch className="h-4 w-4" />
              )}
              {expandedRepo?.name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span className="truncate">{expandedRepo?.displayPath}</span>
              {expandedRepo?.hostPath && (
                <a
                  href={`file://${expandedRepo.hostPath}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> open path
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-2 flex-1 space-y-4">
            {/* AI summary */}
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                AI summary
              </div>
              <p className="mt-1.5 text-sm">
                {expandedRepo && summaryByRepo[expandedRepo.id]
                  ? summaryByRepo[expandedRepo.id]
                  : expandedRepo && readmeByRepo[expandedRepo.id] === null
                    ? <span className="italic text-muted-foreground">No README to summarize.</span>
                    : <span className="italic text-muted-foreground">Not generated yet.</span>}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={regenerating || expandedLoading || !expandedReadme}
                  onClick={async () => {
                    if (!expandedRepo || !expandedReadme) return
                    setRegenerating(true)
                    await generateSummary(expandedRepo, expandedReadme)
                    setRegenerating(false)
                  }}
                >
                  {regenerating
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />}
                  Regenerate summary
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={expandedLoading || !expandedReadme}
                onClick={() => setShowFullReadme((v) => !v)}
              >
                <FileText className="h-3 w-3" />
                {showFullReadme ? 'Hide full README' : 'Show full README'}
              </Button>
            </div>

            {/* Full README (on demand) */}
            {showFullReadme && (
              expandedLoading ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground p-4">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading README…
                </div>
              ) : expandedReadme ? (
                <div className="rounded-lg border p-3">
                  <MarkdownContent content={expandedReadme} />
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground p-4">No README found.</p>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ReposStage(props: Props) {
  return (
    <ReactFlowProvider>
      <ReposStageInner {...props} />
    </ReactFlowProvider>
  )
}
