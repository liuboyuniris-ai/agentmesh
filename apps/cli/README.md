# agentmesh-sync

CLI to push a local project tree to an AgentMesh Workspace (HTTP `projects/local`).

Current version: **0.3.1**

## Install

### In your application repo (recommended when published to npm)

```bash
npm i -D agentmesh-sync@0.3.1
```

### From this monorepo

```bash
cd /path/to/multiagent
npm exec -w agentmesh-sync -- agentmesh-sync push
```

## Configure

**Option A — root `.agentmesh.json` + env (no secrets in Git):**

```json
{
  "apiBaseUrl": "https://your-agentmesh.example",
  "workspaceId": "cl…"
}
```

```bash
export AGENTMESH_TOKEN="your-context-token"
```

**Option B — `init` (writes `.agentmesh.json`; optional `--token` or `AGENTMESH_TOKEN`):**

```bash
npx agentmesh-sync init --workspace-id <id> [--api-base-url <url>] [--token <context-token>]
```

**Option C — `connect` helper (writes `.agentmesh/sync.json` with token; add to `.gitignore`):**

```bash
npx agentmesh-sync connect --workspace-id <id> --token <token> [--api-base-url <url>]
```

Use the Workspace 控制台复制的 **Context Token** 作为 `AGENTMESH_TOKEN` / `Authorization: Bearer …`（MCP 与 CLI `push` 同一令牌；勿提交到 Git）。

## Commands

| Command | Purpose |
|--------|---------|
| `agentmesh-sync init` | Write `.agentmesh.json` (+ `.agentmesh/sync.json` if token provided) |
| `agentmesh-sync push` | Full scan (≤120 text files) and upload; saves `projectId` for next push |
| `agentmesh-sync watch` | Debounced full re-upload on file changes (needs `projectId` after first `push`) |

## Git hook

See repository `scripts/git-hooks/pre-push.sample`: copy to `.git/hooks/pre-push` so `git push` can run `agentmesh-sync push` first (optional).
