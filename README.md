# AgentMesh

AgentMesh helps teams work with AI on real code together. Everyone shares the same **workspace**: connect your projects, keep context in sync, and let assistants understand your repo the way your team does—without passing files around or repeating the same setup.

## What’s in this repo

| Area | Path | Role |
|------|------|------|
| **Web app** | [`apps/web`](apps/web) | Next.js dashboard, auth, workspaces, indexing, HTTP & admin APIs |
| **Realtime** | [`apps/realtime`](apps/realtime) | WebSocket + internal `/broadcast` for live workspace events |
| **CLI** | [`apps/cli`](apps/cli) | `agentmesh-sync` — push local trees to the cloud |
| **MCP server** | [`packages/mcp-server`](packages/mcp-server) | stdio MCP for agents (`agentmesh_query_context`, etc.) |
| **VS Code** | [`extensions/agentmesh-vscode`](extensions/agentmesh-vscode) | Optional extension (push / sync-on-save) |
| **Protocol / SDK** | [`packages/protocol`](packages/protocol), [`packages/sdk`](packages/sdk) | Shared types and client helpers |
| **Database** | [`prisma`](prisma) | PostgreSQL schema + migrations (pgvector) |

## Requirements

- **Node.js** ≥ 20  
- **PostgreSQL** with **pgvector** (e.g. [Neon](https://neon.tech), or local Docker below)

## Quick start (local)

1. **Clone and install** (from the repo root):

   ```bash
   npm install
   ```

2. **Environment** — copy the example file and edit values (never commit real secrets):

   ```bash
   cp env.example .env
   ```

   Minimum to run locally:

   - `DATABASE_URL` — Postgres connection string (with SSL if your host requires it)  
   - `NEXT_PUBLIC_APP_URL` — e.g. `http://localhost:3000`  
   - `REALTIME_INTERNAL_SECRET` and `REALTIME_BROADCAST_URL` — see [`env.example`](env.example) for dev defaults  

   Optional but common: `GITHUB_CLIENT_*`, `AGENTMESH_OAUTH_SECRET` (production), `OPENAI_API_KEY` or `GEMINI_*` for embeddings, `RESEND_*` for invite email.

3. **Database**:

   ```bash
   npx prisma migrate deploy
   npm run db:seed   # optional demo data
   ```

4. **Dev servers** (web + realtime):

   ```bash
   npm run dev
   ```

   Or web only:

   ```bash
   npm run dev:web
   ```

5. Open **http://localhost:3000**, sign in or register, create a workspace, and follow the onboarding flow (GitHub import, etc.).

### Local Postgres & Redis (Docker)

```bash
docker compose up -d
```

Then set `DATABASE_URL` to something like:

`postgresql://agentmesh:agentmesh@localhost:5432/agentmesh`

Run `npx prisma migrate deploy` (and seed if you like). Optional: `REDIS_URL=redis://localhost:6379` for realtime pub/sub across processes.

## Useful npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Build workspaces deps, then web + realtime in dev mode |
| `npm run dev:web` | Next.js only |
| `npm run build` | Production build (monorepo + Prisma generate + Next build) |
| `npm run db:migrate` | Create/apply migrations in dev (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations in CI/prod (`prisma migrate deploy`) |
| `npm run db:seed` | Seed database |
| `npm run lint` | Lint the web app |

## Documentation

- **In-app developer docs**: run the app and open `/settings/advanced/docs`  
- **Production deploy** (Neon, Vercel, Railway/Fly, realtime, env checklist): [`docs/DEPLOY.md`](docs/DEPLOY.md)  
- **CLI**: [`apps/cli/README.md`](apps/cli/README.md)  
- **VS Code extension**: [`extensions/agentmesh-vscode/README.md`](extensions/agentmesh-vscode/README.md)  
- **MCP package**: [`packages/mcp-server/README.md`](packages/mcp-server/README.md)  

## Security notes

- Keep **`.env` out of git** (see `.gitignore`).  
- Use a strong **`AGENTMESH_OAUTH_SECRET`** (≥16 characters) in any shared/staging/prod environment so OAuth tokens are encrypted at rest.  
- Rotate any API keys that may have been committed or shared by mistake.

## License

See [`LICENSE`](LICENSE) in this repository.
