import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { pollDelayMs, MAX_POLL_ATTEMPTS } from '../renderPoll.ts'

// The browser's polling schedule. Its job is to look instant for a healthy
// render and to cost nothing for a job that is never going to finish.

describe('pollDelayMs', () => {
  test('starts fast enough that the bar looks live', () => {
    assert.equal(pollDelayMs(1), 4000)
    assert.equal(pollDelayMs(44), 4000)
  })

  test('decays instead of hammering', () => {
    assert.equal(pollDelayMs(45), 10_000)
    assert.equal(pollDelayMs(104), 10_000)
    assert.equal(pollDelayMs(105), 30_000)
    assert.equal(pollDelayMs(164), 30_000)
  })

  test('eventually stops', () => {
    assert.equal(pollDelayMs(MAX_POLL_ATTEMPTS), null)
    assert.equal(pollDelayMs(MAX_POLL_ATTEMPTS + 500), null)
  })

  test('never returns a delay below four seconds', () => {
    for (let i = 1; i <= MAX_POLL_ATTEMPTS; i++) {
      const d = pollDelayMs(i)
      assert.ok(d === null || d >= 4000, `attempt ${i} -> ${d}`)
    }
  })

  test('is monotonic — a poll never speeds back up', () => {
    let prev = 0
    for (let i = 1; i <= MAX_POLL_ATTEMPTS; i++) {
      const d = pollDelayMs(i)
      if (d === null) break
      assert.ok(d >= prev, `attempt ${i} sped up`)
      prev = d
    }
  })

  test('the whole schedule is bounded in both requests and wall time', () => {
    let total = 0
    let count = 0
    for (let i = 1; ; i++) {
      const d = pollDelayMs(i)
      if (d === null) break
      total += d
      count += 1
      assert.ok(i < 1000, 'schedule never terminates')
    }
    assert.ok(count <= 200, `${count} requests per viewer per render is too many`)
    // A flat 4s poll is ~21,600 requests/day; this must be nowhere near it.
    assert.ok(count < 500)
    // Long enough to cover any render that is actually going to finish.
    assert.ok(total > 30 * 60_000, 'gives up too early')
  })

  test('tolerates a nonsense attempt number', () => {
    assert.equal(pollDelayMs(0), 4000)
    assert.equal(pollDelayMs(-5), 4000)
    assert.equal(pollDelayMs(NaN), 4000)
  })
})
