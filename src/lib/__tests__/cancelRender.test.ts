import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cancelPatch, cancelRoute, mapAdgenCancel, mapAdgenCancelError } from '../cancelRender.ts'

// ── routing: what never reaches the service ─────────────────────────────────

test('a terminal job is settled without calling out', () => {
  for (const status of ['done', 'failed', 'cancelled']) {
    assert.equal(cancelRoute({ status, adgenJobId: 'adg-1' }), 'settled')
  }
})

test('a pre-migration job with no AdGen id takes the legacy path', () => {
  assert.equal(cancelRoute({ status: 'queued' }), 'legacy')
  assert.equal(cancelRoute({ status: 'rendering', adgenJobId: '' }), 'legacy')
  assert.equal(cancelRoute({ status: 'rendering', adgenJobId: 42 }), 'legacy')
})

test('a live job with an AdGen id goes to the service', () => {
  assert.equal(cancelRoute({ status: 'queued', adgenJobId: 'adg-1' }), 'adgen')
  assert.equal(cancelRoute({ status: 'rendering', adgenJobId: 'adg-1' }), 'adgen')
})

// ── mapping AdGen's dialect onto WorkHub's three frozen words ───────────────

test("AdGen's immediate kill maps to cancelled", () => {
  assert.equal(mapAdgenCancel({ status: 'cancelled' }), 'cancelled')
})

test("AdGen's 'cancelling' maps to requested, and so does anything unrecognised", () => {
  assert.equal(mapAdgenCancel({ status: 'cancelling' }), 'requested')
  // Unknown values must NOT read as a completed cancel: 'requested' keeps the
  // job under the cancelRequested rule instead of declaring an outcome we
  // never received.
  assert.equal(mapAdgenCancel({ status: 'weird' }), 'requested')
  assert.equal(mapAdgenCancel({}), 'requested')
})

test('409 and 404 are both settled; a real failure is not mapped at all', () => {
  assert.equal(mapAdgenCancelError(409), 'settled')
  assert.equal(mapAdgenCancelError(404), 'settled')
  // A 500 or a transport error must surface, never silently read as cancelled:
  // clearing the spinner while the render carries on would still bill the user.
  assert.equal(mapAdgenCancelError(500), null)
  assert.equal(mapAdgenCancelError(502), null)
  assert.equal(mapAdgenCancelError(401), null)
})

// ── the write each outcome implies ──────────────────────────────────────────

test('cancelled writes a full terminal patch', () => {
  const patch = cancelPatch('cancelled', 1_700_000_000_000)
  assert.deepEqual(patch, {
    status: 'cancelled',
    stage: 'cancelled',
    cancelRequested: true,
    finishedAt: 1_700_000_000_000,
  })
})

test('requested only flags the job — it must not fabricate a terminal status', () => {
  const patch = cancelPatch('requested', 1_700_000_000_000)
  // Check the terminal fields are absent BEFORE the deepEqual below: a strict
  // deepEqual narrows `patch` to exactly `{ cancelRequested: true }`, after
  // which these property reads would not type-check.
  assert.equal(patch!.status, undefined)
  assert.equal(patch!.finishedAt, undefined)
  assert.deepEqual(patch, { cancelRequested: true })
})

test('settled writes nothing, so a finished render is never relabelled', () => {
  // Flagging an already-done job would make the next mirror pass rewrite it as
  // 'cancelled' and hide a video the user actually got.
  assert.equal(cancelPatch('settled', Date.now()), null)
})

test("the patch keys stay inside the UI's frozen field set", () => {
  const allowed = new Set(['status', 'stage', 'cancelRequested', 'finishedAt'])
  for (const result of ['cancelled', 'requested'] as const) {
    for (const key of Object.keys(cancelPatch(result, 0)!)) {
      assert.ok(allowed.has(key), `${result} patch writes unexpected field ${key}`)
    }
  }
  // 'cancelled' is one of the eight stage strings CampaignTab hard-codes; a
  // novel string here would silently degrade the label to "Rendering…".
  assert.equal(cancelPatch('cancelled', 0)!.stage, 'cancelled')
})
