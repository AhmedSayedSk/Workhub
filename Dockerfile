FROM node:22-bookworm-slim

# Install git (worktree ops) and util-linux (setsid for spawning claude)
RUN apt-get update && apt-get install -y git util-linux && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

EXPOSE 3090
