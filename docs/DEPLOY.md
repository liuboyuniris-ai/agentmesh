# Deploy: Neon + Vercel (web) + Railway or Fly (realtime)

Goal: a public Next.js app, Postgres on Neon, and a separate **realtime** service for collaboration pushes. Redis (e.g. Upstash) is optional—only if you set `REDIS_URL` on realtime.

---

## 0. Neon

1. Create a project and use the **Serverless / pooled** connection string as `DATABASE_URL` (better for serverless web and connection limits).
2. Apply schema either on the **first successful production build** (below) or once locally:  
   `npx prisma migrate deploy`

---

## 1. Vercel (`apps/web`)

### Connect the Git repo

1. [Vercel](https://vercel.com) → New Project → import this repository.
2. **Root Directory**: `apps/web`  
   (keeps Next.js, `next.config.js`, and assets correct.)
3. **Framework Preset**: Next.js (auto-detected).

### Install & build commands

`apps/web/vercel.json` installs from the **repo root** and builds the whole monorepo (protocol/sdk workspaces), and runs migrations during build:

- **Install command**: `cd ../.. && npm ci`
- **Build command**: `cd ../.. && npx prisma migrate deploy && npm run build`

If you prefer migrations outside the build (e.g. CI runs `migrate deploy`), set the Vercel build command to  
`cd ../.. && npm run build` and run `migrate deploy` on Neon before first release.

If **Preview** and **Production** share one `DATABASE_URL`, every PR build runs `migrate deploy` (usually fine). For isolation, give Preview a Neon branch database and a different `DATABASE_URL` in Vercel Preview env.

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** URL (Production + Preview as needed) |
| `NEXT_PUBLIC_APP_URL` | Public site origin, no trailing slash, e.g. `https://xxx.vercel.app` or your domain |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth; callback `{NEXT_PUBLIC_APP_URL}/api/auth/github/callback` |
| `AGENTMESH_OAUTH_SECRET` | Random string, **≥16 chars** (encrypts stored OAuth tokens) |
| `REALTIME_INTERNAL_SECRET` | **Identical** on the realtime service |
| `REALTIME_BROADCAST_URL` | `https://<your-realtime-public-host>/broadcast` (after Railway/Fly) |
| Others | Copy from local `.env` as needed (`RESEND_*`, embedding `OPENAI_API_KEY` / Gemini, OIDC, etc.) |

**Do not** set in production: `DEV_USER_ID`, `NEXT_PUBLIC_DEV_USER_ID`.

Save variables and **Redeploy**. Open:

- `https://<your-domain>/api/auth/github/oauth-debug`  
  and confirm `redirect_uri` matches the GitHub OAuth App.

---

## 2. Realtime: Railway (recommended; includes `railway.toml`)

1. [Railway](https://railway.app) → New Project → **Deploy from GitHub repo** → select this repo.
2. **Root Directory**: repo root `.` (where `railway.toml` lives).
3. Railway should read root `railway.toml`: after install, `npx prisma generate`, start `npm run start -w realtime`.
4. Service → **Variables**: add  
   - `DATABASE_URL` (same Neon as web is fine)  
   - `REALTIME_INTERNAL_SECRET` (**exactly** the same as on Vercel)  
   - optional: `REDIS_URL` (Upstash)
5. **Networking**: enable **Public URL** and note the HTTPS host, e.g. `https://agentmesh-realtime-production.up.railway.app`.
6. Back on Vercel set:  
   `REALTIME_BROADCAST_URL=https://<public-host>/broadcast`  
   (path must end with **`/broadcast`**, see [`broadcast.ts`](apps/web/lib/realtime/broadcast.ts).)
7. Redeploy web. Health check: `https://<public-host>/health` should return `ok`.

---

## 3. Realtime: Fly.io (optional)

For Fly accounts and scale-to-zero machines.

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. Edit root `fly.realtime.toml` and replace `app = "agentmesh-realtime-replace-me"` with your app name (`fly apps create`).
3. `fly secrets set DATABASE_URL=... REALTIME_INTERNAL_SECRET=...` (same Neon and secret as Vercel).
4. From repo root:  
   `fly deploy --config fly.realtime.toml`  
   using root `Dockerfile.realtime`.
5. Put Fly’s HTTPS hostname in Vercel `REALTIME_BROADCAST_URL` as `https://<host>/broadcast`.

---

## 4. Redis (optional)

Set `REDIS_URL` on **realtime** only when you run multiple realtime instances or need consistent cross-process pub/sub. The web app does **not** need `REDIS_URL`.

---

## 5. Checklist

- [ ] Neon: `prisma migrate deploy` succeeded (in build or manually).
- [ ] Vercel: `NEXT_PUBLIC_APP_URL` matches the browser URL; HTTPS works.
- [ ] GitHub OAuth callback matches `oauth-debug` `redirect_uri`.
- [ ] Same `REALTIME_INTERNAL_SECRET` on Vercel and realtime; `REALTIME_BROADCAST_URL` is `https://…/broadcast`.
- [ ] Realtime: `GET /health` returns 200.

---

## 6. Troubleshooting

**Build fails on Prisma / DB**  
Ensure Vercel has `DATABASE_URL` for **Build**. If Neon restricts IPs, allow Vercel or use Neon’s recommended serverless access.

**OAuth redirect_uri mismatch**  
`NEXT_PUBLIC_APP_URL` must match the site you open; GitHub callback must be `https://<that-host>/api/auth/github/callback`.

**Collaboration not live**  
Check `REALTIME_INTERNAL_SECRET` matches both sides, `REALTIME_BROADCAST_URL` uses `https` and path `/broadcast`, and realtime is reachable from the public internet.
