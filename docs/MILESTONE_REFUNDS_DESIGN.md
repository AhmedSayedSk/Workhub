# Milestone refunds — design

**Date:** 2026-08-14
**Status:** approved, ready for implementation planning

Let a paid milestone be refunded in full or in part, so a project's reported
income reflects money actually kept rather than money ever received.

## Decisions

| Question | Decision |
|---|---|
| What a refund attaches to | A specific **paid milestone**. Never free-floating. |
| Partial refunds | Yes. Many refunds per milestone; their sum may never exceed the milestone amount. |
| Reporting | **Net.** `paidAmount` drops when a refund is recorded. Refunds are also surfaced as their own figure so nothing is hidden. |
| Milestone status after a full refund | Unchanged — stays `paid`. "Fully refunded" is **derived from the amounts** and shown as a badge. |
| Corrections | Refunds can be **edited and deleted**, every change audit-logged. |
| Scope | **Milestones only.** Monthly payments, and the bare `paidAmount` on fixed/internal projects, are explicitly out. |

Out of scope, deliberately: refunding monthly payments; refunds on fixed-price
projects (no payment record to attach to); any change to how `paidAmount` is
consumed by the five screens that read it today.

## Why not derive `paidAmount`

`project.paidAmount` is a **stored running total, incremented by hand in the UI**:

```ts
// projects/[id]/page.tsx — marking a milestone paid
await updateProject({ paidAmount: project.paidAmount + milestone.amount }, false)
```

It is read by the dashboard, finances page, project detail, `ProjectIncomeChart`
and the assistant. Two options were weighed:

- **Derive** `paid = Σ paid milestones − Σ refunds` and change every consumer.
  Correct by construction, but `paidAmount` also serves `fixed` / `monthly` /
  `internal` projects that have no milestones, so the helper needs per-model
  branching — a large blast radius across money code the feature never asked to
  touch.
- **Mirror the existing pattern**: a refund decrements `paidAmount` exactly as a
  payment increments it. Every consumer becomes net automatically with no
  changes at all.

We take the second, **plus a drift guard**: the weakness of a hand-maintained
total is that it can silently disagree with the records. So one pure function
computes what the total *should* be, unit tests pin it, and a "recalculate"
action repairs a project whose stored value has drifted. Minimal diff, with the
actual weakness addressed rather than ignored.

## Data model

New Firestore collection `refunds`, one document per refund:

```ts
export interface Refund {
  id: string
  projectId: string          // denormalised so refunds can be listed per project
  milestoneId: string        // the paid milestone being reversed
  amount: number             // positive; stored as a magnitude, never negative
  reason: string             // free text, may be empty
  refundedAt: Timestamp      // when the money actually went back
  createdAt: Timestamp
}

export interface RefundInput {
  projectId: string
  milestoneId: string
  amount: number
  reason: string
  refundedAt: Date
}
```

`amount` is stored **positive** and subtracted at the point of use. A signed
amount invites a double-negation bug the first time someone sums a list.

No new `PaymentStatus` or `MilestoneStatus` value. No new permission flags —
refunds reuse `viewPayments` / `createEditPayments` / `deletePayments`.

## The invariant

One rule governs everything:

> For any milestone, `Σ refunds ≤ milestone.amount`.

Enforced at the point of creation and edit, using the milestone's *other*
refunds (excluding the one being edited). A refund is rejected with a clear
message rather than silently clamped — clamping would make the number disagree
with what the user typed.

Derived, never stored:

```ts
refundedTotal(milestoneId)  = Σ refunds for that milestone
netPaid(milestone)          = milestone.amount − refundedTotal
isFullyRefunded(milestone)  = refundedTotal >= milestone.amount   // amount > 0
```

## Money flow

Recording a refund of `A` against milestone `M` on project `P`:

1. Validate `A > 0` and `A ≤ M.amount − refundedTotal(M)`.
2. Create the `refunds` document.
3. `updateProject({ paidAmount: Math.max(0, P.paidAmount - A) })`.
4. Write an audit entry.

