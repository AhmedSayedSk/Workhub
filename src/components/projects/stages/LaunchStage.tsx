'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import type {
  Project, LaunchStatus,
  LaunchChecklistItem, LaunchChecklistStatus,
  MonitoringLink,
  PostLaunchIssue, PostLaunchIssueSeverity, PostLaunchIssueStatus,
} from '@/types'
import { projectLaunch, launchChecklist, monitoringLinks, postLaunchIssues } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusPill } from './StatusPill'

interface Props { project: Project; canEdit: boolean }

const SEV_TONE: Record<PostLaunchIssueSeverity, 'neutral' | 'info' | 'warn' | 'danger'> = {
  low: 'neutral', medium: 'info', high: 'warn', critical: 'danger',
}

function toDateInput(ts?: Timestamp | null): string {
  if (!ts) return ''
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function LaunchStage({ project, canEdit }: Props) {
  const { user } = useAuth()
  const [status, setStatus] = useState<LaunchStatus>('planned')
  const [releaseDate, setReleaseDate] = useState<string>('')
  const [checklist, setChecklist] = useState<LaunchChecklistItem[]>([])
  const [links, setLinks] = useState<MonitoringLink[]>([])
  const [issues, setIssues] = useState<PostLaunchIssue[]>([])
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newIssueTitle, setNewIssueTitle] = useState('')
  const [newIssueSev, setNewIssueSev] = useState<PostLaunchIssueSeverity>('medium')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const l = await projectLaunch.get(project.id)
      if (cancelled) return
      setStatus(l?.status ?? 'planned')
      setReleaseDate(toDateInput(l?.releaseDate ?? null))
      setChecklist(await launchChecklist.listByProject(project.id))
      setLinks(await monitoringLinks.listByProject(project.id))
      setIssues(await postLaunchIssues.listByProject(project.id))
    })()
    return () => { cancelled = true }
  }, [project.id])

  const handleSaveLaunch = async () => {
    if (!user) return
    const ts = releaseDate ? Timestamp.fromDate(new Date(releaseDate)) : null
    await projectLaunch.save(project.id, { status, releaseDate: ts }, user.uid)
  }

  const handleAddItem = async () => {
    if (!user || !newItemTitle.trim()) return
    await launchChecklist.add({ projectId: project.id, title: newItemTitle.trim(), status: 'not_started' }, user.uid)
    setNewItemTitle('')
    setChecklist(await launchChecklist.listByProject(project.id))
  }

  const handleItemStatus = async (id: string, s: LaunchChecklistStatus) => {
    if (!user) return
    await launchChecklist.setStatus(id, project.id, s, user.uid)
    setChecklist(await launchChecklist.listByProject(project.id))
  }

  const handleDeleteItem = async (id: string) => {
    if (!user) return
    await launchChecklist.remove(id, project.id, user.uid)
    setChecklist(await launchChecklist.listByProject(project.id))
  }

  const handleAddLink = async () => {
    if (!user || !newLinkLabel.trim() || !newLinkUrl.trim()) return
    await monitoringLinks.add({ projectId: project.id, label: newLinkLabel.trim(), url: newLinkUrl.trim() }, user.uid)
    setNewLinkLabel(''); setNewLinkUrl('')
    setLinks(await monitoringLinks.listByProject(project.id))
  }

  const handleDeleteLink = async (id: string) => {
    if (!user) return
    await monitoringLinks.remove(id, project.id, user.uid)
    setLinks(await monitoringLinks.listByProject(project.id))
  }

  const handleAddIssue = async () => {
    if (!user || !newIssueTitle.trim()) return
    await postLaunchIssues.add({
      projectId: project.id,
      title: newIssueTitle.trim(),
      severity: newIssueSev,
      status: 'open',
    }, user.uid)
    setNewIssueTitle('')
    setIssues(await postLaunchIssues.listByProject(project.id))
  }

  const handleIssueStatus = async (id: string, s: PostLaunchIssueStatus) => {
    if (!user) return
    await postLaunchIssues.setStatus(id, project.id, s, user.uid)
    setIssues(await postLaunchIssues.listByProject(project.id))
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium">Release date</label>
            <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} disabled={!canEdit} className="mt-1 w-44" />
          </div>
          <div>
            <label className="text-xs font-medium">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as LaunchStatus)} disabled={!canEdit}>
              <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_review">In review</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canEdit && <Button onClick={handleSaveLaunch}>Save</Button>}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Launch checklist</h3>
        {canEdit && (
          <div className="mt-3 flex gap-2">
            <Input placeholder="New checklist item" value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} className="flex-1" />
            <Button onClick={handleAddItem} disabled={!newItemTitle.trim()}><Plus className="mr-1 h-4 w-4" /> Add</Button>
          </div>
        )}
        <div className="mt-3 divide-y">
          {checklist.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sm">{it.title}</span>
              {canEdit ? (
                <Select value={it.status} onValueChange={(v) => handleItemStatus(it.id, v as LaunchChecklistStatus)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">not started</SelectItem>
                    <SelectItem value="in_progress">in progress</SelectItem>
                    <SelectItem value="done">done</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="text-xs">{it.status}</span>}
              {canEdit && <button onClick={() => handleDeleteItem(it.id)} className="text-muted-foreground hover:text-foreground"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
          {checklist.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No checklist items.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Monitoring links</h3>
        {canEdit && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Input placeholder="Label" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} className="flex-1 min-w-[140px]" />
            <Input placeholder="URL" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className="flex-1 min-w-[200px]" />
            <Button onClick={handleAddLink} disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}><Plus className="mr-1 h-4 w-4" /> Add link</Button>
          </div>
        )}
        <div className="mt-3 divide-y">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-3 py-2">
              <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 text-sm text-blue-700 hover:underline">{l.label}</a>
              {canEdit && <button onClick={() => handleDeleteLink(l.id)} className="text-muted-foreground hover:text-foreground"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
          {links.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No monitoring links.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Post-launch issues</h3>
        {canEdit && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Input placeholder="Issue title" value={newIssueTitle} onChange={(e) => setNewIssueTitle(e.target.value)} className="flex-1 min-w-[200px]" />
            <Select value={newIssueSev} onValueChange={(v) => setNewIssueSev(v as PostLaunchIssueSeverity)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">low</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="high">high</SelectItem>
                <SelectItem value="critical">critical</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddIssue} disabled={!newIssueTitle.trim()}><Plus className="mr-1 h-4 w-4" /> Report</Button>
          </div>
        )}
        <div className="mt-3 divide-y">
          {issues.map((iss) => (
            <div key={iss.id} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sm">{iss.title}</span>
              <StatusPill label={iss.severity} tone={SEV_TONE[iss.severity]} />
              {canEdit ? (
                <Select value={iss.status} onValueChange={(v) => handleIssueStatus(iss.id, v as PostLaunchIssueStatus)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">open</SelectItem>
                    <SelectItem value="in_progress">in progress</SelectItem>
                    <SelectItem value="resolved">resolved</SelectItem>
                  </SelectContent>
                </Select>
              ) : <span className="text-xs">{iss.status}</span>}
            </div>
          ))}
          {issues.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No issues reported.</p>}
        </div>
      </Card>
    </div>
  )
}
