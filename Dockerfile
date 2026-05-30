# syntax=docker/dockerfile:1.7
# Multi-stage build for pokedex-api.
# - build stage installs all deps and compiles TS -> JS in dist/
# - runtime stage carries only production deps and the compiled output
# - non-root user, healthcheck on /health, EXPOSE 3000

# ─── Stage 1: build ──────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Native modules (bcrypt) need a toolchain to compile.
RUN apk add --no-cache python3 make g++

# Lockfile first so the install layer is reused while source changes.
COPY package.json package-lock.json ./

# Two layers of mismatch with a local Windows install:
#   1. The lockfile is generated on Windows and omits Linux-only optional deps
#      (socks, ajv platform variants), so npm ci rejects it. npm install
#      reconciles the tree at the cost of being a few seconds slower.
#   2. The prepare script (lefthook install) needs .git/ which is dockerignored.
#      --ignore-scripts skips lifecycle scripts; npm rebuild then runs only the
#      install/postinstall scripts that compile native modules (bcrypt).
RUN npm install --no-audit --no-fund --ignore-scripts && npm rebuild bcrypt

# Source and TS config required to build.
COPY tsconfig.json tsconfig.scripts.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

# ─── Stage 2: runtime ────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# wget is in alpine baseline and lets the healthcheck hit /health without curl.
RUN addgroup -S app && adduser -S app -G app

# Copy production deps and compiled output from the build stage.
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./package.json

USER app

EXPOSE 3000

# Standardized across the project: interval 10s, timeout 5s, 5 retries,
# 15s grace. /health probes mongo + redis (readiness), so the orchestrator
# only routes traffic once dependencies are reachable.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
