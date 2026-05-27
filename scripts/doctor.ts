#!/usr/bin/env node
/**
 * doctor.ts - validate pokedex-api toolchain against .tool-versions pins.
 *
 * Runs node, lefthook, and container runtime checks. Reports drift via
 * exit code: 0 if OK or only warnings, 1 if any tool is missing or older.
 *
 * Usage: npx tsx scripts/doctor.ts  (or just doctor)
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Severity = 'ok' | 'warn' | 'fail';

type Check = {
  tool: string;
  required: string;
  found: string | null;
  severity: Severity;
  hint?: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOOL_VERSIONS_PATH = join(ROOT, '.tool-versions');

function readToolVersions(): Map<string, string> {
  if (!existsSync(TOOL_VERSIONS_PATH)) {
    console.error('No .tool-versions found at repo root.');
    process.exit(1);
  }
  const map = new Map<string, string>();
  for (const line of readFileSync(TOOL_VERSIONS_PATH, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [tool, version] = trimmed.split(/\s+/);
    if (tool && version) map.set(tool, version);
  }
  return map;
}

function tryRun(cmd: string, timeoutMs = 5000): string | null {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: timeoutMs,
    }).trim();
  } catch {
    return null;
  }
}

function compareSemver(
  found: string,
  required: string,
): 'match' | 'patch-newer' | 'minor-newer' | 'major-newer' | 'older' | 'incomparable' {
  const f = found.match(/(\d+)\.(\d+)\.(\d+)/);
  const r = required.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!f || !r) return 'incomparable';

  const fMaj = Number(f[1]);
  const fMin = Number(f[2]);
  const fPat = Number(f[3]);
  const rMaj = Number(r[1]);
  const rMin = Number(r[2]);
  const rPat = Number(r[3]);

  if (fMaj !== rMaj) return fMaj > rMaj ? 'major-newer' : 'older';
  if (fMin !== rMin) return fMin > rMin ? 'minor-newer' : 'older';
  if (fPat !== rPat) return fPat > rPat ? 'patch-newer' : 'older';
  return 'match';
}

function checkTool(tool: string, versionCmd: string, required: string, installHint: string): Check {
  const raw = tryRun(versionCmd);
  if (!raw) {
    return { tool, required, found: null, severity: 'fail', hint: `not installed. ${installHint}` };
  }

  const cmp = compareSemver(raw, required);
  if (cmp === 'match' || cmp === 'patch-newer') {
    return { tool, required, found: raw, severity: 'ok' };
  }
  if (cmp === 'minor-newer' || cmp === 'major-newer') {
    return {
      tool,
      required,
      found: raw,
      severity: 'warn',
      hint: `installed newer than pin (${cmp}). If intentional, bump .tool-versions.`,
    };
  }
  if (cmp === 'older') {
    return {
      tool,
      required,
      found: raw,
      severity: 'fail',
      hint: `installed older than pin. ${installHint}`,
    };
  }
  return { tool, required, found: raw, severity: 'warn', hint: 'version format unrecognized' };
}

function checkContainerRuntime(): Check {
  const podman = tryRun('podman --version');
  const docker = tryRun('docker --version');
  if (podman) {
    return {
      tool: 'container runtime',
      required: 'podman or docker',
      found: `podman (${podman})`,
      severity: 'ok',
    };
  }
  if (docker) {
    const info = tryRun('docker info');
    if (info) {
      return {
        tool: 'container runtime',
        required: 'podman or docker',
        found: `docker (${docker})`,
        severity: 'ok',
      };
    }
    return {
      tool: 'container runtime',
      required: 'podman or docker (daemon running)',
      found: 'docker installed but daemon unreachable',
      severity: 'fail',
      hint: 'start Docker Desktop or switch to podman',
    };
  }
  return {
    tool: 'container runtime',
    required: 'podman or docker',
    found: null,
    severity: 'fail',
    hint: 'install podman (preferred) or docker: needed for local infra (mongo, redis, prometheus, grafana)',
  };
}

function emoji(severity: Severity): string {
  return severity === 'ok' ? '✓' : severity === 'warn' ? '⚠' : '✗';
}

function color(severity: Severity, text: string): string {
  if (!process.stdout.isTTY) return text;
  const codes = { ok: '\x1b[32m', warn: '\x1b[33m', fail: '\x1b[31m' };
  return `${codes[severity]}${text}\x1b[0m`;
}

function format(check: Check): string {
  const icon = color(check.severity, emoji(check.severity));
  const found = check.found ?? 'NOT FOUND';
  const head = `${icon} ${check.tool.padEnd(20)} ${found.padEnd(22)} (required: ${check.required})`;
  return check.hint ? `${head}\n  ${color(check.severity, '↳')} ${check.hint}` : head;
}

function main(): void {
  const pins = readToolVersions();

  process.stdout.write('pokedex-api doctor: toolchain check\n\n');

  const checks: Check[] = [
    checkTool(
      'node',
      'node --version',
      pins.get('node') ?? '22.0.0',
      'install via mise / asdf / nvm',
    ),
    checkTool(
      'lefthook',
      'lefthook version',
      pins.get('lefthook') ?? '1.0.0',
      'comes with `npm install` (devDependency)',
    ),
    checkContainerRuntime(),
  ];

  for (const c of checks) process.stdout.write(`${format(c)}\n`);

  const failures = checks.filter((c) => c.severity === 'fail').length;
  const warnings = checks.filter((c) => c.severity === 'warn').length;
  process.stdout.write('\n');

  if (failures > 0) {
    process.stdout.write(
      color(
        'fail',
        `✗ ${failures} fatal issue(s). Fix above before running just dev / just test.\n`,
      ),
    );
    process.exit(1);
  }
  if (warnings > 0) {
    process.stdout.write(
      color('warn', `⚠ ${warnings} warning(s). Tools functional but drift from pins: review.\n`),
    );
  } else {
    process.stdout.write(color('ok', '✓ Toolchain OK. Ready to dev.\n'));
  }
}

main();
