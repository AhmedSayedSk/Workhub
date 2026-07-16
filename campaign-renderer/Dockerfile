FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /app
COPY campaign-renderer/package.json ./
RUN npm install --omit=dev
COPY campaign-renderer/src ./src
COPY campaign-renderer/templates ./templates
CMD ["node", "src/index.mjs"]
