import 'server-only'
import path from 'node:path'
import fs from 'node:fs/promises'
import Database from 'better-sqlite3'
import type { SikagitProject, SikagitRepo } from '@/types'

interface DbConfig {
  dbPath: string
  pathPrefix?: string | null
}

function openDb(cfg: DbConfig): Database.Database {
  if (!cfg.dbPath) {
    throw new Error('Sikagit DB path is not configured. Set it in WorkHub settings.')
  }
  return new Database(cfg.dbPath, { readonly: true, fileMustExist: true })
}

/**
 * Strip the configured `/host`-style prefix from a sikagit path to get the
 * real on-host path. Sikagit runs in Docker and records repo paths as seen
 * from inside its container (e.g. `/host/home/...`); WorkHub mounts the same
 * host directories at their real locations, so removing the prefix is enough.
 */
export function toHostPath(rawPath: string, prefix?: string | null): string {
  const p = (prefix ?? '/host').replace(/\/$/, '')
  if (p && rawPath.startsWith(p + '/')) {
    return rawPath.slice(p.length)
  }
  if (p && rawPath === p) {
    return '/'
  }
  return rawPath
}

export function listProjects(cfg: DbConfig): SikagitProject[] {
  const db = openDb(cfg)
  try {
    const projectRows = db.prepare(`
      SELECT id, name, avatar, created_at AS createdAt, position
      FROM projects
      ORDER BY position ASC, created_at ASC
    `).all() as Array<{ id: string; name: string; avatar: string | null; createdAt: string; position: number }>

    const repoLinkStmt = db.prepare(`
      SELECT repo_id AS repoId
      FROM project_repos
      WHERE project_id = ?
      ORDER BY position ASC
    `)

    return projectRows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      position: row.position,
      createdAt: row.createdAt,
      repoIds: (repoLinkStmt.all(row.id) as Array<{ repoId: string }>).map((r) => r.repoId),
    }))
  } finally {
    db.close()
  }
}

export function listReposForProject(cfg: DbConfig, projectId: string): SikagitRepo[] {
  const db = openDb(cfg)
  try {
    const rows = db.prepare(`
      SELECT r.id, r.name, r.path, r.display_path AS displayPath,
             r."group" AS "group", r.avatar, r.last_opened AS lastOpened, pr.position
      FROM repos r
      INNER JOIN project_repos pr ON pr.repo_id = r.id
      WHERE pr.project_id = ?
      ORDER BY pr.position ASC
    `).all(projectId) as Array<{
      id: string
      name: string
      path: string
      displayPath: string
      group: string | null
      avatar: string | null
      lastOpened: string | null
      position: number
    }>

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      displayPath: r.displayPath,
      hostPath: toHostPath(r.path, cfg.pathPrefix),
      group: r.group,
      avatar: r.avatar,
      lastOpened: r.lastOpened,
    }))
  } finally {
    db.close()
  }
}

/** List every repo in the sikagit database (for linking a single repo to a project). */
export function listAllRepos(cfg: DbConfig): SikagitRepo[] {
  const db = openDb(cfg)
  try {
    const rows = db.prepare(`
      SELECT r.id, r.name, r.path, r.display_path AS displayPath,
             r."group" AS "group", r.avatar, r.last_opened AS lastOpened,
             GROUP_CONCAT(p.name, '||') AS projectNames
      FROM repos r
      LEFT JOIN project_repos pr ON pr.repo_id = r.id
      LEFT JOIN projects p ON p.id = pr.project_id
      GROUP BY r.id
      ORDER BY r.name COLLATE NOCASE ASC
    `).all() as Array<{
      id: string
      name: string
      path: string
      displayPath: string
      group: string | null
      avatar: string | null
      lastOpened: string | null
      projectNames: string | null
    }>

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      displayPath: r.displayPath,
      hostPath: toHostPath(r.path, cfg.pathPrefix),
      group: r.group,
      avatar: r.avatar,
      lastOpened: r.lastOpened,
      projectNames: r.projectNames ? r.projectNames.split('||') : [],
    }))
  } finally {
    db.close()
  }
}

/** Fetch a single repo (by sikagit id) for README reading. */
export function getRepoById(cfg: DbConfig, repoId: string): SikagitRepo | null {
  const db = openDb(cfg)
  try {
    const row = db.prepare(`
      SELECT id, name, path, display_path AS displayPath,
             "group" AS "group", avatar, last_opened AS lastOpened
      FROM repos WHERE id = ?
    `).get(repoId) as
      | { id: string; name: string; path: string; displayPath: string; group: string | null; avatar: string | null; lastOpened: string | null }
      | undefined
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      displayPath: row.displayPath,
      hostPath: toHostPath(row.path, cfg.pathPrefix),
      group: row.group,
      avatar: row.avatar,
      lastOpened: row.lastOpened,
    }
  } finally {
    db.close()
  }
}

/** Read the README of a repo. Tries common filenames, returns null if none found. */
export async function readReadme(hostPath: string): Promise<{ filename: string; content: string } | null> {
  const candidates = ['README.md', 'README.MD', 'Readme.md', 'readme.md', 'README.markdown', 'README.rst', 'README.txt', 'README']
  for (const name of candidates) {
    const full = path.join(hostPath, name)
    try {
      const stat = await fs.stat(full)
      if (!stat.isFile()) continue
      const content = await fs.readFile(full, 'utf8')
      return { filename: name, content }
    } catch {
      // not found, try next
    }
  }
  return null
}
