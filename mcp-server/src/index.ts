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
import { listScheduledPostsSchema, listScheduledPosts } from './tools/list-scheduled-posts.js';
import { schedulerStatusSchema, schedulerStatus } from './tools/scheduler-status.js';
import { runSchedulerSchema, runScheduler } from './tools/run-scheduler.js';
import { createSocialPostSchema, createSocialPost } from './tools/create-social-post.js';
import { listSocialPostsSchema, listSocialPosts } from './tools/list-social-posts.js';
import { updateSocialPostSchema, updateSocialPost } from './tools/update-social-post.js';
import { cancelSocialPostSchema, cancelSocialPost } from './tools/cancel-social-post.js';
import { setSocialAccountSchema, setSocialAccount } from './tools/set-social-account.js';
import { listSocialAccountsSchema, listSocialAccounts } from './tools/list-social-accounts.js';
import { listCampaignsSchema, listCampaigns } from './tools/list-campaigns.js';
import { getCampaignSchema, getCampaign } from './tools/get-campaign.js';
import { updateCampaignPostSchema, updateCampaignPost } from './tools/update-campaign-post.js';
import { scheduleCampaignSchema, scheduleCampaign } from './tools/schedule-campaign.js';

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
  'Add a comment to a task or subtask. Shows up in the WorkHub UI read by team members. KEEP IT SHORT: 1-3 sentences stating the outcome or what is needed — no implementation details, file lists, or step-by-step narratives.',
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

// --- Social media scheduler (CoffeePOS + Sikasio campaigns) ---
server.tool(
  'list_scheduled_posts',
  'List the social-media posts in the campaign schedulers (CoffeePOS + Sikasio) with their Facebook/Instagram status. Filter by campaign, platform, status, or timeframe.',
  listScheduledPostsSchema,
  async (args) => listScheduledPosts(args)
);

server.tool(
  'scheduler_status',
  'Dashboard of the social-media schedulers: per-campaign counts (published/scheduled/pending/due/missed) for FB + IG, the next upcoming post, cron health, and last run time.',
  schedulerStatusSchema,
  async (args) => schedulerStatus(args)
);

server.tool(
  'run_scheduler',
  'Trigger a campaign scheduler run now (instead of waiting for cron): schedules due Facebook posts and publishes due Instagram Reels. Use dryRun to preview without posting.',
  runSchedulerSchema,
  async (args) => runScheduler(args)
);

// --- Social posts (any project — drives WorkHub's socialPosts model) ---
server.tool(
  'create_social_post',
  'Create a social media post for any WorkHub project (stored in WorkHub, not files). Provide projectId, platforms (fb/ig), caption, optional mediaUrls + mediaType. If scheduledAt is given it is scheduled, otherwise saved as a draft. Instagram requires media.',
  createSocialPostSchema,
  async (args) => createSocialPost(args)
);

server.tool(
  'list_social_posts',
  "List a project's social posts (or across all projects) with status, platforms, scheduled time, and caption. Filter by project, status, or platform.",
  listSocialPostsSchema,
  async (args) => listSocialPosts(args)
);

server.tool(
  'update_social_post',
  'Edit a social post (caption, media, platforms, or reschedule). Only draft/scheduled/failed posts can be edited.',
  updateSocialPostSchema,
  async (args) => updateSocialPost(args)
);

server.tool(
  'cancel_social_post',
  'Unschedule a social post (move it back to draft), or hardDelete it. Published posts cannot be unscheduled.',
  cancelSocialPostSchema,
  async (args) => cancelSocialPost(args)
);

// --- Per-project Meta accounts ---
server.tool(
  'set_social_account',
  "Configure a project's Meta account (Facebook Page + Instagram + access token) so its social posts publish to its own channels. Stored in socialAccounts/{projectId}; falls back to global env when unset.",
  setSocialAccountSchema,
  async (args) => setSocialAccount(args)
);

server.tool(
  'list_social_accounts',
  'List the per-project Meta accounts configured (Facebook Page, Instagram user, Graph version; token shown masked).',
  listSocialAccountsSchema,
  async () => listSocialAccounts()
);

// --- Campaigns (multi-post social campaigns -> socialPosts) ---
server.tool(
  'list_campaigns',
  'List social-media campaigns (optionally for one project) with status and per-campaign post counts (total + how many scheduled).',
  listCampaignsSchema,
  async (args) => listCampaigns(args)
);

server.tool(
  'get_campaign',
  'Get a campaign with its brief and all its posts (order, status, caption, hashtags, image, scheduled time, and post IDs for editing).',
  getCampaignSchema,
  async (args) => getCampaign(args)
);

server.tool(
  'update_campaign_post',
  'Edit a campaign post (caption, hashtags, imagePrompt, or status: planned/approved/ready). Once a post is scheduled, edit the live post via update_social_post instead.',
  updateCampaignPostSchema,
  async (args) => updateCampaignPost(args)
);

server.tool(
  'schedule_campaign',
  'Schedule a campaign: for every post that has an image and is not yet scheduled, create a scheduled socialPosts entry spaced by the brief cadence, link it back, and advance the campaign status.',
  scheduleCampaignSchema,
  async (args) => scheduleCampaign(args)
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
