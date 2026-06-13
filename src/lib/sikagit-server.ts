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
 * real on-host path. When running on Windows, also translate WSL-style
 * mount paths (`/mnt/d/...`) to native Windows paths (`D:\\...`) so
 * `fs.readFile` can resolve them.
 */
export function toHostPath(rawPath: string, prefix?: string | null): string {
  const p = (prefix ?? '/host').replace(/\/$/, '')
  let stripped = rawPath
  if (p && rawPath.startsWith(p + '/')) {
    stripped = rawPath.slice(p.length)
  } else if (p && rawPath === p) {
    stripped = '/'
  }

  if (process.platform === 'win32') {
    // /mnt/<letter>/rest  →  <LETTER>:\rest
    const mnt = stripped.match(/^\/mnt\/([a-zA-Z])(\/.*)?$/)
    if (mnt) {
      const drive = mnt[1].toUpperCase()
      const rest = (mnt[2] ?? '').replace(/\//g, '\\')
      return `${drive}:${rest}`
    }
    // /home/<user>/...  →  \\wsl$\Ubuntu\home\<user>\...  (best-effort default)
    if (stripped.startsWith('/home/')) {
      return `\\\\wsl$\\Ubuntu${stripped.replace(/\//g, '\\')}`
    }
  }
  return stripped
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
      SELECT r.id, r.name, r.path, r.display_path AS displayPath, r.is_wsl AS isWSL,
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
      isWSL: number
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
      isWSL: !!r.isWSL,
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
      SELECT r.id, r.name, r.path, r.display_path AS displayPath, r.is_wsl AS isWSL,
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
      isWSL: number
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
      isWSL: !!r.isWSL,
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
      SELECT id, name, path, display_path AS displayPath, is_wsl AS isWSL,
             "group" AS "group", avatar, last_opened AS lastOpened
      FROM repos WHERE id = ?
    `).get(repoId) as
      | { id: string; name: string; path: string; displayPath: string; isWSL: number; group: string | null; avatar: string | null; lastOpened: string | null }
      | undefined
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      displayPath: row.displayPath,
      hostPath: toHostPath(row.path, cfg.pathPrefix),
      isWSL: !!row.isWSL,
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
