import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { cardPct } from '../server/vps/cardMetrics.ts'
import type { MetricPoint } from '../server/vps/types.ts'

const sample = (over: Partial<MetricPoint>): MetricPoint => ({
  ts: 1_000, serverId: 'primary', cpuPct: 0, memPct: 0, diskPct: 0, load1: 0, ...over,
})

describe('cardPct', () => {
  const live = { cpuPct: 71, memPct: 61, diskPct: 78 }

  // The whole point: a live 71% CPU (1s window, phase-locked to the sampler
  // burst) is replaced by the rolling 8% the detail view shows.
  test('prefers the rolling sample over the noisy live reading', () => {
    const out = cardPct(live, sample({ cpuPct: 8, memPct: 55, diskPct: 78 }))
    assert.deepEqual(out, { cpuPct: 8, memPct: 55, diskPct: 78 })
  })

  // A server's first minute, before any sample exists: the card must still show
  // something, so it falls back to the live reading rather than blanking.
  test('falls back to live when there is no sample yet', () => {
    assert.deepEqual(cardPct(live, null), live)
  })

  // A sample missing one field (or carrying a non-number) keeps the live value
  // for that field only, never emits NaN/undefined.
  test('per-field fallback when a sample field is absent or non-numeric', () => {
    const out = cardPct(live, sample({ cpuPct: 8, memPct: undefined as unknown as number, diskPct: NaN }))
    assert.deepEqual(out, { cpuPct: 8, memPct: 61, diskPct: 78 })
  })

  // Zero is a legitimate reading (idle box) and must NOT be treated as missing.
  test('keeps a genuine zero from the sample', () => {
    const out = cardPct(live, sample({ cpuPct: 0, memPct: 0, diskPct: 0 }))
    assert.deepEqual(out, { cpuPct: 0, memPct: 0, diskPct: 0 })
  })
})
