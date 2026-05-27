#!/usr/bin/env node

// Valida convenciones de branching antes de push.
// Uso: hook de pre-push (Lefthook, Husky, o directo en .git/hooks/).
//
// Convención Oneflow:
//   - Branch principal: main
//   - Ramas permitidas: feature/*, fix/*, hotfix/*, release/*
//   - No se permite push directo a main (solo merge)

import { execSync } from 'node:child_process';

const branch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf-8',
}).trim();

const allowedPrefixes = ['feature/', 'fix/', 'hotfix/', 'release/'];
const protectedBranches = ['main', 'master'];

if (protectedBranches.includes(branch)) {
  console.error(`
Push rechazado. No se permite push directo a '${branch}'.

  Crear una rama con el prefijo correcto:
    git checkout -b feature/mi-feature
    git checkout -b fix/mi-fix
    git checkout -b hotfix/mi-hotfix
`);
  process.exit(1);
}

if (!allowedPrefixes.some((prefix) => branch.startsWith(prefix))) {
  console.error(`
Push rechazado. La rama '${branch}' no sigue la convención de nombres.

  Prefijos permitidos: ${allowedPrefixes.join(', ')}
  Ejemplo: feature/add-login, fix/null-pointer, hotfix/critical-crash
`);
  process.exit(1);
}
