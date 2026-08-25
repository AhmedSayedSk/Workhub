import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

// The vps-agent image copies an EXPLICIT list of collector files (it cannot
// copy the whole directory — owner.ts imports next/server and metrics.ts
// imports firebase-admin, neither of which resolves outside Next.js).
//
// That explicit list rots silently. When collect.ts gained `import { ... }
// from './ips'`, nothing here failed — the break surfaced only as a TS2307
// during `docker compose build` ON THE SERVER, mid-deploy.
//
// So: walk what the agent actually imports, transitively, and assert the
// Dockerfile copies every file reached.

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
const VPS_DIR = path.join(ROOT, 'src', 'lib', 'server', 'vps')
const DOCKERFILE = path.join(ROOT, 'vps-agent', 'Dockerfile')
const AGENT = path.join(ROOT, 'vps-agent', 'agent.mjs')

/** Relative specifiers imported by a source file, extension stripped. */
function relativeImports(source: string): string[] {
  const out: string[] = []
  const re = /(?:import|export)[\s\S]*?from\s+['"](\.\/[^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) out.push(m[1].replace(/^\.\//, '').replace(/\.(ts|js)$/, ''))
  return out
}

/** Every collector module the agent pulls in, walked transitively. */
function reachableModules(): Set<string> {
  const agent = readFileSync(AGENT, 'utf8')
  // agent.mjs imports the COMPILED output: './lib/collect.js' -> collect
  const entries = [...agent.matchAll(/from\s+['"]\.\/lib\/([^'"]+)['"]/g)].map((m) =>
    m[1].replace(/\.js$/, '')
  )
  assert.ok(entries.length > 0, 'found no ./lib/* imports in agent.mjs — update this test')

  const seen = new Set<string>()
  const queue = [...entries]
  while (queue.length) {
    const name = queue.shift() as string
    if (seen.has(name)) continue
    const file = path.join(VPS_DIR, `${name}.ts`)
    if (!existsSync(file)) continue
    seen.add(name)
    for (const dep of relativeImports(readFileSync(file, 'utf8'))) {
      if (!seen.has(dep)) queue.push(dep)
    }
  }
  return seen
}

/** Files named on the Dockerfile's COPY line. */
function copiedModules(): Set<string> {
  const df = readFileSync(DOCKERFILE, 'utf8')
  const names = [...df.matchAll(/src\/lib\/server\/vps\/([A-Za-z0-9_]+)\.ts/g)].map((m) => m[1])
  return new Set(names)
}

describe('vps-agent Dockerfile', () => {
  test('copies every collector the agent transitively imports', () => {
    const needed = reachableModules()
    const copied = copiedModules()
    const missing = [...needed].filter((n) => !copied.has(n)).sort()
    assert.deepEqual(
      missing,
      [],
      `vps-agent/Dockerfile does not COPY: ${missing.join(', ')} — the image will fail to ` +
        `compile with TS2307 during deploy. Add them to the COPY line.`
    )
  })

  test('does not copy the modules that cannot build outside Next.js', () => {
    const copied = copiedModules()
    // owner.ts imports next/server; metrics.ts imports firebase-admin.
    for (const forbidden of ['owner', 'metrics']) {
      assert.ok(
        !copied.has(forbidden),
        `${forbidden}.ts must not be copied into the agent image — it cannot compile there`
      )
    }
  })

  test('every copied file actually exists', () => {
    for (const name of copiedModules()) {
      assert.ok(
        existsSync(path.join(VPS_DIR, `${name}.ts`)),
        `Dockerfile copies ${name}.ts, which no longer exists — the build will fail`
      )
    }
  })
})
