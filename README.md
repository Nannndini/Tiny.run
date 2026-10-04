# Tiny.run

Full-stack URL shortener with real-time click analytics, QR codes, geo-location, Redis caching, rate limiting, and link expiration.

This repository is an npm workspaces monorepo:

- `apps/web` — Next.js App Router frontend
- `apps/api` — Express + Prisma backend
- `packages/shared` — shared TypeScript types

Phase 1 is foundation only. Product features such as short URLs, analytics, and QR codes are not implemented yet.

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- Docker Desktop (for PostgreSQL and Redis)

## Install

From the repository root:

```bash
npm install
copy .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead of `copy`.

Edit `.env` and replace the database placeholders. If you use the included Docker Compose file, these values match the containers:

```bash
DATABASE_URL=postgresql://tiny:tiny@localhost:5432/tinyrun
REDIS_URL=redis://localhost:6379
PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Do not put server secrets in `NEXT_PUBLIC_*` variables. Those are exposed to the browser.

## Start PostgreSQL and Redis

```bash
docker compose up -d
```

Generate the Prisma client:

```bash
npm run db:generate
```

There are no database models yet, so you do not need a migration for Phase 1. When models are added in a later phase, run:

```bash
npm run db:migrate
```

That migrate command reads `DATABASE_URL` from the root `.env` file.

## Start the apps

In two terminals, from the repository root:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

- Web: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:4000/health](http://localhost:4000/health)

The health endpoint returns JSON:

```json
{"status":"ok","service":"tiny.run-api"}
```

## Lint, typecheck, and test

```bash
npm run lint
npm run typecheck
npm test
```

`npm test` currently runs the API Vitest suite, including `GET /health`.

## Build

```bash
npm run build
```

## License

MIT. See [LICENSE](LICENSE).
