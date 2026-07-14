# vps-agent

Standalone collect+push agent for a secondary VPS. It runs the exact same
framework-agnostic collectors as WorkHub's own cron (`src/lib/server/vps/*`,
compiled into the image at build time — not forked/copied) and POSTs a
`{ stats, sample }` snapshot to WorkHub every `INTERVAL_MS` (default 60s).

It never talks to Firestore or Next.js — it's a plain Node script that pushes
over HTTP to WorkHub's `/api/vps/report` endpoint, authenticated with a
shared secret header (`x-cron-secret`).

## Deploy (on the secondary server)

1. Rsync this directory to the server:

   ```bash
   rsync -az vps-agent/ user@server:/opt/vps-agent/
   ```

   (The Dockerfile also needs `src/lib/server/vps/` from the repo — either
   rsync the whole repo and build with `-f vps-agent/Dockerfile` from the
   repo root, or rsync just `src/lib/server/vps/` alongside `vps-agent/` at
   `/opt/vps-agent/src/lib/server/vps/` and adjust the build context. Simplest
   is a shallow clone/rsync of the whole repo to `/opt/vps-agent-src/` and
   building from there.)

2. Set up the shared security-status file this agent reads (mirrors server #1):

   ```bash
   mkdir -p /opt/_security
   # populate /opt/_security/status.json the same way server #1 does
   # (see the main repo's security-status cron/script)
   ```

3. Configure secrets:

   ```bash
   cd /opt/vps-agent
   cp .env.example .env
   # fill in WORKHUB_REPORT_URL, INTERNAL_API_TOKEN (same value as WorkHub's
   # /opt/workhub/.env INTERNAL_API_TOKEN), SERVER_ID, INTERVAL_MS
   ```

4. Build and start:

   ```bash
   docker compose -f compose.yml up -d --build
   ```

5. Verify it's pushing:

   ```bash
   docker compose -f compose.yml logs -f vps-agent
   # expect: "[agent] pushed <SERVER_ID> -> 200" every INTERVAL_MS
   ```

## Notes

- `.env` holds the real `INTERNAL_API_TOKEN` — never commit it. Only
  `.env.example` (with a placeholder) is checked in.
- A failed push (WorkHub unreachable, bad token, etc.) is caught and logged;
  it never crashes the loop — the agent just retries on the next tick.
- The `vps-agent-dockerproxy` sidecar is read-only (`POST: 0`) and has no
  published host port; it's reachable only from `vps-agent` on the internal
  `agent_internal` network. `vps-agent` itself also joins the default bridge
  network so it retains outbound internet access to reach WorkHub.
- `DOCKER_PROXY_URL` and `SECURITY_STATUS_PATH` are already wired in
  `compose.yml` to match this setup; override in `.env` only if you deviate
  from it.
