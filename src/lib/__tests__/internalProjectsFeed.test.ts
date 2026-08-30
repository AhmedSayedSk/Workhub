import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseStatusFilter } from '../internalProjectsFeed.ts'

// Sibling systems pull this feed on a schedule; a typo in the filter must
// degrade to the safe default (active only), never to "everything".

describe('parseStatusFilter', () => {
  test('defaults to active when absent or blank', () => {
    assert.deepEqual(parseStatusFilter(null), ['active'])
    assert.deepEqual(parseStatusFilter(''), ['active'])
    assert.deepEqual(parseStatusFilter('  '), ['active'])
  })

  test('accepts a comma list of known statuses, trimmed and deduplicated', () => {
    assert.deepEqual(parseStatusFilter('active,completed'), ['active', 'completed'])
    assert.deepEqual(parseStatusFilter(' completed , active , completed '), ['completed', 'active'])
  })

  test('drops unknown statuses and falls back to active when nothing survives', () => {
    assert.deepEqual(parseStatusFilter('active,done'), ['active'])
    assert.deepEqual(parseStatusFilter('done'), ['active'])
  })

  test('"all" expands to every project status', () => {
    assert.deepEqual(parseStatusFilter('all'), ['active', 'paused', 'completed', 'cancelled'])
  })
})
