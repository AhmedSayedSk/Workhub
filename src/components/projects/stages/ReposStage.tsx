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
import { Maximize2, Loader2, AlertTriangle, GitBranch, FileText, Sparkles, FolderSync } from 'lucide-react'
import type { Project, RepoSnapshot, RepoGraphNode, RepoGraphEdge } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { projectRepoGraph, repoSummaries, projectRepos } from '@/lib/firestore'
import { authFetch } from '@/lib/api-client'
import { SIKAGIT_ENABLED } from '@/lib/sikagit-flag'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { MarkdownContent } from '@/components/ui/markdown-content'
import { StageEmptyState } from './StageEmptyState'
import { FloatingEdge } from './FloatingEdge'
import Link from 'next/link'

interface Props { project: Project; canEdit: boolean }

interface RepoNodeData extends Record<string, unknown> {
  repo: RepoSnapshot
  preview: string
  onExpand: (repo: RepoSnapshot) => void
  isPendingSource?: boolean
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 140
const SAVE_DEBOUNCE_MS = 700

function dagreLayout(repos: RepoSnapshot[]): Record<string, { x: number; y: number }> {
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
  const { repo, preview, onExpand, isPendingSource } = data
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
        {preview ? (
          <p className="text-xs text-muted-foreground">{preview}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">No summary</p>
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

interface SyncProgress {
  done: number
  total: number
  label: string
}

function ReposStageInner({ project, canEdit }: Props) {
  const { settings } = useSettings()
  const { user } = useAuth()

  const dbPath = settings?.sikagitDbPath ?? ''
  const pathPrefix = settings?.sikagitPathPrefix ?? ''
  const sikagitProjectId = project.sikagitProjectId ?? ''
  const sikagitRepoId = project.sikagitRepoId ?? ''

  const [repos, setRepos] = useState<RepoSnapshot[]>([])
  const [readmeByRepo, setReadmeByRepo] = useState<Record<string, string | null>>({})
  const [summaryByRepo, setSummaryByRepo] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const [nodes, setNodes] = useState<Node<RepoNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [expandedRepo, setExpandedRepo] = useState<RepoSnapshot | null>(null)
  const [showFullReadme, setShowFullReadme] = useState(false)
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Sync state (local-only).
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncWhisper, setSyncWhisper] = useState<string | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canSync = SIKAGIT_ENABLED && canEdit

  /** Load the persisted snapshot + summaries + graph from Firestore. No filesystem access. */
  const loadFromFirestore = useCallback(async () => {
    setLoading(true)
    const [snapshot, summaryList, graph] = await Promise.all([
      projectRepos.get(project.id).catch(() => null),
      repoSummaries.listByProject(project.id).catch(() => []),
      projectRepoGraph.get(project.id).catch(() => null),
    ])

    const repoList = snapshot?.repos ?? []
    const summaryMap: Record<string, string | null> = {}
    const readmeMap: Record<string, string | null> = {}
    for (const s of summaryList) {
      summaryMap[s.repoId] = s.summary ?? null
      readmeMap[s.repoId] = s.readme ?? null
    }

    // Positions/edges from the saved graph; auto-layout repos missing a position.
    const savedPositions: Record<string, { x: number; y: number }> = {}
    for (const n of graph?.nodes ?? []) savedPositions[n.repoId] = { x: n.x, y: n.y }
    const missing = repoList.filter((r) => !(r.id in savedPositions))
    const autoPositions = missing.length > 0 ? dagreLayout(missing) : {}

    const nextNodes: Node<RepoNodeData>[] = repoList.map((repo) => ({
      id: repo.id,
      type: 'repoNode',
      position: savedPositions[repo.id] ?? autoPositions[repo.id] ?? { x: 0, y: 0 },
      data: { repo, preview: summaryMap[repo.id] ?? '', onExpand },
    }))
    const nextEdges: Edge[] = (graph?.edges ?? []).map((e) => ({
      id: e.id,
      source: e.sourceRepoId,
      target: e.targetRepoId,
      label: e.label ?? undefined,
      type: 'floating',
      animated: false,
      markerEnd: EDGE_MARKER,
      style: EDGE_STYLE,
    }))

    setRepos(repoList)
    setSummaryByRepo(summaryMap)
    setReadmeByRepo(readmeMap)
    setSyncedAt(snapshot?.syncedAt ? snapshot.syncedAt.toDate() : null)
    setNodes(nextNodes)
    setEdges(nextEdges)
    setLoaded(true)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await loadFromFirestore()
    })()
    return () => { cancelled = true }
  }, [loadFromFirestore])

  // Stable callback for the node's "expand" button — reads stored README, no live fetch.
  const onExpand = useCallback((repo: RepoSnapshot) => {
    setExpandedRepo(repo)
    setShowFullReadme(false)
  }, [])

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

  // Keep node previews in sync when summaries change (e.g. after a sync).
  useEffect(() => {
    setNodes((curr) => {
      let changed = false
      const next = curr.map((n) => {
        const r = (n.data as RepoNodeData).repo
        const preview = summaryByRepo[r.id] ?? ''
        if ((n.data as RepoNodeData).preview === preview) return n
        changed = true
        return { ...n, data: { ...(n.data as RepoNodeData), preview } }
      })
      return changed ? next : curr
    })
  }, [summaryByRepo])

  // ===== Sync from sikagit (LOCAL ONLY) =====
  const handleSync = useCallback(async () => {
    if (!user || syncing) return
    if (!dbPath || (!sikagitProjectId && !sikagitRepoId)) return
    setSyncing(true)
    setSyncError(null)
    setSyncWhisper(null)
    setSyncProgress({ done: 0, total: 0, label: 'Reading repos…' })
    const startedAt = Date.now()
    try {
      // 1) Live repo list from sikagit.
      const params = new URLSearchParams({ dbPath })
      if (pathPrefix) params.set('pathPrefix', pathPrefix)
      const listUrl = sikagitProjectId
        ? `/api/sikagit/projects/${encodeURIComponent(sikagitProjectId)}/repos?${params.toString()}`
        : `/api/sikagit/repos/${encodeURIComponent(sikagitRepoId)}?${params.toString()}`
      const listRes = await fetch(listUrl).then((r) => r.json())
      if (listRes.error) throw new Error(listRes.error)
      const liveRepos: RepoSnapshot[] = (
        listRes.repos ?? (listRes.repo ? [listRes.repo] : [])
      ).map((r: { id: string; name: string; displayPath: string; group?: string | null; avatar?: string | null; lastOpened?: string | null }) => ({
        id: r.id,
        name: r.name,
        displayPath: r.displayPath,
        group: r.group ?? null,
        avatar: r.avatar ?? null,
        lastOpened: r.lastOpened ?? null,
      }))

      setSyncProgress({ done: 0, total: liveRepos.length, label: 'Syncing repos…' })

      // 2) + 3) For each repo: fetch README, generate a summary. Errors per-repo don't abort.
      let done = 0
      for (const repo of liveRepos) {
        try {
          const readmeRes = await fetch(
            `/api/sikagit/repos/${encodeURIComponent(repo.id)}/readme?${params.toString()}`,
          ).then((r) => r.json())
          const readme: string | null = readmeRes?.readme?.content ?? null

          let summary: string | null = null
          if (readme) {
            try {
              const aiRes = await authFetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'summarize_repo', data: { repoName: repo.name, readme } }),
              })
              const aiJson = await aiRes.json()
              if (aiJson.success && aiJson.data?.summary) summary = aiJson.data.summary
            } catch {
              // summary stays null on AI failure
            }
          }

          // 4) Persist README + summary for this repo.
          await repoSummaries.saveData(project.id, repo.id, { summary, readme }, user.uid).catch(() => {})
        } catch {
          // README fetch failed — skip this repo's content, keep going.
        }
        done += 1
        setSyncProgress({ done, total: liveRepos.length, label: 'Syncing repos…' })
      }

