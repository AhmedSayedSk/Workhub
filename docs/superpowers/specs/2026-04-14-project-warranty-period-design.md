# Project Warranty Period — Design

**Date:** 2026-04-14
**Status:** Approved for implementation

## Problem

When a project is delivered, we still owe the client support for a contractually-agreed window afterward. Today the only post-delivery status is `completed`, which flattens "just delivered, still on the hook" and "long done, no obligations" into the same bucket. We need a way to see, for a given completed project, whether it's still inside its warranty window and how many days are left.

## Lifecycle model

Warranty is a **lifecycle phase of `completed`**, not a new top-level status. The four existing statuses (`active | paused | completed | cancelled`) stay unchanged. A project is "in warranty" when:

- `status === 'completed'`, AND
- `warrantyStartDate` is set, AND
- `warrantyDays > 0`, AND
- today is within `[warrantyStartDate, warrantyStartDate + warrantyDays]`.

Warranty state is **derived on read** from these fields. There is no background job, no auto-status-flip, no extra Firestore write when warranty expires — the badge just stops rendering as "active" and starts rendering as "expired" based on the current date.

## Data model

Add two optional fields to `Project` in `src/types/index.ts`:

```ts
warrantyDays?: number           // 0 or undefined = no warranty
warrantyStartDate?: Timestamp   // user-picked, required when warrantyDays > 0
```

Both optional so existing projects need no migration. `ProjectInput` gets the same fields.

### Helpers (`src/lib/utils.ts`)

```ts
type WarrantyState = 'none' | 'active' | 'expired'

function getWarrantyState(project: Project): WarrantyState
function getWarrantyDaysLeft(project: Project): number  // 0 if not active
```

Rules:
- `none` — `status !== 'completed'`, or `warrantyDays` is missing/0, or `warrantyStartDate` is missing.
- `active` — today ≤ `warrantyStartDate + warrantyDays` (inclusive).
- `expired` — today > `warrantyStartDate + warrantyDays`.

`getWarrantyDaysLeft` returns `ceil((end - now) / 1 day)`, floored at 0.

Day math uses local time zone and compares at day granularity (not hour/minute) so a 30-day warranty starting today ends exactly 30 days later regardless of the hour the project was saved.

## UI changes

### 1. Project edit form — `src/app/(dashboard)/projects/[id]/page.tsx`

When `editForm.status === 'completed'`, render two additional fields in the existing edit form:

- **Warranty Days** — `<Input type="number" min={0}>`, placeholder "0 (no warranty)"
- **Warranty Start Date** — `<Input type="date">`, defaults to today on first entry, persisted thereafter

Fields are hidden for any other status but their values are preserved in form state, so toggling status back to `completed` restores them. Submit writes both fields to Firestore; if `warrantyDays` is 0 or empty, both fields are written as `null`/omitted.

### 2. Project creation form — `src/app/(dashboard)/projects/new/page.tsx`

No change. New projects start as `active` and have no reason to configure warranty at creation time. Warranty is set later when the project is edited to `completed`.

### 3. Projects list page — `src/app/(dashboard)/projects/page.tsx`

No grouping or sort changes (completed projects stay in the `completed` group). On each project card where `getWarrantyState(project) !== 'none'`, render a small badge next to the project name:

- `'active'` → amber badge: `Warranty · N days left`
- `'expired'` → muted gray badge: `Warranty expired`

The badge renders via a new `<WarrantyBadge project={project} />` component in `src/components/projects/WarrantyBadge.tsx` so both the list page and the detail page can reuse it.

### 4. Project detail page — `src/app/(dashboard)/projects/[id]/page.tsx`

Render `<WarrantyBadge>` next to the existing status badge in the page header (around line 760), using the same component.

## Component: `WarrantyBadge`

New file: `src/components/projects/WarrantyBadge.tsx`

- Takes `project: Project`
- Returns `null` if state is `'none'`
- Uses the existing shadcn `Badge` component with Lucide icons
- Amber styling for active, muted gray for expired
- Uses `cn()` for conditional classes, matching project conventions

## Out of scope

- Dashboard warranty widget or summary
- Finances integration
- Notifications / reminders when warranty nears expiry
- Warranty on sub-projects specifically (field exists uniformly on all projects)
- Audit log entry for warranty edits (current audit logging covers status changes generally)
- Migration for already-`completed` projects (user can edit them to add warranty if desired)

## Testing

This project does not have automated test coverage for the projects UI, so verification is manual:

1. Create a new project → no warranty fields visible in create form.
2. Edit a project, change status to `completed` → warranty fields appear.
3. Set 30 days + today's date → save → list page shows amber `Warranty · 30 days left` badge.
4. Set a date 60 days ago with 30-day warranty → list page shows gray `Warranty expired` badge.
5. Set `warrantyDays = 0` → badge disappears, both fields cleared in Firestore.
6. Switch status to `active`, save, switch back to `completed` → previously entered values still in form state.
7. Open project detail page → badge renders next to status badge in header.
