# Project Warranty Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a warranty period concept to completed projects, configured per-project, with a derived badge showing "Warranty · N days left" or "Warranty expired" on project cards and the project detail header.

**Architecture:** Two optional fields (`warrantyDays`, `warrantyStartDate`) added to `Project`. State derived on read via pure helpers in `src/lib/utils.ts` — no background jobs, no status auto-flip. A new `WarrantyBadge` component is rendered on the projects list card and the detail page header. Edit form gains conditional fields that appear only when the status is set to `completed`.

**Tech Stack:** Next.js, TypeScript, Firebase Firestore, Tailwind, shadcn/ui, Lucide React.

**Spec:** `docs/superpowers/specs/2026-04-14-project-warranty-period-design.md`

**Testing note:** The main app has no test runner set up, so verification per task is `npx tsc --noEmit` for type correctness plus the final manual-verification task at the end. No Vitest/Jest tasks are included.

---

## Task 1: Add warranty fields to `Project` and `ProjectInput` types

**Files:**
- Modify: `src/types/index.ts:83-110` (Project), `src/types/index.ts:220-245` (ProjectInput)

- [ ] **Step 1: Add two optional fields to `Project`**

In `src/types/index.ts`, inside the `Project` interface, add right after the `createdAt` line (line 109):

```ts
  createdAt: Timestamp
  warrantyDays?: number
  warrantyStartDate?: Timestamp | null
}
```

(The existing closing `}` of the interface moves down.)

- [ ] **Step 2: Add the same fields to `ProjectInput`**

In `src/types/index.ts`, inside the `ProjectInput` interface, append right before the closing `}` (currently at line 245):

```ts
  warrantyDays?: number
  warrantyStartDate?: Date | null
}
```

Note: `Project` uses `Timestamp` (Firestore wire format) and `ProjectInput` uses `Date` (JS form value). This matches the existing pattern used by `deadline` / `startDate`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (Pre-existing errors unrelated to this change are OK — record them so later tasks don't mistake them for regressions.)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add warrantyDays and warrantyStartDate to Project"
```

---

## Task 2: Add warranty helpers to `src/lib/utils.ts`

**Files:**
- Modify: `src/lib/utils.ts` (append after the existing `statusColors` export, near line 246)

- [ ] **Step 1: Add the `WarrantyState` type and two helper functions**

Append this block to `src/lib/utils.ts` after the `statusColors` export (around line 247). Make sure `Project` is imported — if it is not already, add `import type { Project } from '@/types'` at the top of the file.

```ts
export type WarrantyState = 'none' | 'active' | 'expired'

/**
 * Returns the warranty state of a project based on its status and warranty fields.
 * Pure and safe to call on any project — projects without warranty data return 'none'.
 */
export function getWarrantyState(project: Project): WarrantyState {
  if (project.status !== 'completed') return 'none'
  if (!project.warrantyDays || project.warrantyDays <= 0) return 'none'
  if (!project.warrantyStartDate) return 'none'

  const start = project.warrantyStartDate.toDate()
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const end = new Date(startDay)
  end.setDate(end.getDate() + project.warrantyDays)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return today <= end ? 'active' : 'expired'
}

/**
 * Days remaining in the warranty window (ceil, floored at 0).
 * Returns 0 if the project is not currently in an active warranty.
 */
export function getWarrantyDaysLeft(project: Project): number {
  if (getWarrantyState(project) !== 'active') return 0

  const start = project.warrantyStartDate!.toDate()
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const end = new Date(startDay)
  end.setDate(end.getDate() + project.warrantyDays!)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const msLeft = end.getTime() - today.getTime()
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)))
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat(utils): add getWarrantyState and getWarrantyDaysLeft helpers"
```

---

## Task 3: Handle `warrantyStartDate` Date→Timestamp conversion in `firestore.ts`

**Files:**
- Modify: `src/lib/firestore.ts:216-238` (projects.create and projects.update)

- [ ] **Step 1: Update `projects.create` to convert `warrantyStartDate`**

Replace the existing `create` function (lines 216-227) with:

```ts
  async create(data: ProjectInput & { ownerId: string }): Promise<string> {
    return create('projects', {
      ...data,
      parentProjectId: data.parentProjectId ?? null,
      hasOwnFinances: data.hasOwnFinances ?? true,
      startDate: Timestamp.fromDate(data.startDate),
      deadline: toTimestamp(data.deadline),
      warrantyStartDate: toTimestamp(data.warrantyStartDate ?? null),
      ownerId: data.ownerId,
      sharedWith: data.sharedWith ?? [],
      pendingSharedEmails: data.pendingSharedEmails ?? [],
    })
  },
