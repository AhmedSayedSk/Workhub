import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  refundedTotal,
  netPaid,
  isFullyRefunded,
  remainingRefundable,
  expectedPaidFromMilestones,
  type RefundLike,
  type MilestoneLike,
} from '../paymentTotals.ts'

const ms = (over: Partial<MilestoneLike> = {}): MilestoneLike => ({
  id: 'm1', amount: 5000, status: 'paid', ...over,
})
const rf = (over: Partial<RefundLike> = {}): RefundLike => ({
  milestoneId: 'm1', amount: 1000, ...over,
})

describe('refundedTotal', () => {
  test('sums only the refunds belonging to the milestone', () => {
    const refunds = [rf({ amount: 1000 }), rf({ amount: 500 }), rf({ milestoneId: 'other', amount: 9999 })]
    assert.equal(refundedTotal('m1', refunds), 1500)
  })

  test('is zero when the milestone has no refunds', () => {
    assert.equal(refundedTotal('m1', [rf({ milestoneId: 'other' })]), 0)
  })
})

describe('netPaid', () => {
  // The headline behaviour: a refund reduces what the project counts as paid.
  test('a refund reduces net paid by its amount', () => {
    assert.equal(netPaid(ms({ amount: 5000 }), [rf({ amount: 1500 })]), 3500)
  })

  test('several partial refunds subtract cumulatively', () => {
    assert.equal(netPaid(ms({ amount: 5000 }), [rf({ amount: 1500 }), rf({ amount: 500 })]), 3000)
  })

  // An unpaid milestone has received nothing, so it contributes nothing —
  // regardless of any stray refund rows pointing at it.
  test('an unpaid milestone contributes nothing', () => {
    assert.equal(netPaid(ms({ status: 'pending' }), []), 0)
    assert.equal(netPaid(ms({ status: 'completed' }), []), 0)
  })

  test('never goes negative even if refunds somehow exceed the amount', () => {
    assert.equal(netPaid(ms({ amount: 1000 }), [rf({ amount: 4000 })]), 0)
  })
})

describe('isFullyRefunded', () => {
  test('true once refunds reach the milestone amount', () => {
    assert.equal(isFullyRefunded(ms({ amount: 5000 }), [rf({ amount: 5000 })]), true)
  })

  test('false while any part is still kept', () => {
    assert.equal(isFullyRefunded(ms({ amount: 5000 }), [rf({ amount: 4999 })]), false)
  })

  // A zero-amount milestone must not read as "fully refunded" — nothing was
  // ever paid, so the badge would be a lie.
  test('false for a zero-amount milestone with no refunds', () => {
    assert.equal(isFullyRefunded(ms({ amount: 0 }), []), false)
  })
})

describe('remainingRefundable', () => {
  // This is the invariant the create/edit dialogs enforce.
  test('is the amount minus what has already been refunded', () => {
    assert.equal(remainingRefundable(ms({ amount: 5000 }), [rf({ amount: 1500 })]), 3500)
  })

  test('is zero once fully refunded, never negative', () => {
    assert.equal(remainingRefundable(ms({ amount: 5000 }), [rf({ amount: 5000 })]), 0)
    assert.equal(remainingRefundable(ms({ amount: 5000 }), [rf({ amount: 6000 })]), 0)
  })

  // Editing an existing refund must not count that refund against itself,
  // otherwise raising 1000 -> 1200 looks like it would breach the cap.
  // Excluding r1 leaves only r2's 500 counted, so 5000 - 500 is refundable.
  test('excludes the refund being edited', () => {
    const refunds = [rf({ id: 'r1', amount: 1000 }), rf({ id: 'r2', amount: 500 })]
    assert.equal(remainingRefundable(ms({ amount: 5000 }), refunds, 'r1'), 4500)
    // and without the exclusion both count, so only 3500 is left
    assert.equal(remainingRefundable(ms({ amount: 5000 }), refunds), 3500)
  })

  test('an unpaid milestone has nothing to refund', () => {
    assert.equal(remainingRefundable(ms({ status: 'pending' }), []), 0)
  })
})

describe('expectedPaidFromMilestones', () => {
  test('sums paid milestones and subtracts their refunds', () => {
    const milestones = [
      ms({ id: 'a', amount: 5000, status: 'paid' }),
      ms({ id: 'b', amount: 3000, status: 'paid' }),
      ms({ id: 'c', amount: 2000, status: 'pending' }),
    ]
    const refunds = [rf({ milestoneId: 'a', amount: 1500 })]
    assert.equal(expectedPaidFromMilestones(milestones, refunds), 6500)
  })

  test('is zero when nothing is paid', () => {
    assert.equal(expectedPaidFromMilestones([ms({ status: 'pending' })], []), 0)
  })

  // The repair case: this is what the Recalculate action writes back when a
  // hand-maintained paidAmount has drifted from the records.
  test('produces the corrected figure for a drifted total', () => {
    const milestones = [ms({ id: 'a', amount: 5000, status: 'paid' })]
    const refunds = [rf({ milestoneId: 'a', amount: 5000 })]
    assert.equal(expectedPaidFromMilestones(milestones, refunds), 0)
  })

  test('ignores refunds pointing at milestones that are not paid', () => {
    const milestones = [ms({ id: 'a', amount: 5000, status: 'pending' })]
    const refunds = [rf({ milestoneId: 'a', amount: 1000 })]
    assert.equal(expectedPaidFromMilestones(milestones, refunds), 0)
  })

  test('never returns a negative total', () => {
    const milestones = [ms({ id: 'a', amount: 1000, status: 'paid' })]
    const refunds = [rf({ milestoneId: 'a', amount: 9000 })]
    assert.equal(expectedPaidFromMilestones(milestones, refunds), 0)
  })
})
