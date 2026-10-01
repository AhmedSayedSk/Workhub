import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { applyPools, poolMatcher } from '../server/vps/pools.ts'
import type { AppInfo, ContainerStat } from '../server/vps/types.ts'

const ctr = (name: string, over: Partial<ContainerStat> = {}): ContainerStat => ({
  id: name.slice(0, 12),
  name,
  image: 'app:latest',
  state: 'running',
  status: 'Up 1 day',
  cpuPct: 1,
  memUsedBytes: 100,
  memLimitBytes: 0,
  netRxBytes: 0,
  netTxBytes: 0,
  ...over,
})

const app = (id: string, services: ContainerStat[]): AppInfo => ({
  id,
  name: id,
  description: '',
  type: 'app',
  path: '',
  domains: [],
  services: services.map((s) => ({ name: s.name, state: s.state, status: s.status })),
  running: services.filter((s) => s.state === 'running').length,
  total: services.length,
})

const SANDBOX = { name: 'Sandboxes', app: 'runner', match: { name: '^sbx-', image: '^sandbox:' } }

describe('poolMatcher', () => {
  test('every given pattern must match', () => {
    const m = poolMatcher(SANDBOX)!
    assert.equal(m({ name: 'sbx-1', image: 'sandbox:stub' }), true)
    assert.equal(m({ name: 'sbx-1', image: 'redis:7' }), false)
    assert.equal(m({ name: 'web', image: 'sandbox:stub' }), false)
  })

  // A typo in the private registry must not sweep containers off the page.
  test('a rule with no patterns matches nothing', () => {
    assert.equal(poolMatcher({ name: 'Empty', match: {} }), null)
  })

  test('a rule whose regex does not compile matches nothing', () => {
    assert.equal(poolMatcher({ name: 'Broken', match: { name: '(' } }), null)
  })
})

describe('applyPools', () => {
  const sbxUp = ctr('sbx-a', { image: 'sandbox:stub', memUsedBytes: 300, cpuPct: 0.5 })
  const sbxDown = ctr('sbx-b', { image: 'sandbox:stub', state: 'exited', status: 'Exited (0)', memUsedBytes: 0, cpuPct: 0 })
  const web = ctr('web')
  const redis = ctr('cache', { image: 'redis:7' })

  test('moves matching containers out of the table into their pool', () => {
    const out = applyPools({ containers: [web, sbxUp, sbxDown], apps: null }, { sbx: SANDBOX })
    assert.deepEqual(out.containers.map((c) => c.name), ['web'])
    assert.equal(out.pools.length, 1)
    const [p] = out.pools
    assert.equal(p.id, 'sbx')
    assert.equal(p.app, 'runner')
    assert.deepEqual(p.containers.map((c) => c.name), ['sbx-a', 'sbx-b'])
    assert.equal(p.running, 1)
    assert.equal(p.total, 2)
    assert.equal(p.memUsedBytes, 300)
    assert.equal(p.cpuPct, 0.5)
  })

  test('drops a system left empty, trims a mixed one, keeps non-container ones', () => {
    const extra: AppInfo = { ...app('external', []), type: 'system' }
    const out = applyPools(
      {
        containers: [web, redis, sbxUp, sbxDown],
        apps: [app('(other)', [sbxUp, sbxDown]), app('mixed', [redis, sbxUp]), app('site', [web]), extra],
      },
      { sbx: SANDBOX }
    )
    assert.deepEqual(out.apps!.map((a) => a.id), ['mixed', 'site', 'external'])
    const mixed = out.apps!.find((a) => a.id === 'mixed')!
    assert.deepEqual(mixed.services.map((s) => s.name), ['cache'])
    assert.equal(mixed.total, 1)
    assert.equal(mixed.running, 1)
  })

  // The same registry is applied to every server; a server that does not run
  // the spawning system must not grow an empty card.
  test('a pool with no containers on this server is omitted', () => {
    const out = applyPools({ containers: [web], apps: null }, { sbx: SANDBOX })
    assert.deepEqual(out.pools, [])
    assert.deepEqual(out.containers, [web])
  })

  test('the first matching pool claims a container', () => {
    const out = applyPools(
      { containers: [sbxUp], apps: null },
      { first: { name: 'First', match: { name: '^sbx-' } }, second: { name: 'Second', match: { image: 'sandbox' } } }
    )
    assert.deepEqual(out.pools.map((p) => p.id), ['first'])
  })

  test('no containers section means nothing to pool', () => {
    const out = applyPools({ containers: null, apps: null }, { sbx: SANDBOX })
    assert.deepEqual(out.pools, [])
    assert.equal(out.containers, null)
  })
})
