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

// Connect via stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP Server failed to start:', error);
  process.exit(1);
});
