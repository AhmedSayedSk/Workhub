import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { listProjectsSchema, listProjects } from './tools/list-projects.js';
import { listTasksSchema, listTasks } from './tools/list-tasks.js';
import { startTimerSchema, startTimer } from './tools/start-timer.js';
import { stopTimerSchema, stopTimer } from './tools/stop-timer.js';
import { logTimeSchema, logTime } from './tools/log-time.js';
import { getTimerStatus } from './tools/get-timer-status.js';
import { getTimeSummarySchema, getTimeSummary } from './tools/get-time-summary.js';
import { listTimeEntriesSchema, listTimeEntries } from './tools/list-time-entries.js';
import { updateTimeEntrySchema, updateTimeEntry } from './tools/update-time-entry.js';
import { deleteTimeEntrySchema, deleteTimeEntry } from './tools/delete-time-entry.js';
import { getTaskDetailsSchema, getTaskDetails } from './tools/get-task-details.js';
import { updateTaskStatusSchema, updateTaskStatus } from './tools/update-task-status.js';
import { createTaskSchema, createTask } from './tools/create-task.js';
import { listTaskQuestionsSchema, listTaskQuestions } from './tools/list-task-questions.js';
import { addTaskQuestionSchema, addTaskQuestion } from './tools/add-task-question.js';
import { updateTaskQuestionSchema, updateTaskQuestion } from './tools/update-task-question.js';
import { deleteTaskQuestionSchema, deleteTaskQuestion } from './tools/delete-task-question.js';
import { updateTaskAssigneesSchema, updateTaskAssignees } from './tools/update-task-assignees.js';
import { listMembersSchema, listMembers } from './tools/list-members.js';
import { addTaskCommentSchema, addTaskComment } from './tools/add-task-comment.js';
import { updateTaskCommentSchema, updateTaskComment } from './tools/update-task-comment.js';
import { deleteTaskCommentSchema, deleteTaskComment } from './tools/delete-task-comment.js';

const server = new McpServer({
  name: 'workhub',
  version: '1.0.0',
});

// Register tools
server.tool(
  'list_projects',
  'List WorkHub projects. Optionally filter by name or status.',
  listProjectsSchema,
  async (args) => listProjects(args)
);

server.tool(
  'list_tasks',
  'List tasks for a WorkHub project. Optionally filter by status or name.',
  listTasksSchema,
  async (args) => listTasks(args)
);

server.tool(
  'start_timer',
  'Start tracking time on a project/task. Auto-stops any running timer.',
  startTimerSchema,
  async (args) => startTimer(args)
);

server.tool(
  'stop_timer',
  'Stop the currently running timer.',
  stopTimerSchema,
  async (args) => stopTimer(args)
);

server.tool(
  'log_time',
  'Log a completed time entry manually (e.g. "2h 30m", "90m", "1.5h").',
  logTimeSchema,
  async (args) => logTime(args)
);

server.tool(
  'get_timer_status',
  'Check if a timer is currently running and show elapsed time.',
  {},
  async () => getTimerStatus()
);

server.tool(
  'get_time_summary',
  'Get a summary of tracked time for today, this week, or this month.',
  getTimeSummarySchema,
  async (args) => getTimeSummary(args)
);

server.tool(
  'list_time_entries',
  'List individual time entries for a date (defaults to today). Shows entry IDs for updating/deleting.',
  listTimeEntriesSchema,
  async (args) => listTimeEntries(args)
);

server.tool(
  'update_time_entry',
  'Update a time entry (duration, notes, project, or task).',
  updateTimeEntrySchema,
  async (args) => updateTimeEntry(args)
);

server.tool(
  'delete_time_entry',
  'Delete a time entry by its ID.',
  deleteTimeEntrySchema,
  async (args) => deleteTimeEntry(args)
);

server.tool(
  'get_task_details',
  'Get full details of a task including description, subtasks, project/feature names, and comment count.',
  getTaskDetailsSchema,
  async (args) => getTaskDetails(args)
);

server.tool(
  'update_task_status',
  'Update a task status (todo, in_progress, review, done). Creates a project log entry and optionally adds a comment.',
  updateTaskStatusSchema,
  async (args) => updateTaskStatus(args)
);

server.tool(
  'create_task',
  'Create a new task in a WorkHub project. Required: projectId, name. Optional: description, status, taskType, priority, estimatedHours, featureId, deadline (ISO date), assigneeIds, skipAutoAssign, icon, waiting/waitingReason, sortOrder.',
  createTaskSchema,
  async (args) => createTask(args)
);

server.tool(
  'list_task_questions',
  "List questions attached to a task with their answers. Use this to retrieve owner-provided context before executing a task. Filter by status: 'all' (default), 'unanswered', or 'answered'.",
  listTaskQuestionsSchema,
  async (args) => listTaskQuestions(args)
);

server.tool(
  'add_task_question',
  "Add a question to a task for the owner to answer in the WorkHub UI. Use this during brainstorming/thinking when you need owner input before executing the task. The owner sees questions on the task card (kanban indicator) and inside the task detail modal.",
  addTaskQuestionSchema,
  async (args) => addTaskQuestion(args)
);

server.tool(
  'update_task_question',
  "Edit a question's text. Only allowed while the question is still unanswered.",
  updateTaskQuestionSchema,
  async (args) => updateTaskQuestion(args)
);

server.tool(
  'delete_task_question',
  'Delete an unanswered question. Answered questions are locked to preserve the audit trail.',
  deleteTaskQuestionSchema,
  async (args) => deleteTaskQuestion(args)
);

server.tool(
  'update_task_assignees',
  "Update a task's assigneeIds. Accepts a list of member IDs plus a mode: 'set' (replace, default), 'add' (append), or 'remove'. Use list_members to resolve member names to IDs.",
  updateTaskAssigneesSchema,
  async (args) => updateTaskAssignees(args)
);

server.tool(
  'list_members',
  'List team members (id, name, role, email). Optionally filter by name/role/email.',
  listMembersSchema,
  async (args) => listMembers(args)
);

server.tool(
  'add_task_comment',
  'Add a comment to a task or subtask. Shows up in the WorkHub UI.',
  addTaskCommentSchema,
  async (args) => addTaskComment(args)
);

server.tool(
  'update_task_comment',
  'Edit the text of an existing task/subtask comment by its commentId. By default only comments authored by this MCP can be edited.',
  updateTaskCommentSchema,
  async (args) => updateTaskComment(args)
);

server.tool(
  'delete_task_comment',
  'Delete a task/subtask comment by its commentId. Pass force:true to override the same-author guard.',
  deleteTaskCommentSchema,
  async (args) => deleteTaskComment(args)
);

// Connect via stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP Server failed to start:', error);
  process.exit(1);
});
