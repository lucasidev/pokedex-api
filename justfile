set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]
set dotenv-load := true

container_cmd := env("CONTAINER_CMD", `npx tsx scripts/detect-container.ts`)
compose := container_cmd + " compose"

default:
    @just --list

# ═══════════════════════════════════════════════════════════════
# Setup
# ═══════════════════════════════════════════════════════════════

setup:
    npm install
    npx lefthook install
    just doctor

teardown:
    npx rimraf node_modules dist coverage

doctor:
    npx tsx scripts/doctor.ts

# ═══════════════════════════════════════════════════════════════
# Dev
# ═══════════════════════════════════════════════════════════════

dev: infra-up
    npm run dev

build:
    npm run build

start:
    npm start

# ═══════════════════════════════════════════════════════════════
# Infra (mongo + redis with auto-port detection)
# ═══════════════════════════════════════════════════════════════

# Start mongo + redis. Reuses running containers; finds free host ports
# if the defaults are taken and writes them back into .env so the API,
# mongo shell and redis CLI all agree on the URLs.
infra-up:
    npx tsx scripts/ensure-infra.ts

infra-down:
    {{compose}} down

infra-status:
    {{compose}} ps

infra-logs service="":
    {{compose}} logs -f {{service}}

# Wipe volumes + restart (DESTRUCTIVE for local data).
infra-reset:
    {{compose}} down -v
    just infra-up

container-info:
    @echo "Container runtime: {{container_cmd}}"

# ═══════════════════════════════════════════════════════════════
# Quality
# ═══════════════════════════════════════════════════════════════

lint:
    npx biome check .

lint-fix:
    npx biome check --write .

format:
    npx biome format --write .

typecheck:
    npm run typecheck

test:
    npm test

test-watch:
    npm run test:watch

test-coverage:
    npm run test:coverage

sbom:
    npm run sbom

check: lint typecheck test
