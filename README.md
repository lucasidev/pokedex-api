# pokedex-api

REST API de una Pokédex personal: autenticación JWT, gestión de pokédex y equipos por usuario, y un proxy cacheado a la [PokeAPI pública](https://pokeapi.co) para datos de pokémons.

## Origen del proyecto

Este proyecto nació como trabajo final de la asignatura **Seminario Informático** de la Tecnicatura Universitaria en Desarrollo y Calidad de Software (UNSTA, 2024). En esa primera versión la API estaba en JavaScript plano, sin tests, con bugs de undeclared vars y un Dockerfile single-stage.

La rama `master` conserva la versión original. La rama `feature/devops-modernization` contiene un rewrite completo que migra el código a TypeScript con arquitectura por capas, suma tests con cobertura, agrega observabilidad (Prometheus metrics + health checks), reemplaza el Dockerfile por uno multi-stage productivo, y monta un pipeline de CI/CD en GitHub Actions con análisis de seguridad (SBOM, SonarCloud, Snyk).

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 22 (ESM) |
| Lenguaje | TypeScript 5.7 strict |
| Framework HTTP | Express 4.21 |
| Base de datos | MongoDB 7 con Mongoose 8 |
| Cache | Redis 7 (opcional, degrada si REDIS_URL no está) |
| Auth | JWT (jsonwebtoken) + bcrypt 12 rounds |
| Validación env | Zod |
| Logger | Pino + pino-http |
| Métricas | prom-client (formato Prometheus) |
| Tests | Jest + Supertest + mongodb-memory-server |
| Lint + format | Biome 1.9 (reemplaza ESLint + Prettier) |
| Git hooks | Lefthook (parallel, stage_fixed) |
| Container | Docker multi-stage, non-root, healthcheck |
| CI | GitHub Actions (quality, docker, sbom, sonarcloud, snyk) |

## Quick start

Necesitás Node 22 y un container runtime (Docker o Podman). El proyecto pinea las versiones del toolchain en `.tool-versions` para [mise](https://mise.jdx.dev) o [asdf](https://asdf-vm.com).

```bash
# Setup inicial (npm install + lefthook install + just doctor)
just setup

# Validar toolchain
just doctor

# Levantar dependencias (Mongo + Redis) en un compose, si lo tenés configurado
# Por ahora pokedex-api espera MONGODB_URI y REDIS_URL accesibles, ajustar .env

# Dev con hot reload
just dev

# Build + start (modo prod)
just build
just start

# Tests
just test
just test-coverage

# Lint + typecheck + tests (gate completo)
just check

# Generar SBOM (CycloneDX)
just sbom
```

Si no tenés `just` instalado, todos los recipes son alias de `npm run *`. Ver `package.json`.

## Variables de entorno

Copiar `.env.example` a `.env` y completar. Las críticas:

| Variable | Default | Notas |
|---|---|---|
| `MONGODB_URI` | (sin default) | Connection string a MongoDB |
| `JWT_SECRET` | (sin default) | Mínimo 32 caracteres (Zod lo enforce) |
| `ADMIN_PASSWORD` | (sin default) | Mínimo 8 caracteres, crea admin al boot |
| `REDIS_URL` | undefined | Opcional. Sin este, el proxy a PokeAPI no cachea |
| `POKEAPI_BASE_URL` | `https://pokeapi.co/api/v2` | Override solo para mocking |
| `POKEAPI_CACHE_TTL_SECONDS` | `3600` | 1 hora por default |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit global a `/api` |
| `RATE_LIMIT_MAX` | `120` | Requests por ventana por IP |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin permitido (frontend dev de Vite) |

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | no | Liveness + readiness. Pinea Mongo y Redis (si está). Status 200 o 503 |
| GET | `/metrics` | no | Métricas Prometheus (HTTP histograms, cache hit/miss, pokeapi latency) |
| GET | `/api` | no | Welcome con metadata del servicio |
| POST | `/api/auth/signup` | no | Body: `{ name, username, email, password, roles? }`. Devuelve `{ token }` |
| POST | `/api/auth/signin` | no | Body: `{ email, password }`. Devuelve `{ token }` |
| GET | `/api/users/using-token` | jwt | Usuario actual del JWT |
| GET | `/api/users` | no | Listado. Devuelve array sin password |
| GET | `/api/users/:id` | no | Usuario por id |
| POST | `/api/users` | jwt + admin | Crear usuario (rol admin requerido) |
| GET | `/api/pokemon/:name` | no | **Proxy con cache a PokeAPI**, devuelve PokemonSummary normalizado |
| GET | `/api/users/pokedex` | jwt | Pokédex del usuario actual |
| PUT | `/api/users/pokedex/catch-pokemon` | jwt | Body: `{ pokemonName }`. Agrega al pokédex |
| PUT | `/api/users/pokedex/release-pokemon` | jwt | Body: `{ pokemonName }`. Quita del pokédex |
| GET | `/api/users/poketeam` | jwt | Equipo del usuario |
| PUT | `/api/users/poketeam/create` | jwt | Body: `{ teamName }` |
| PUT | `/api/users/poketeam/delete` | jwt | Elimina el equipo |
| PUT | `/api/users/poketeam/add-pokemon` | jwt | Body: `{ pokemonName }` |
| PUT | `/api/users/poketeam/remove-pokemon` | jwt | Body: `{ pokemonName }` |

El JWT se envía en header `Authorization: Bearer <token>`. Por compatibilidad con la versión vieja del frontend (UNSTA) también se acepta `x-access-token: <token>`, marcado como deprecated.

## Arquitectura

**Patrón:** Layered Architecture (N-Tier) sobre Express monolítico. Las capas (de fuera hacia adentro) son Routes (wiring HTTP), Controllers (request/response), Services (orquestación, solo donde aplica), Models (Mongoose) y módulos de infraestructura transversal (logger, metrics, db, redis).

**Sistema de organización:** Package by Feature (vertical slices). Cada feature agrupa su controller, routes, models y service en su propio directorio. `shared/` concentra la infraestructura transversal (config, infra, middlewares, utils, metrics) y `system/` los endpoints del API mismo (health, metrics, welcome).

```
src/
├── shared/
│   ├── config/env.ts                       parsing de env vars con Zod, falla rápido al boot
│   ├── types/express.d.ts                  augmentation de Request con userId
│   ├── infra/
│   │   ├── logger.ts                       Pino, pretty en dev, JSON en prod
│   │   ├── database.ts                     mongoose connect / disconnect con logs
│   │   └── redis.ts                        Redis client opcional, isRedisEnabled()
│   ├── middlewares/
│   │   ├── authJwt.ts                      verifyToken (Bearer + x-access-token), isAdmin
│   │   ├── error.ts                        notFoundHandler + errorHandler central
│   │   └── metrics.ts                      instrumenta HTTP requests con histograms
│   ├── utils/
│   │   ├── errors.ts                       AppError + factories (BadRequest, NotFound, etc.)
│   │   ├── asyncHandler.ts                 wrapper que reenvía errores async a next()
│   │   └── initialSetup.ts                 crea roles default y admin al boot
│   └── metrics.ts                          prom-client Registry, counters e histograms
│
├── auth/                                   feature: signup + signin
│   ├── auth.controller.ts
│   └── auth.routes.ts
│
├── users/                                  feature: usuarios + pokedex + poketeam
│   ├── user.model.ts                       schema Mongoose, bcrypt en pre-save
│   ├── role.model.ts                       schema Mongoose, ROLES literal type
│   ├── verifySignUp.middleware.ts          checkExistingUser, checkExistingRole
│   ├── users.controller.ts                 CRUD usuarios + endpoints pokedex y poketeam
│   └── users.routes.ts
│
├── pokemon/                                feature: proxy con cache
│   ├── pokemon.pokeapi.ts                  native fetch a pokeapi.co + métricas + PokeApiError
│   ├── pokemon.service.ts                  cache-aside Redis + fetch a PokeAPI
│   ├── pokemon.controller.ts               GET /api/pokemon/:name
│   └── pokemon.routes.ts
│
├── system/                                 endpoints del API mismo
│   ├── health.service.ts                   checks por dependencia con latencia
│   ├── health.routes.ts                    GET /health
│   ├── metrics.routes.ts                   GET /metrics
│   ├── welcome.controller.ts               GET /api welcome
│   └── welcome.routes.ts
│
├── app.ts                                  Express app sin listen (testable)
└── index.ts                                bootstrap: connect Mongo + Redis + listen + graceful shutdown
```

### Decisión de layering interno por feature

El patrón service-controller-model no es uniforme dentro de cada feature, y es deliberado:

- `pokemon` tiene service layer (`pokemon.service.ts`) porque orquesta dos sistemas externos (PokeAPI HTTP + Redis cache).
- `auth` y `users` saltean services y llaman a Mongoose directo desde el controller. Son CRUD simple sin orquestación.
- `pokemon` no tiene model porque no persistimos pokémons en Mongo. La data vive en PokeAPI y en Redis como cache; los nombres se guardan como strings dentro del `user.model`.
- No hay repositories. Si surge la necesidad de swap del data store o de cachear queries de Mongo, ahí se extrae.

## Observabilidad

### `/metrics`

Formato Prometheus text exposition. Default metrics de Node (process, gc, event loop, heap) más:

- `http_requests_total{method,route,status_code}` counter
- `http_request_duration_seconds` histogram con 11 buckets
- `pokeapi_requests_total{status_code}` counter
- `pokeapi_request_duration_seconds` histogram
- `pokeapi_errors_total{kind}` counter (network, http)
- `cache_hits_total{resource}` counter
- `cache_misses_total{resource}` counter

### `/health`

Devuelve un report con uptime y un array de checks por dependencia, cada uno con `status`, `latencyMs` y `error` opcional. Mongo siempre. Redis si `REDIS_URL` está definido. Status HTTP 200 si todo OK, 503 si alguno falla.

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "checks": [
    { "name": "mongo", "status": "ok", "latencyMs": 8 },
    { "name": "redis", "status": "ok", "latencyMs": 2 }
  ]
}
```

### Logger

Pino estructurado. En desarrollo usa `pino-pretty` para output legible. En producción emite JSON line por línea, listo para ingestar en Loki, ELK o CloudWatch. `pino-http` agrega un log por request con método, status, latencia y request id.

## Container

Dockerfile multi-stage. Stage 1 (build) instala build tools y deps de dev, compila TypeScript, pruna devDependencies. Stage 2 (runtime) parte de un Alpine limpio, copia solo `node_modules` (prod) + `dist` + `package.json`, corre como usuario no root, expone 3000.

Tamaño resultante: ~208 MB.

```bash
docker build -t pokedex-api:dev .
docker run --rm -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/pokedex \
  -e JWT_SECRET=<at-least-32-chars> \
  -e ADMIN_PASSWORD=<at-least-8-chars> \
  pokedex-api:dev
```

El `HEALTHCHECK` corre `wget --spider http://localhost:3000/health` cada 30s. Docker / Kubernetes lo usan para liveness probes.

## CI / CD

GitHub Actions en `.github/workflows/`:

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci.yml` | push master, pull_request | quality (lint + typecheck + test + build) + docker build + SBOM (CycloneDX via syft + grype scan) + SonarCloud + Snyk |
| `pr-title.yml` | pull_request | Valida que el title sea Conventional Commits (importante en Squash merge) |
| `commits.yml` | pull_request | Valida cada commit del PR range con el mismo script que Lefthook commit-msg |
| `docs-links.yml` | push / PR con `**.md` | Lychee link checker sobre archivos markdown |

Secrets requeridos para los jobs opcionales: `SONAR_TOKEN` (SonarCloud) y `SNYK_TOKEN` (Snyk). Sin estos secrets los jobs hacen no-op, no fallan.

Dependabot configurado con política tier-based: framework core (Express, Mongoose, JWT, Zod) ignora majors, test harness (TypeScript, Jest) major manual, devDeps puros auto-merge.

## Tests

20 specs en 5 suites:

| Suite | Specs | Cubre |
|---|---|---|
| `health.test.ts` | 1 | `/health` returns 200 con mongo ok |
| `metrics.test.ts` | 2 | `/metrics` formato Prometheus, http_requests_total se incrementa |
| `auth.test.ts` | 6 | signup happy + missing + duplicate, signin happy + wrong pwd + unknown user |
| `users.test.ts` | 7 | getUserByToken con Bearer + x-access-token, 403 sin token, 401 token inválido, pokedex catch/release |
| `pokemon.test.ts` | 4 | proxy 200, upstream 404, network error, case-insensitive name |

Todos los tests corren contra `mongodb-memory-server` (sin necesidad de Mongo externo). `global.fetch` se spyea para mockear pokeapi.co.

```bash
just test
just test-coverage   # threshold actual: 60% por categoría
```

Estado de cobertura conocido: branches 40% (debajo del threshold), motivado en gaps documentados en `docs/architecture-audit.md`.

## Convenciones

- Commits siguen [Conventional Commits](https://www.conventionalcommits.org). Enforced por Lefthook `commit-msg` + GitHub Action `commits.yml`.
- Branching: Oneflow (`feature/`, `fix/`, `hotfix/`, `release/`). Enforced por `pre-push.mjs`.
- Lint y format: Biome. Single archivo `biome.json`, reemplaza ESLint + Prettier.
- Imports relativos en TS llevan extensión `.js` (requisito de ESM con NodeNext).
- Errores: throw `AppError` (o sus factories). El middleware central lo convierte a JSON consistente. No `res.status().json()` para errores en controllers.

## Autor

Lucas Iriarte ([lucasidev en GitHub](https://github.com/lucasidev), [lucasdiriarte@gmail.com](mailto:lucasdiriarte@gmail.com)).

## Licencia

ISC.
