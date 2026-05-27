#!/usr/bin/env node

// Detecta emojis en comentarios de código fuente en archivos staged.
// Uso: hook de pre-commit (Lefthook, Husky, o directo en .git/hooks/).
//
// Los emojis en comentarios de código dificultan la búsqueda y grep.
// UI strings y documentación están exentos.

import { execSync } from "node:child_process";

const codeExtensions = /\.(ts|tsx|js|jsx|cs|rs|py|go|java|kt|swift)$/;

// Regex para detectar emojis (rango Unicode común)
const emojiRegex =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u;

// Patrones de líneas de comentario por extensión
const commentPatterns = {
  ts: /^\s*\/\/|^\s*\/\*|\*\//,
  tsx: /^\s*\/\/|^\s*\/\*|\*\//,
  js: /^\s*\/\/|^\s*\/\*|\*\//,
  jsx: /^\s*\/\/|^\s*\/\*|\*\//,
  cs: /^\s*\/\/|^\s*\/\*|\*\//,
  rs: /^\s*\/\/|^\s*\/\*|\*\//,
  go: /^\s*\/\/|^\s*\/\*|\*\//,
  java: /^\s*\/\/|^\s*\/\*|\*\//,
  kt: /^\s*\/\/|^\s*\/\*|\*\//,
  swift: /^\s*\/\/|^\s*\/\*|\*\//,
  py: /^\s*#/,
};

let stagedFiles;
try {
  stagedFiles = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf-8",
  })
    .trim()
    .split("\n")
    .filter((f) => codeExtensions.test(f));
} catch {
  process.exit(0);
}

const violations = [];

for (const file of stagedFiles) {
  const ext = file.split(".").pop();
  const commentPattern = commentPatterns[ext];
  if (!commentPattern) continue;

  let content;
  try {
    content = execSync(`git show :${file}`, { encoding: "utf-8" });
  } catch {
    continue;
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (commentPattern.test(lines[i]) && emojiRegex.test(lines[i])) {
      violations.push({ file, line: i + 1 });
    }
  }
}

if (violations.length > 0) {
  console.error("\nCommit rechazado. Se encontraron emojis en comentarios de código:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
  }
  console.error("\nLos emojis en comentarios dificultan la búsqueda. Removerlos.\n");
  process.exit(1);
}
