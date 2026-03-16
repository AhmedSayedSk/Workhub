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
import { addTaskCommentSchema, addTaskComment } from './tools/add-task-comment.js';

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
  'add_task_comment',
  'Add a comment to a task or subtask. Shows up in the WorkHub UI.',
  addTaskCommentSchema,
  async (args) => addTaskComment(args)
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
