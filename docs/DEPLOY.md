# 部署：Neon + Vercel（Web）+ Railway 或 Fly（Realtime）

目标：公网可访问 Next 应用、Postgres 用 Neon、协作推送用独立 **realtime** 服务。Redis（Upstash 等）可选，仅在你给 realtime 配了 `REDIS_URL` 时需要。

---

## 0. Neon

1. 创建项目，使用 **Serverless / Pooled** 连接串作为 `DATABASE_URL`（适合 Vercel 无状态函数、连接数更稳）。
2. 首次部署数据库结构在 **第一次能上线的构建** 里执行（见下）；或本机执行一次：  
   `npx prisma migrate deploy`

---

## 1. Vercel（`apps/web`）

### 连接 Git 仓库

1. [Vercel](https://vercel.com) → New Project → 导入本仓库。
2. **Root Directory** 设为：`apps/web`  
   （使 Next.js、 `next.config.js`、静态资源路径正确。）
3. **Framework Preset** 选 Next.js（应自动识别）。

### 覆盖安装与构建命令

`apps/web/vercel.json` 已配置为在**仓库根**安装并构建整个 monorepo（含 protocol/sdk 等 workspace），并在构建时**执行迁移**：

- **Install command**：`cd ../.. && npm ci`
- **Build command**：`cd ../.. && npx prisma migrate deploy && npm run build`

若你更希望迁移与构建分离（例如用单独 CI 跑 `migrate deploy`），可在 Vercel 项目设置里把 Build Command 改成：  
`cd ../.. && npm run build`，并自行在首次发布前对 Neon 执行迁移。

若你让 **Preview** 与 **Production** 共用同一 `DATABASE_URL`，每次 PR 构建都会跑 `migrate deploy`（一般可接受）；若希望隔离，可为 Preview 单独建 Neon 分支数据库并在 Vercel 为 Preview 环境配置另一 `DATABASE_URL`。

### 环境变量（Vercel → Project → Settings → Environment Variables）

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Neon **pooled** 连接串（Production + Preview 按需） |
| `NEXT_PUBLIC_APP_URL` | 生产站点根 URL，无尾斜杠，如 `https://xxx.vercel.app` 或自定义域 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth；回调填 `{NEXT_PUBLIC_APP_URL}/api/auth/github/callback` |
| `AGENTMESH_OAUTH_SECRET` | 随机串，**至少 16 字符**（加密存储 OAuth token） |
| `REALTIME_INTERNAL_SECRET` | 与 realtime 服务**完全相同**的密钥 |
| `REALTIME_BROADCAST_URL` | `https://<你的-realtime-公网域名>/broadcast`（Railway / Fly 生成后填写） |
| 其余 | 复制你本地 `.env` 里已在用的项（邮件 `RESEND_*`、嵌入 `OPENAI_API_KEY` / Gemini、OIDC 等） |

**不要**在生产环境设置：`DEV_USER_ID`、`NEXT_PUBLIC_DEV_USER_ID`。

保存变量后重新 **Deploy**。用浏览器打开：

- `https://<你的域名>/api/auth/github/oauth-debug`  
  核对 `redirect_uri` 与 GitHub OAuth App 里是否一致。

---

## 2. Realtime：Railway（推荐，已带 `railway.toml`）

1. [Railway](https://railway.app) → New Project → **Deploy from GitHub repo** → 选本仓库。
2. **Root Directory**：仓库根 `.`（与 `railway.toml` 所在目录一致）。
3. Railway 应读取根目录 `railway.toml`：在安装依赖后执行 `prisma generate`，启动 `npm run start -w realtime`。
4. 在 Service → **Variables** 添加：
   - `DATABASE_URL`（可与 Neon 同源）
   - `REALTIME_INTERNAL_SECRET`（与 Vercel **字节级相同**）
   - 可选：`REDIS_URL`（Upstash Redis）
5. **Networking**：为服务启用 **Public URL**，记下 HTTPS 根地址，例如 `https://agentmesh-realtime-production.up.railway.app`。
6. 回到 Vercel，设置：  
   `REALTIME_BROADCAST_URL=https://<public-host>/broadcast`  
   （末尾必须是 **`/broadcast`**，与 [`broadcast.ts`](apps/web/lib/realtime/broadcast.ts) 一致。）
7. 重新部署 Web。健康检查：`https://<public-host>/health` 应返回 `ok`。

---

## 3. Realtime：Fly.io（可选）

适合已有 Fly 账号、希望机器按需休眠的场景。

1. 安装 [flyctl](https://fly.io/docs/hands-on/install-flyctl/)。
2. 编辑根目录 `fly.realtime.toml`，把 `app = "agentmesh-realtime-replace-me"` 换成你的应用名（`fly apps create` 创建）。
3. `fly secrets set DATABASE_URL=... REALTIME_INTERNAL_SECRET=...`（可与 Vercel 相同 Neon库、与 Vercel 相同 secret）。
4. 在项目根执行：  
   `fly deploy --config fly.realtime.toml`  
   使用根目录 `Dockerfile.realtime`。
5. 将 Fly 分配的 HTTPS 主机同样填入 Vercel 的 `REALTIME_BROADCAST_URL`（`https://<host>/broadcast`）。

---

## 4. Redis（可选）

仅当 realtime 多实例或你希望跨进程广播一致时，给 **realtime** 进程设置 `REDIS_URL`（如 Upstash）。Web 进程**不需要** `REDIS_URL`。

---

## 5. 自检清单

- [ ] Neon：`prisma migrate deploy` 已成功（构建内或手动）。
- [ ] Vercel：`NEXT_PUBLIC_APP_URL` 为最终浏览器地址；HTTPS 正常。
- [ ] GitHub OAuth 回调与 `oauth-debug` 中 `redirect_uri` 一致。
- [ ] Vercel 与 Realtime 上 `REALTIME_INTERNAL_SECRET` 一致；`REALTIME_BROADCAST_URL` 指向 `https://…/broadcast`。
- [ ] Realtime：`GET /health` 为 200。

---

## 6. 常见问题

**构建报 Prisma / DB 错**  
确认 Vercel 的 `DATABASE_URL` 已在 **Build** 环境可用；Neon 防火墙若限制 IP，需允许 Vercel（或使用 Neon 无 IP 限制的配置）。

**OAuth redirect_uri mismatch**  
`NEXT_PUBLIC_APP_URL` 必须与当前访问域名一致；GitHub OAuth App 的回调必须包含 `https://该域名/api/auth/github/callback`。

**协作不实时**  
检查 `REALTIME_INTERNAL_SECRET` 两边是否一致、`REALTIME_BROADCAST_URL` 是否带 `https` 且路径为 `/broadcast`、realtime 公网是否可达。