Editing from `A` to `A'` adjusts by the delta `A' − A`. Deleting adds `A` back.
The `Math.max(0, …)` floor stops a drifted total from going negative and
rendering nonsense across five screens.

**Ordering note:** the create/update pair is not atomic, matching the existing
mark-as-paid code which has the same shape. The refund document is written
*first* so the failure mode is a recorded refund with a stale total — visible and
repairable by "recalculate" — rather than a vanished refund with reduced income,
which would be invisible.

## Drift guard

```ts
// src/lib/paymentTotals.ts — pure, no Firestore
export function expectedPaidFromMilestones(
  milestones: Pick<Milestone, 'id' | 'amount' | 'status'>[],
  refunds: Pick<Refund, 'milestoneId' | 'amount'>[],
): number
```

Sums paid milestones, subtracts their refunds, floors at zero. Used by:

- unit tests, as the specification of correct behaviour
- a **Recalculate** action on the project's payment section, which writes the
  computed value to `paidAmount` and audit-logs the correction

This applies to milestone-model projects only. For other payment models the
function is not consulted and the button is not shown.

## UI

**Project detail — milestone row.** A paid milestone gains a *Refund* action.
Once refunded it shows `5,000 paid · 1,500 refunded · net 3,500`, and a
`fully refunded` badge when the derived flag is true. Refunds are listed beneath
the milestone with edit/delete.

**Refund dialog.** Amount (defaulted and capped at the remaining refundable
figure, which is stated in the field's help text), date, optional reason.
Follows the existing milestone dialog: shadcn `Dialog`, `Input`, `Label`,
`Button`, single page, Lucide icons.

**Project payment summary.** A `Refunded` line appears beneath `Paid` when the
project has any refund, so net income is never silently different from what was
invoiced.

**Finances page.** A `Refunded` total alongside the existing figures, and the
per-project rows show refunds where present. Because `paidAmount` is already net,
existing totals need no recalculation — this is presentation only.

## Audit logging

Refunds log under the **existing `'payment'`** audit type with actions
`refund_created`, `refund_updated`, `refund_deleted`, `paid_amount_recalculated`.

⚠ Do **not** add a new `AuditLogType`. The audit-logs page holds an exhaustive
`Record<AuditLogType, …>`; adding a value without updating it breaks the
production build. That exact mistake broke a build when `'server'` was added.

## Security rules

Refunds carry the same sensitivity as the milestones they reverse, so the rule
mirrors the milestones block exactly:

```
match /refunds/{refundId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && hasProjectAccess(request.resource.data.projectId);
  allow update, delete: if isAuthenticated() && isProjectOwner(resource.data.projectId);
}
```

This is why `projectId` is denormalised onto the refund document — the rules
need it on the record itself to authorise the write, exactly as milestones do.

Deploy with `npm run firebase:deploy:rules`. Note this instance is effectively
single-user, so `isAuthenticated()` on read is consistent with every neighbouring
collection rather than a new exposure.

## Testing

Pure logic in `src/lib/__tests__/paymentTotals.test.ts`, matching the existing
Node test-runner pattern:

- refund reduces net paid by its amount
- several partial refunds sum correctly
- refunds summing to the milestone amount give net zero and set fully-refunded
- a refund exceeding the remaining refundable amount is rejected
- editing a refund applies the delta, not the new value twice
- deleting a refund restores the total
- unpaid milestones contribute nothing
- a drifted `paidAmount` is corrected to the computed value
- the result never goes negative

The invariant and the edit-delta case are the two most likely to regress, and
both are cheap to pin here rather than by clicking.

## Risks

| Risk | Mitigation |
|---|---|
| `paidAmount` drifts from the records | Pure function + Recalculate action + tests |
| Edit applies the new amount instead of the delta | Explicit unit test |
| Refund exceeds what was paid | Invariant checked on create and edit |
| A new audit type breaks the build | Reuse `'payment'`; called out above |
| Non-atomic write leaves a stale total | Refund written first; failure is visible and repairable |
