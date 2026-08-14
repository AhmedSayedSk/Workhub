/**
 * Money arithmetic for milestone payments and their refunds.
 *
 * Pure on purpose: `project.paidAmount` is a stored running total that the UI
 * maintains by hand (`paidAmount + milestone.amount` when a milestone is marked
 * paid), and five screens read it. A refund decrements it the same way, which
 * keeps every one of those screens correct with no changes — but a hand-kept
 * total can silently drift from the records behind it.
 *
 * These functions are the answer to "what *should* the total be", used both by
 * the unit tests and by the Recalculate action that repairs a drifted project.
 * They touch no Firestore and no React so they can be reasoned about directly.
 *
 * Refund amounts are stored POSITIVE and subtracted here. A signed amount
 * invites a double-negation the first time someone sums a list.
 */

/** The slice of a milestone this module needs. */
export interface MilestoneLike {
  id: string
  amount: number
  status: 'pending' | 'completed' | 'paid'
}

/** The slice of a refund this module needs. `id` is only required when excluding one. */
export interface RefundLike {
  id?: string
  milestoneId: string
  amount: number
}

/** Guards against NaN/undefined slipping in from a partially-loaded document. */
const num = (n: number | undefined | null): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

/** Only a paid milestone has actually received money. */
const isPaid = (m: MilestoneLike): boolean => m.status === 'paid'

/**
 * Total refunded against one milestone.
 * `excludeRefundId` omits a single refund — used while editing it, so its own
 * current value is not counted against the cap it is being checked against.
 */
export function refundedTotal(
  milestoneId: string,
  refunds: RefundLike[],
  excludeRefundId?: string,
): number {
  return refunds
    .filter((r) => r.milestoneId === milestoneId && (!excludeRefundId || r.id !== excludeRefundId))
    .reduce((sum, r) => sum + num(r.amount), 0)
}

/** What the project actually kept from this milestone. Never negative. */
export function netPaid(milestone: MilestoneLike, refunds: RefundLike[]): number {
  if (!isPaid(milestone)) return 0
  return Math.max(0, num(milestone.amount) - refundedTotal(milestone.id, refunds))
}

/**
 * Derived, never stored — which is why a fully refunded milestone can keep
 * `status: 'paid'` without the badge and the money ever disagreeing.
 *
 * A zero-amount milestone is never "fully refunded": nothing was paid, so the
 * badge would be a lie.
 */
export function isFullyRefunded(milestone: MilestoneLike, refunds: RefundLike[]): boolean {
  const amount = num(milestone.amount)
  if (!isPaid(milestone) || amount <= 0) return false
  return refundedTotal(milestone.id, refunds) >= amount
}

/**
 * The cap enforced when creating or editing a refund: how much of this
 * milestone is still refundable. Pass the id of the refund being edited so it
 * is not counted against itself.
 */
export function remainingRefundable(
  milestone: MilestoneLike,
  refunds: RefundLike[],
  excludeRefundId?: string,
): number {
  if (!isPaid(milestone)) return 0
  return Math.max(0, num(milestone.amount) - refundedTotal(milestone.id, refunds, excludeRefundId))
}

/**
 * What `project.paidAmount` should be for a milestone-model project, given the
 * records. The Recalculate action writes this back when the stored value has
 * drifted.
 *
 * Refunds against milestones that are not paid are ignored rather than
 * subtracted — an unpaid milestone contributed nothing to the total, so
 * subtracting from it would push the project's income below reality.
 */
export function expectedPaidFromMilestones(
  milestones: MilestoneLike[],
  refunds: RefundLike[],
): number {
  const total = milestones.reduce((sum, m) => sum + netPaid(m, refunds), 0)
  return Math.max(0, total)
}