      // 4) Persist the repo snapshot itself.
      await projectRepos.save(project.id, liveRepos, user.uid)

      // 5) Reload from Firestore + whisper.
      await loadFromFirestore()
      const secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      setSyncWhisper(`Synced ✓ (${liveRepos.length} repo${liveRepos.length === 1 ? '' : 's'}, ${secs}s)`)
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }, [user, syncing, dbPath, pathPrefix, sikagitProjectId, sikagitRepoId, project.id, loadFromFirestore])

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

  const expandedReadme = expandedRepo ? readmeByRepo[expandedRepo.id] ?? null : null
  const expandedSummary = expandedRepo ? summaryByRepo[expandedRepo.id] ?? null : null

  // Reusable sync button + progress/whisper line (local only).
  const syncBar = canSync && (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        disabled={syncing || !dbPath || (!sikagitProjectId && !sikagitRepoId)}
        onClick={handleSync}
      >
        {syncing
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <FolderSync className="h-3 w-3" />}
        Sync from sikagit
      </Button>
      {syncProgress && (
        <span className="text-muted-foreground">
          {syncProgress.label}
          {syncProgress.total > 0 ? ` ${syncProgress.done}/${syncProgress.total}` : ''}
        </span>
      )}
      {syncWhisper && !syncing && (
        <span className="text-green-700 dark:text-green-400">{syncWhisper}</span>
      )}
      {syncError && !syncing && (
        <span className="text-destructive">Sync failed: {syncError}</span>
      )}
      {syncedAt && !syncProgress && !syncWhisper && !syncError && (
        <span className="text-muted-foreground">Last synced {syncedAt.toLocaleString()}</span>
      )}
    </div>
  )

  // ===== Loading =====
  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading repos…
      </div>
    )
  }

  // ===== Empty states =====
  if (repos.length === 0) {
    if (canSync) {
      // Local: prompt to sync (with dbPath / link guidance).
      return (
        <div className="space-y-4">
          <StageEmptyState stage="repos" />
          <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            {!dbPath ? (
              <p>
                Configure the sikagit database path in{' '}
                <Link href="/settings?tab=integrations" className="underline">Settings → Integrations</Link>{' '}
                to sync.
              </p>
            ) : !sikagitProjectId && !sikagitRepoId ? (
              <p>Link a sikagit project — or a single repo — from the project Edit dialog, then sync.</p>
            ) : (
              <p>No repo data has been synced yet — click “Sync from sikagit” to pull the latest snapshot.</p>
            )}
            {syncBar}
          </div>
        </div>
      )
    }
    // Prod (or non-editor): read-only, never synced.
    return (
      <div className="space-y-4">
        <StageEmptyState stage="repos" />
        <p className="text-center text-sm text-muted-foreground">
          No repo data has been synced yet — run a sync from a local environment.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-1 lg:min-h-0">
      {(syncBar || (canEdit && pendingSourceId)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {syncBar}
          {canEdit && pendingSourceId && (
            <div className="flex items-center rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-400">
                <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                Pick a target repo to connect — Esc cancels
              </span>
            </div>
          )}
        </div>
      )}
      {syncError && !syncBar && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> Sync failed: {syncError}
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

      <Dialog open={!!expandedRepo} onOpenChange={(open) => { if (!open) { setExpandedRepo(null) } }}>
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
                {expandedSummary
                  ? expandedSummary
                  : expandedReadme === null
                    ? <span className="italic text-muted-foreground">No README to summarize.</span>
                    : <span className="italic text-muted-foreground">Not generated yet.</span>}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={!expandedReadme}
                onClick={() => setShowFullReadme((v) => !v)}
              >
                <FileText className="h-3 w-3" />
                {showFullReadme ? 'Hide full README' : 'Show full README'}
              </Button>
            </div>

            {/* Full README (on demand) */}
            {showFullReadme && (
              expandedReadme ? (
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
