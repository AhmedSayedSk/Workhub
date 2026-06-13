'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'
import type { SikagitProject, SikagitRepo } from '@/types'

interface Props {
  projectValue: string
  repoValue: string
  onChange: (link: { projectId: string; repoId: string }) => void
}

const NONE = '__none__'

type LinkMode = 'project' | 'repo'

export function SikagitProjectPicker({ projectValue, repoValue, onChange }: Props) {
  const { settings } = useSettings()
  const [mode, setMode] = useState<LinkMode>(repoValue && !projectValue ? 'repo' : 'project')
  const [projects, setProjects] = useState<SikagitProject[]>([])
  const [repos, setRepos] = useState<SikagitRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [repoOpen, setRepoOpen] = useState(false)

  useEffect(() => {
    const dbPath = settings?.sikagitDbPath
    if (!dbPath) return
    // Each mode's list is fetched once, on first use.
    if (mode === 'project' && projects.length > 0) return
    if (mode === 'repo' && repos.length > 0) return
    const pathPrefix = settings?.sikagitPathPrefix
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ dbPath })
    if (pathPrefix) params.set('pathPrefix', pathPrefix)
    const url = mode === 'project'
      ? `/api/sikagit/projects?${params.toString()}`
      : `/api/sikagit/repos?${params.toString()}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
        } else {
          setError(null)
          if (mode === 'project') setProjects(data.projects ?? [])
          else setRepos(data.repos ?? [])
        }
      })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, settings?.sikagitDbPath, settings?.sikagitPathPrefix])

  if (!settings?.sikagitDbPath) {
    return (
      <p className="text-xs text-muted-foreground">
        Set the sikagit database path in Settings → Integrations first.
      </p>
    )
  }

  const selectedRepo = repos.find((r) => r.id === repoValue)

  // Group repos by parent sikagit project; a repo in several projects appears
  // under each. Repos with no parent fall under "No project", listed last.
  const repoGroups: Array<{ name: string; repos: SikagitRepo[] }> = []
  {
    const byProject = new Map<string, SikagitRepo[]>()
    const orphans: SikagitRepo[] = []
    for (const r of repos) {
      const parents = r.projectNames ?? []
      if (parents.length === 0) { orphans.push(r); continue }
      for (const p of parents) {
        if (!byProject.has(p)) byProject.set(p, [])
        byProject.get(p)!.push(r)
      }
    }
    for (const name of [...byProject.keys()].sort((a, b) => a.localeCompare(b))) {
      repoGroups.push({ name, repos: byProject.get(name)! })
    }
    if (orphans.length > 0) repoGroups.push({ name: 'No project', repos: orphans })
  }

  return (
    <div className="space-y-2">
      <div className="flex w-fit items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
        {([
          { key: 'project', label: 'Full project' },
          { key: 'repo', label: 'Single repo' },
        ] as const).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              'rounded px-2.5 py-1 text-xs transition-colors',
              mode === m.key
                ? 'bg-background font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'project' ? (
        <Select
          value={projectValue || NONE}
          onValueChange={(v) => onChange({ projectId: v === NONE ? '' : v, repoId: '' })}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? 'Loading…' : 'Pick a sikagit project'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No link</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Popover open={repoOpen} onOpenChange={setRepoOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={repoOpen}
              disabled={loading}
              className="w-full justify-between font-normal"
            >
              {loading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : selectedRepo ? (
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate">{selectedRepo.name}</span>
                  {(selectedRepo.projectNames?.length ?? 0) > 0 && (
                    <span className="truncate text-xs text-muted-foreground">
                      {selectedRepo.projectNames!.join(', ')}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">Pick a single repo</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search repo, parent project, or path…" />
              <CommandList className="max-h-[260px]">
                <CommandEmpty>No repo found.</CommandEmpty>
                <CommandItem
                  value="__no_link__"
                  onSelect={() => { onChange({ projectId: '', repoId: '' }); setRepoOpen(false) }}
                >
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', repoValue ? 'opacity-0' : 'opacity-100')} />
                  <span className="text-muted-foreground">No link</span>
                </CommandItem>
                {repoGroups.map((g) => (
                  <CommandGroup key={g.name} heading={g.name}>
                    {g.repos.map((r) => (
                      <CommandItem
                        key={`${g.name}-${r.id}`}
                        value={`${g.name} ${r.name} ${r.displayPath}`}
                        onSelect={() => { onChange({ projectId: '', repoId: r.id }); setRepoOpen(false) }}
                      >
                        <Check className={cn('mr-2 h-4 w-4 shrink-0', repoValue === r.id ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">{r.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{r.displayPath}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
