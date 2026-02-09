const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG = '/tmp/workhub-mcp-debug.log';
fs.writeFileSync(LOG, `=== MCP start.cjs launched at ${new Date().toISOString()} ===\n`);

const serverDir = path.dirname(__filename);
const serverFile = path.join(serverDir, 'dist', 'index.js');

fs.appendFileSync(LOG, `serverDir: ${serverDir}\nserverFile: ${serverFile}\n`);

const child = spawn(process.execPath, [serverFile], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: serverDir,
});

process.stdin.on('data', (chunk) => {
  fs.appendFileSync(LOG, `STDIN (${chunk.length}b): ${chunk.toString().substring(0, 300)}\n`);
  child.stdin.write(chunk);
});
process.stdin.on('end', () => child.stdin.end());

child.stdout.on('data', (chunk) => {
  fs.appendFileSync(LOG, `STDOUT (${chunk.length}b): ${chunk.toString().substring(0, 300)}\n`);
  process.stdout.write(chunk);
});

child.stderr.on('data', (chunk) => {
  fs.appendFileSync(LOG, `STDERR: ${chunk.toString()}\n`);
});

child.on('error', (err) => {
  fs.appendFileSync(LOG, `SPAWN ERROR: ${err.message}\n`);
});

child.on('exit', (code, signal) => {
  fs.appendFileSync(LOG, `EXIT: code=${code} signal=${signal}\n`);
  process.exit(code || 0);
});

process.on('SIGTERM', () => child.kill());
process.on('SIGINT', () => child.kill());
