#!/usr/bin/env node

// Guards against the npm Windows-regen lockfile bug (npm/cli#4828, #8320).
//
// When package-lock.json is regenerated from scratch on a non-linux machine
// (rm package-lock.json && npm install on Windows/macOS), npm writes only the
// current platform's resolved entries for platform-specific optional deps
// (biome, rollup, tailwind oxide, esbuild, swc, ...) and silently drops the
// linux ones. The lock looks fine locally but breaks linux CI late with errors
// like "Cannot find module '@biomejs/cli-linux-x64/biome'".
//
// This script fails fast (in CI, before install) if any platform-binary family
// present in the lock lacks its linux variant. Fix: never regenerate the lock
// from scratch on Windows; reconcile in-place from a complete lock
// (git checkout main -- package-lock.json && npm install) or regenerate on Linux.

import { readFileSync } from 'node:fs';

const PLATFORM_RE = /[-/](linux|win32|darwin|freebsd|openbsd|sunos|android)(-[a-z0-9]+)*$/;

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const families = new Map();

for (const [path, meta] of Object.entries(lock.packages ?? {})) {
  if (!Array.isArray(meta.os) || !Array.isArray(meta.cpu)) continue;
  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  if (!PLATFORM_RE.test(name)) continue;
  const base = name.replace(PLATFORM_RE, '');
  const oses = families.get(base) ?? new Set();
  for (const os of meta.os) oses.add(os);
  families.set(base, oses);
}

const offenders = [];
for (const [base, oses] of families) {
  const wantsNonLinux = [...oses].some((os) => !os.startsWith('!') && os !== 'linux');
  if (wantsNonLinux && !oses.has('linux')) {
    offenders.push(base);
  }
}

if (offenders.length > 0) {
  console.error('package-lock.json is missing linux platform binaries for:');
  for (const base of offenders) {
    console.error(`  - ${base}`);
  }
  console.error('');
  console.error('The lockfile was likely regenerated from scratch on a non-linux machine');
  console.error('(npm/cli#4828). Reconcile in-place from a complete lock:');
  console.error('  git checkout main -- package-lock.json && npm install');
  console.error('or regenerate the lockfile on Linux.');
  process.exit(1);
}

console.log(`Lockfile platform check OK (${families.size} platform families, all have linux).`);
