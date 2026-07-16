# Campaign Renderer Worker

Containerized worker for rendering campaign videos from images and scenes.

## Deployment

### Naming Convention

All deployments follow the pattern:
- Container name: `<project>-<service>` (e.g., `campaign-renderer-worker`)
- Network name: `<project>_net` (e.g., `campaign-renderer_net`)
- Install path: `/opt/<project>/` (e.g., `/opt/campaign-renderer/`)

### VPS 2 Deployment

1. Clone/pull the repository to VPS 2:
   ```bash
   cd ~/workhub-src
   git pull
   ```

2. Copy campaign-renderer to `/opt/`:
   ```bash
   sudo mkdir -p /opt/campaign-renderer
   sudo cp -r ~/workhub-src/campaign-renderer/* /opt/campaign-renderer/
   ```

3. Create `.env` file from `.env.example`:
   ```bash
   cd /opt/campaign-renderer
   sudo cp .env.example .env
   sudo chmod 600 .env
   # Edit .env with actual values
   ```

4. Build and start the worker:
   ```bash
   cd ~/workhub-src
   docker compose -f campaign-renderer/compose.yml --project-directory /opt/campaign-renderer up -d --build
   ```

The worker will poll `renderJobs` from Firestore and process video rendering requests. No inbound ports are exposed (egress-only).
