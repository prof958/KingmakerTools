# kingdomTools

PF2e Kingmaker Adventure Path companion webapp.

## Local development

The dev environment is fully isolated from production: a separate Docker Compose
file, a separate named Docker volume, and local-only `.env` values. Nothing here
can reach or affect the VPS deployment (see `docs/DEPLOY.md` for that side).

**First-time setup:**

```bash
cp .env.example .env
npm install
npm run dev:setup   # starts the dev database and applies migrations
npm run dev
```

Then open <http://localhost:3000> and log in with `kingmaker` (the fallback dev
password — see `APP_PASSWORD_HASH` in `.env.example` if you want a different one).

**Day to day:**

```bash
npm run dev          # Next.js dev server
npm test             # Vitest
npm run db:studio    # browse the dev database
```

**Database lifecycle** (`docker-compose.dev.yml`, a local-only Postgres container):

| Command | Effect |
|---|---|
| `npm run db:up` | Start the dev database (idempotent; waits for it to be healthy) |
| `npm run db:down` | Stop it, keeping data |
| `npm run db:migrate` | Apply/create Prisma migrations against it |
| `npm run db:seed` | Load the item/structure seed data |
| `npm run db:reset` | Wipe the dev volume and start clean |

### Why this can't touch production

- **Different compose file.** Production is deployed with a plain
  `docker compose up -d`, which only ever reads `docker-compose.yml`. The dev
  database lives in `docker-compose.dev.yml` — a different filename that command
  never picks up, by construction, not by convention.
- **Different data volume.** Prod uses a bind mount to a path on the VPS
  (`/opt/kingdomtools/pgdata`); dev uses a named Docker volume
  (`kingdomtools_dev_pgdata`) that only exists inside Docker's own storage on
  your machine. There's no path in common for a mistake to collide on.
- **`.env` never leaves your machine.** It's git-ignored (`.gitignore`), and the
  dev compose file doesn't even read it — see the comment at the top of
  `docker-compose.dev.yml` for why. Production's real secrets live only in the
  VPS's own environment, injected by Coolify/the deploy compose stack; they are
  never written into this repo in any form.
- **Bound to localhost.** The dev Postgres container only accepts connections
  from `127.0.0.1` — it isn't reachable from the network at all, let alone from
  the VPS.

Commit and push as normal; none of the files above carry any credential or
connection info that points at the real database.
