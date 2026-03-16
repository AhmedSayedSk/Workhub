# Auto-Process Todo Tasks (Parallel)

Process all "todo" tasks from a WorkHub project's kanban board, running tasks from different features in parallel (max 3 concurrent), sequential within the same feature.

**Project name:** $ARGUMENTS

## Instructions

You are an autonomous task processor with parallel execution. Follow these steps exactly:

### 1. Find the project

Use `list_projects` to find the project matching "$ARGUMENTS" (case-insensitive substring match). If no match or multiple matches, report and stop.

### 2. Get todo tasks

Use `list_tasks` with the project ID and `status: "todo"`. If no todo tasks, report "No todo tasks found" and stop.

### 3. Group tasks by feature

Use `get_task_details` on each task to determine its feature. Group tasks by feature ID. Tasks without a feature form their own group.

### 4. Process task groups in parallel

Launch up to 3 feature groups concurrently. Within each group, process tasks sequentially.

For each task:

#### a. Set task to in_progress
Use `update_task_status` to change the task to `in_progress`.

#### b. Start time tracking
Use `start_timer` with the project ID and task ID.

#### c. Implement the task
Use the Task tool with `isolation: "worktree"` and `subagent_type: "general-purpose"` to spawn an agent that:
- Works in an isolated git worktree
- Creates a branch named `task/<task-id>-<slug>` (where slug is a lowercase kebab-case version of the task name, max 40 chars)
- Implements the changes described in the task description and subtasks
- Commits all changes with a descriptive commit message
- The agent prompt should include the full task details (name, description, subtasks, project context)

#### d. Comment with results
Use `add_task_comment` to leave a comment on the task summarizing:
- What was implemented
- Which files were changed
- The branch name where changes live
- Any issues encountered

#### e. Set task to review
Use `update_task_status` to change the task to `review`.

#### f. Stop time tracking
Use `stop_timer`.

### 5. Error handling

If any step fails for a task:
- Use `update_task_status` to reset the task back to `todo`
- Use `add_task_comment` to document the error
- Use `stop_timer` to stop any running timer
- Continue to the next task in the group

### 6. Concurrency rules

- Maximum 3 Task agents running simultaneously
- Tasks within the same feature must be processed sequentially (they may depend on each other)
- Tasks in different features can run in parallel (they are independent)
- Wait for all groups to complete before printing the summary

### 7. Summary

After all groups complete, print a summary table:

```
## Processing Complete

| Feature | Task | Status | Branch | Duration |
|---------|------|--------|--------|----------|
| Auth | Login page | review | task/abc-login-page | 5m |
| Auth | Signup flow | review | task/def-signup-flow | 8m |
| Dashboard | Charts | error | - | 2m |
```

Report total tasks processed, successful, failed, and features covered.
