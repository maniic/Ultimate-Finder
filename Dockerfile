# Two targets from one file:
#   dev   is what `docker compose up` runs on your laptop (live reload)
#   prod  is what the server builds and deploys. It must stay the LAST stage,
#         because the server runs a plain `docker build` that builds the last one.

FROM node:24-alpine AS base
WORKDIR /app
# Prisma's update checks and telemetry need internet, and the server has none.
ENV PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma.config.ts ./
COPY prisma/ ./prisma/
RUN npx prisma generate

# ---- dev (compose.yaml mounts src/, public/ and prisma/ over these) ----
FROM base AS dev
ENV NODE_ENV=development PORT=3000
EXPOSE 3000
# Apply any new migrations from teammates, regenerate the client, start with reload.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && node --watch src/server.js"]

# ---- prod (what the server deploys) ----
FROM base AS prod
COPY src/ ./src/
COPY public/ ./public/
# Read-only filesystem on the server: anything npm/Prisma writes goes to /tmp.
ENV NODE_ENV=production PORT=3000 HOME=/tmp npm_config_cache=/tmp/.npm
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
