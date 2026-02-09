import { spawn } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';

const LOG = '/tmp/workhub-mcp-debug.log';
writeFileSync(LOG, `=== MCP Debug started at ${new Date().toISOString()} ===\n`);

const child = spawn('node', ['/mnt/d/programming/Upsmart/workhub/mcp-server/dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: '/mnt/d/programming/Upsmart/workhub/mcp-server'
});

// Forward stdin from Claude Code -> child, logging it
process.stdin.on('data', (chunk) => {
  appendFileSync(LOG, `STDIN (${chunk.length} bytes): ${chunk.toString().substring(0, 500)}\n`);
  child.stdin.write(chunk);
});

process.stdin.on('end', () => {
  appendFileSync(LOG, 'STDIN: end\n');
  child.stdin.end();
});

// Forward stdout from child -> Claude Code, logging it
child.stdout.on('data', (chunk) => {
  appendFileSync(LOG, `STDOUT (${chunk.length} bytes): ${chunk.toString().substring(0, 500)}\n`);
  process.stdout.write(chunk);
});

// Log stderr
child.stderr.on('data', (chunk) => {
  appendFileSync(LOG, `STDERR: ${chunk.toString()}\n`);
});

child.on('exit', (code, signal) => {
  appendFileSync(LOG, `EXIT: code=${code} signal=${signal}\n`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  appendFileSync(LOG, `ERROR: ${err.message}\n`);
});

process.on('SIGTERM', () => { child.kill(); });
process.on('SIGINT', () => { child.kill(); });
