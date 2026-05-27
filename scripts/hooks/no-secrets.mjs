#!/usr/bin/env node

// Detecta credenciales y secrets hardcodeados en archivos staged.
// Uso: hook de pre-commit (Lefthook, Husky, o directo en .git/hooks/).
//
// Busca patrones comunes: API keys, tokens, passwords, connection strings.

import { execSync } from 'node:child_process';

const patterns = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key', regex: /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}/ },
  {
    name: 'Generic API Key',
    regex: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}["']?/i,
  },
  { name: 'Generic Secret', regex: /(?:secret|password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/i },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  // user/password segments cannot contain `$` or `{` without URL-encoding,
  // so excluding them avoids matching template literals like
  // `mongodb://${user}:${pwd}@host`.
  { name: 'Connection String', regex: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"'${}]+:[^\s"'${}]+@/ },
  { name: 'JWT', regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/ },
  { name: 'GitHub Token', regex: /gh[ps]_[A-Za-z0-9_]{36,}/ },
];

// Archivos a ignorar (configuración, lockfiles, etc.)
const ignorePatterns = [
  /\.lock$/,
  /package-lock\.json$/,
  /bun\.lockb$/,
  /\.min\.js$/,
  /\.map$/,
  /node_modules/,
  /\.example$/,
  /\.template$/,
  // Tests usan fixtures con passwords/tokens estáticos que no son secrets reales.
  /^tests\//,
  /\.test\.(ts|js)$/,
  /\.spec\.(ts|js)$/,
];

let stagedFiles;
try {
  stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf-8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
} catch {
  process.exit(0);
}

const violations = [];

for (const file of stagedFiles) {
  if (ignorePatterns.some((p) => p.test(file))) continue;

  let content;
  try {
    content = execSync(`git show :${file}`, { encoding: 'utf-8' });
  } catch {
    continue;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const { name, regex } of patterns) {
      if (regex.test(lines[i])) {
        violations.push({ file, line: i + 1, type: name });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\nCommit rechazado. Se detectaron posibles secrets:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} → ${v.type}`);
  }
  console.error(
    '\nSi es un falso positivo, mover el valor a una variable de entorno o archivo .env.\n',
  );
  process.exit(1);
}