```

- [ ] **Step 2: Update `projects.update` to convert `warrantyStartDate`**

Replace the existing `update` function (lines 229-238) with:

```ts
  async update(id: string, data: Partial<ProjectInput>): Promise<void> {
    const updateData: DocumentData = { ...data }
    if (data.startDate) {
      updateData.startDate = Timestamp.fromDate(data.startDate)
    }
    if (data.deadline !== undefined) {
      updateData.deadline = toTimestamp(data.deadline)
    }
    if (data.warrantyStartDate !== undefined) {
      updateData.warrantyStartDate = toTimestamp(data.warrantyStartDate)
    }
    return update('projects', id, updateData)
  },
```

Both changes reuse the existing `toTimestamp` helper which handles `null` correctly.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat(firestore): persist warrantyStartDate as Timestamp"
```

---

## Task 4: Create `WarrantyBadge` component

**Files:**
- Create: `src/components/projects/WarrantyBadge.tsx`

- [ ] **Step 1: Create the file**

Write `src/components/projects/WarrantyBadge.tsx` with this exact content:

```tsx
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getWarrantyState, getWarrantyDaysLeft } from '@/lib/utils'
import type { Project } from '@/types'

interface WarrantyBadgeProps {
  project: Project
  className?: string
}

export function WarrantyBadge({ project, className }: WarrantyBadgeProps) {
  const state = getWarrantyState(project)
  if (state === 'none') return null

  if (state === 'active') {
    const daysLeft = getWarrantyDaysLeft(project)
    return (
      <Badge
        variant="outline"
        className={cn(
          'bg-amber-500/8 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/15 dark:border-amber-500/20 gap-1',
          className,
        )}
      >
        <ShieldCheck className="h-3 w-3" />
        Warranty · {daysLeft} day{daysLeft === 1 ? '' : 's'} left
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-slate-500/8 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-500/15 dark:border-slate-500/20 gap-1',
        className,
      )}
    >
      <ShieldOff className="h-3 w-3" />
      Warranty expired
    </Badge>
  )
}
```

The amber palette for the active state mirrors `statusColors.project.paused` in `src/lib/utils.ts:213`; the slate palette mirrors `statusColors.feature.pending`. This keeps the badge visually consistent with the rest of the app without inventing new tokens.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. If the import of `Badge` fails, confirm the path — existing usages in `src/app/(dashboard)/projects/[id]/page.tsx` import it via `@/components/ui/badge`.

- [ ] **Step 3: Commit**

```bash
git add src/components/projects/WarrantyBadge.tsx
git commit -m "feat(projects): add WarrantyBadge component"
```

---

## Task 5: Add warranty fields to the project edit form state

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx:202-218` (editForm state), `:454-475` (openEditDialog), `:477-508` (handleEditProject)

- [ ] **Step 1: Extend `editForm` initial state**

In `src/app/(dashboard)/projects/[id]/page.tsx`, replace the `editForm` useState block (lines 202-218) with:

```tsx
  const [editForm, setEditForm] = useState({
    name: '',
    clientName: '',
    clientNumber: '',
    description: '',
    status: 'active' as ProjectStatus,
    paymentModel: 'milestone' as PaymentModel,
    totalAmount: '',
    estimatedValue: '',
    startDate: null as Date | null,
    deadline: null as Date | null,
    notes: '',
    coverImageUrl: null as string | null,
    color: colorPresets[0].value,
    projectType: null as ProjectType | null,
    repoPath: '' as string,
    warrantyDays: '' as string,
    warrantyStartDate: null as Date | null,
  })
