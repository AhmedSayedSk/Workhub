# Build from the REPO ROOT so this stage can reach the shared collectors:
#   docker build -f vps-agent/Dockerfile -t vps-agent .
#
# The collectors at src/lib/server/vps/*.ts use extensionless relative
# imports (e.g. `import { collectHost } from './host'`), which plain Node
# ESM cannot resolve. Compiling them to CommonJS sidesteps that: CJS
# `require('./host')` resolves extensionless specifiers natively, and
# Node's ESM loader can still import named exports from the compiled CJS
# (via cjs-module-lexer), so agent.mjs stays a normal ES module.
FROM node:20-alpine AS build
WORKDIR /app

# Only the framework-agnostic collectors — excludes owner.ts (imports
# next/server) and metrics.ts (imports firebase-admin), neither of which
# the agent needs or can resolve outside the Next.js app.
COPY src/lib/server/vps/collect.ts src/lib/server/vps/host.ts src/lib/server/vps/docker.ts src/lib/server/vps/apps.ts src/lib/server/vps/certs.ts src/lib/server/vps/certDomains.ts src/lib/server/vps/security.ts src/lib/server/vps/alerts.ts src/lib/server/vps/types.ts ./src/

RUN npm init -y >/dev/null 2>&1 && \
    npm install --no-save typescript@5 @types/node@20 && \
    npx tsc src/*.ts \
      --outDir out/lib \
      --module commonjs \
      --moduleResolution node \
      --target es2022 \
      --esModuleInterop \
      --skipLibCheck

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/out/lib ./lib
COPY vps-agent/agent.mjs ./agent.mjs
CMD ["node", "agent.mjs"]
