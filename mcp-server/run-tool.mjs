import { getDb } from './dist/firebase.js';
import { getTaskDetails } from './dist/tools/get-task-details.js';
import { updateTaskStatus } from './dist/tools/update-task-status.js';
import { startTimer } from './dist/tools/start-timer.js';
import { stopTimer } from './dist/tools/stop-timer.js';
import { addTaskComment } from './dist/tools/add-task-comment.js';

const [, , toolName, ...args] = process.argv;

async function run() {
  // Initialize DB
  getDb();

  let result;
  switch (toolName) {
    case 'get_task_details':
      result = await getTaskDetails({ taskId: args[0] });
      break;
    case 'update_task_status':
      result = await updateTaskStatus({ taskId: args[0], status: args[1], comment: args[2] });
      break;
    case 'start_timer':
      result = await startTimer({ projectId: args[0], taskId: args[1] });
      break;
    case 'stop_timer':
      result = await stopTimer({ notes: args[0] });
      break;
    case 'add_task_comment':
      result = await addTaskComment({ taskId: args[0], text: args[1] });
      break;
    default:
      console.error('Unknown tool:', toolName);
      process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
