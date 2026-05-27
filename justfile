set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default:
    @just --list

setup:
    npm install
    npx lefthook install
    just doctor

teardown:
    npx rimraf node_modules dist coverage

doctor:
    npx tsx scripts/doctor.ts

dev:
    npm run dev

build:
    npm run build

start:
    npm start

lint:
    npx biome check .

lint-fix:
    npx biome check --write .

format:
    npx biome format --write .

typecheck:
    npx tsc -p tsconfig.json --noEmit

test:
    npm test

test-watch:
    npm run test:watch

test-coverage:
    npm run test:coverage

sbom:
    npm run sbom

check: lint typecheck test
