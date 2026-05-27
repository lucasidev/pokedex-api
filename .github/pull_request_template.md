<!--
PR title sigue Conventional Commits. Con Squash merge, el title se vuelve el commit en master.

  Formato: <type>(<scope>): <descripción imperativa en minúscula>
  Types:   feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
-->

## Resumen

<!-- 1-3 oraciones explicando qué cambia y por qué. -->

## Cambios principales

<!-- Bullets concretos. Si tu cambio toca varias capas, agrupá por capa. -->

-

## Tests

- [ ] Unit / integration tests del cambio
- [ ] Manual e2e (`just dev` + curl/Postman)
- [ ] No aplica (docs / config / cosmético)

## Pre-merge checklist

- [ ] CI verde (lint, typecheck, test, build, docker, sbom)
- [ ] `just ci` pasa localmente
- [ ] Conventional Commit format en cada commit
- [ ] No commiteé secrets, archivos de IDE, ni `.env`