```

- [ ] **Step 2: Populate warranty fields in `openEditDialog`**

Replace the `setEditForm({ ... })` block inside `openEditDialog` (lines 456-472) with:

```tsx
      setEditForm({
        name: project.name,
        clientName: project.clientName || '',
        clientNumber: project.clientNumber || '',
        description: project.description,
        status: project.status,
        paymentModel: project.paymentModel,
        totalAmount: project.totalAmount.toString(),
        estimatedValue: project.estimatedValue?.toString() || '',
        startDate: project.startDate.toDate(),
        deadline: project.deadline ? project.deadline.toDate() : null,
        notes: project.notes,
        coverImageUrl: project.coverImageUrl || null,
        color: project.color || colorPresets[0].value,
        projectType: project.projectType || null,
        repoPath: project.repoPath || '',
        warrantyDays: project.warrantyDays ? project.warrantyDays.toString() : '',
        warrantyStartDate: project.warrantyStartDate ? project.warrantyStartDate.toDate() : null,
      })
```

- [ ] **Step 3: Persist warranty fields in `handleEditProject`**

Replace the `updateData` object construction inside `handleEditProject` (lines 483-501) with:

```tsx
      const isEditInternal = editForm.paymentModel === 'internal'
      const parsedWarrantyDays = parseInt(editForm.warrantyDays, 10)
      const hasWarranty =
        editForm.status === 'completed' && parsedWarrantyDays > 0 && editForm.warrantyStartDate !== null

      const updateData: Partial<ProjectInput> = {
        name: editForm.name,
        clientName: editForm.clientName,
        clientNumber: editForm.clientNumber,
        description: editForm.description,
        status: editForm.status,
        paymentModel: editForm.paymentModel,
        totalAmount: isEditInternal ? 0 : (parseFloat(editForm.totalAmount) || 0),
        startDate: editForm.startDate,
        deadline: editForm.deadline,
        notes: editForm.notes,
        coverImageUrl: editForm.coverImageUrl,
        color: editForm.color,
        projectType: editForm.projectType || null,
        repoPath: editForm.repoPath.trim() || null,
        warrantyDays: hasWarranty ? parsedWarrantyDays : 0,
        warrantyStartDate: hasWarranty ? editForm.warrantyStartDate : null,
      }
      if (isEditInternal && editForm.estimatedValue) {
        updateData.estimatedValue = parseFloat(editForm.estimatedValue)
      }
```

Rationale: when the status is not `completed`, or days is 0/empty, or start date is missing, we write `warrantyDays: 0` and `warrantyStartDate: null` to Firestore. This guarantees `getWarrantyState` returns `'none'` for such projects and also lets `firestore.ts` (from Task 3) convert `null` through `toTimestamp` cleanly.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat(projects): track warranty fields in edit form state"
```

---

