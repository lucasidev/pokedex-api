#!/usr/bin/env node

// Valida que el mensaje de commit siga Conventional Commits.
// Uso: hook de commit-msg (Lefthook, Husky, o directo en .git/hooks/).
//
// Formatos válidos:
//   feat: add user authentication
//   fix(api): handle null response
//   refactor!: restructure auth module
//   docs: update README

import { readFileSync } from "node:fs";

const msgFile = process.argv[2];
if (!msgFile) {
  console.error("Error: no se recibió el archivo de mensaje de commit.");
  process.exit(1);
}

const msg = readFileSync(msgFile, "utf-8").trim();

const pattern =
  /^(feat|fix|refactor|docs|chore|test|style|perf|ci|build|revert)(\(.+\))?!?:\s.+/;

if (!pattern.test(msg)) {
  console.error(`
Commit rechazado. El mensaje no sigue Conventional Commits.

  Recibido:  "${msg}"
  Esperado:  tipo(scope opcional): descripción
  Tipos:     feat | fix | refactor | docs | chore | test | style | perf | ci | build | revert
  Ejemplos:  feat: add login page
             fix(api): handle timeout error
             docs: update installation guide
`);
  process.exit(1);
}
