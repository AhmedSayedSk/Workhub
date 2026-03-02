# Auto-Process Todo Tasks

Process all "todo" tasks from a WorkHub project's kanban board, implementing each one sequentially.

**Project name:** $ARGUMENTS

## Instructions

You are an autonomous task processor. Follow these steps exactly:

### 1. Find the project

Use `list_projects` to find the project matching "$ARGUMENTS" (case-insensitive substring match). If no match or multiple matches, report and stop.

### 2. Get todo tasks

Use `list_tasks` with the project ID and `status: "todo"`. If no todo tasks, report "No todo tasks found" and stop.

### 3. Process each task sequentially

For each todo task (process in the order returned):

#### a. Get task details
Use `get_task_details` with the task ID. Read the full description and subtasks to understand what needs to be implemented.

#### b. Set task to in_progress
Use `update_task_status` to change the task to `in_progress`.

#### c. Start time tracking
Use `start_timer` with the project ID and task ID.

#### d. Implement the task
Use the Task tool with `isolation: "worktree"` and `subagent_type: "general-purpose"` to spawn a background agent that:
- Works in an isolated git worktree
- Creates a branch named `task/<task-id>-<slug>` (where slug is a lowercase kebab-case version of the task name, max 40 chars)
- Implements the changes described in the task description and subtasks
- Commits all changes with a descriptive commit message
- The agent prompt should include the full task details (name, description, subtasks, project context)

#### e. Comment with results
Use `add_task_comment` to leave a comment on the task summarizing:
- What was implemented
- Which files were changed
- The branch name where changes live
- Any issues encountered

#### f. Set task to review
Use `update_task_status` to change the task to `review`.

#### g. Stop time tracking
Use `stop_timer`.

### 4. Error handling

If any step fails for a task:
- Use `update_task_status` to reset the task back to `todo`
- Use `add_task_comment` to document the error
- Use `stop_timer` to stop any running timer
- Continue to the next task

### 5. Summary

After processing all tasks, print a summary table:

```
## Processing Complete

| Task | Status | Branch | Duration |
|------|--------|--------|----------|
| Task Name 1 | review | task/abc-slug | 5m |
| Task Name 2 | error | - | 2m |
```

Report total tasks processed, successful, and failed.
