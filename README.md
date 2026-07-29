# gzavnili-next

Next.js rewrite of gzavnili.com. See `../docs/` (in the parent legacy repo, one level up)
for the full migration plan, current-state audit, and target architecture — this project
is the Phase 2+ implementation target described there.

## Local development

Runtime: [bun](https://bun.sh). Infra dependencies (Postgres, and later Redis if needed)
run in Docker locally.

```bash
docker compose up -d      # starts local Postgres (see docker-compose.yml)
cp .env.example .env      # DATABASE_URL points at the docker-compose Postgres by default
bun install
bun dev                   # http://localhost:3000
```

## Production

- App runtime: managed via HestiaCP's Node.js app proxy (reverse-proxied), not Docker.
- Database: intended to run directly on the host (not containerized) — see `.env` on the
  server for the actual `DATABASE_URL`.
- Any additional infra (Redis, queues, etc.) — containerized on the host if/when introduced,
  same as local dev.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS
- Postgres
- Package manager / runtime: bun