## Task 6: Render conditional warranty inputs in the edit dialog

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx:1627-1644` (status Select block)

- [ ] **Step 1: Add the warranty fields block right after the status/projectType grid**

In the edit dialog JSX, find the closing `</div>` of the `grid gap-4 md:grid-cols-2` block that contains the Status Select and Project Type Popover (the outer grid starts near line 1627). Immediately after that grid's closing `</div>`, insert a new conditional block:

```tsx
            {editForm.status === 'completed' && (
              <div className="grid gap-4 md:grid-cols-2 rounded-md border border-dashed border-border/60 p-3 bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="edit-warranty-days">Warranty Days</Label>
                  <Input
                    id="edit-warranty-days"
                    type="number"
                    min={0}
                    placeholder="0 (no warranty)"
                    value={editForm.warrantyDays}
                    onChange={(e) => setEditForm({ ...editForm, warrantyDays: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-warranty-start">Warranty Start Date</Label>
                  <Input
                    id="edit-warranty-start"
                    type="date"
                    value={
                      editForm.warrantyStartDate
                        ? editForm.warrantyStartDate.toISOString().slice(0, 10)
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        warrantyStartDate: e.target.value ? new Date(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
            )}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat(projects): show warranty fields when editing a completed project"
```

---

## Task 7: Render `WarrantyBadge` in the project detail header

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx` (status badge near line 758-763), and imports near the top of the file.

- [ ] **Step 1: Import `WarrantyBadge`**

Add to the imports near the top of `src/app/(dashboard)/projects/[id]/page.tsx` (placement: alongside other `@/components/projects/*` imports, or if none exist in this file, add it as a standalone import):

```tsx
import { WarrantyBadge } from '@/components/projects/WarrantyBadge'
```

- [ ] **Step 2: Render the badge next to the existing status badge**

Locate the existing block (around lines 758-763):

```tsx
              <Badge
                variant="outline"
                className={statusColors.project[project.status]}
              >
                {project.status}
              </Badge>
```

Replace with:

```tsx
              <Badge
                variant="outline"
                className={statusColors.project[project.status]}
              >
                {project.status}
              </Badge>
              <WarrantyBadge project={project} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat(projects): show warranty badge on project detail header"
```

---

## Task 8: Render `WarrantyBadge` on the projects list card

**Files:**
- Modify: `src/app/(dashboard)/projects/page.tsx` (CardTitle block around line 244), and imports.

- [ ] **Step 1: Import `WarrantyBadge`**

Add to the imports near the top of `src/app/(dashboard)/projects/page.tsx`:

```tsx
import { WarrantyBadge } from '@/components/projects/WarrantyBadge'
```

- [ ] **Step 2: Render the badge inline with the project title**

Locate this block around line 244:

```tsx
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-xl pr-16 !mt-0 truncate">{project.name}</CardTitle>
```

Replace with:

```tsx
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 pr-16">
                                  <CardTitle className="text-xl !mt-0 truncate">{project.name}</CardTitle>
                                  <WarrantyBadge project={project} className="shrink-0" />
                                </div>
```

The `pr-16` moves from the title to the wrapping flex row so the payment-model icon in the top-right absolute-positioned area (line 231) still has clearance. The badge is `shrink-0` so the title truncates first on narrow cards.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/projects/page.tsx
git commit -m "feat(projects): show warranty badge on projects list card"
```

---

## Task 9: Manual verification

**Files:** none (manual UI walkthrough)

This task is a checklist the implementer runs in a browser to confirm the feature behaves as the spec describes. If any step fails, fix the underlying code and commit the fix before marking this task done.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (if the user already has it running, skip)
Open the app in a browser and log in.

- [ ] **Step 2: Verify the create flow has no warranty fields**

Go to `/projects/new`. Confirm: no Warranty Days / Warranty Start Date fields are visible. (Spec §UI §2 — new projects should not expose warranty at creation time.)

- [ ] **Step 3: Verify edit form — non-completed statuses hide warranty fields**

Open any existing project, click Edit. With status `active`, `paused`, or `cancelled`, confirm: no warranty fields visible.

- [ ] **Step 4: Verify edit form — completed status shows warranty fields**

Switch status to `Completed`. Confirm: the two warranty fields appear (Warranty Days, Warranty Start Date) inside a dashed bordered box.

- [ ] **Step 5: Active warranty — badge shows "N days left"**

Enter `Warranty Days = 30`, `Warranty Start Date = today`, save. On the project detail header and on the projects list card for this project, confirm: amber badge reads `Warranty · 30 days left`.

- [ ] **Step 6: Expired warranty — badge shows "Warranty expired"**

Edit the same project. Set `Warranty Start Date` to ~60 days ago (pick a date using the date picker), `Warranty Days = 30`, save. Confirm: muted gray badge reads `Warranty expired` on both the detail header and the list card.

- [ ] **Step 7: Zero days clears warranty**

Edit the same project. Set `Warranty Days = 0`, save. Confirm: badge disappears from both places.

- [ ] **Step 8: Status toggle preserves warranty form state during one edit session**

Open Edit again. Set status back to `Completed` — the previously saved warranty values (if you re-entered them in step 5 or 6) should be populated from Firestore. Flip status to `active` → fields hide. Flip back to `completed` → fields reappear with the values still in form state (not wiped).

- [ ] **Step 9: Non-completed project with warranty data never shows the badge**

Directly via the edit form, set status to `active` and save (which clears warranty per Task 5 Step 3 logic). Confirm: no warranty badge appears anywhere, even if warranty data once existed.

- [ ] **Step 10: Record the result**

If all steps pass, commit a trivial marker or just move on. If any step failed, note which and fix before marking Task 9 complete.

---

## Out of scope (do NOT implement)

These are in the spec's "Out of scope" section and must not be added during this plan:

- Dashboard warranty widget / summary
- Finances integration
- Notifications or reminders when warranty nears expiry
- Audit log entry specifically for warranty field edits
- Migration for already-completed projects
- Warranty fields in the project **creation** form (`projects/new/page.tsx`)
