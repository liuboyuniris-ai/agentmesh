"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  /** 若提供，curl/MCP 示例中代入该 ID；否则用占位符 */
  workspaceId?: string | null;
  compact?: boolean;
};

export function PlatformIntegrationCards({ workspaceId, compact }: Props) {
  const [origin, setOrigin] = useState(
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  );
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const ws = workspaceId?.trim() || "YOUR_WORKSPACE_ID";
  const tokenPh = "YOUR_CONTEXT_TOKEN";

  const httpCurl = `curl -sS -X POST "${origin}/api/workspaces/${ws}/context/query" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPh}" \\
  -d '{"query":"authentication and API routes","top_k":5}'`;

  const cliBlock = `# 在本机设置 Token（与控制台「复制 Token」一致）
export AGENTMESH_TOKEN="${tokenPh}"

# 方式 A：本仓库 monorepo 根目录
cd /path/to/multiagent && npm exec -w agentmesh-sync -- agentmesh-sync push

# 方式 B：你的应用仓库
# npm i -D agentmesh-sync@0.3.1 && npx agentmesh-sync init --workspace-id ${ws} --api-base-url ${origin} && npx agentmesh-sync push`;

  const mcpJson = `{
  "mcpServers": {
    "agentmesh": {
      "command": "npx",
      "args": ["-y", "@agentmesh/mcp-server"],
      "env": {
        "AGENTMESH_API_BASE_URL": "${origin}",
        "AGENTMESH_WORKSPACE_ID": "${ws}",
        "AGENTMESH_TOKEN": "${tokenPh}"
      }
    }
  }
}`;

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setCopied("err");
    }
  }, []);

  const gridClass = compact
    ? "grid gap-4 md:grid-cols-1"
    : "grid gap-4 lg:grid-cols-3";

  return (
    <section className="space-y-3">
      {!compact ? (
        <div>
          <h2 className="text-sm font-medium text-emerald-400">三种入口：CLI · MCP · HTTP（与编辑器无关）</h2>
          <p className="mt-1 text-xs text-zinc-600">
            <strong className="font-medium text-zinc-500">CLI</strong> 把本机代码<strong className="font-medium text-zinc-500">
              推进云
            </strong>
            并更新索引；<strong className="font-medium text-zinc-500">MCP / HTTP</strong> 在 Agent 或脚本里<strong className="font-medium text-zinc-500">
              查已进 Workspace
            </strong>
            的语义索引（需对方/自己已同步）。
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            任意 Agent 与脚本：把代码同步进 Workspace 后，用 CLI 推送、用 MCP 在对话里读共享上下文、或用
            HTTP 自行集成。将 <code className="rounded bg-zinc-900 px-1">{tokenPh}</code>{" "}
            换成 Workspace 页面复制的 Context Token（与{" "}
            <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code> 相同）。将{" "}
            <code className="rounded bg-zinc-900 px-1">YOUR_WORKSPACE_ID</code>{" "}
            换成当前 Workspace id（若未自动填入）。
          </p>
        </div>
      ) : null}
      <div className={gridClass}>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300">用 CLI 推送</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            安装：<code className="rounded bg-zinc-900 px-1">npm i -D agentmesh-sync@0.3.1</code>
            （或在本 monorepo 使用 <code className="rounded bg-zinc-900 px-1">npm exec -w agentmesh-sync</code>
            ）。根目录放置 <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code> +{" "}
            <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code>。
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-400">
            {cliBlock}
          </pre>
          <button
            type="button"
            className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
            onClick={() => void copy("cli", cliBlock)}
          >
            {copied === "cli" ? "已复制" : "复制 CLI 说明"}
          </button>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300">MCP（标准 Agent 读上下文）</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            <strong className="font-medium text-zinc-500">默认推荐路径</strong>：把下列 JSON 合并进任意支持
            MCP 的宿主（Claude Code、Codex、Cursor、Windsurf、自研运行时等）。工具包含{" "}
            <code className="rounded bg-zinc-900 px-1">agentmesh_query_context</code>
            。Monorepo 开发可将 <code className="rounded bg-zinc-900 px-1">command</code> 指到本地{" "}
            <code className="rounded bg-zinc-900 px-1">packages/mcp-server</code>。
          </p>
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-400">
            {mcpJson}
          </pre>
          <button
            type="button"
            className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
            onClick={() => void copy("mcp", mcpJson)}
          >
            {copied === "mcp" ? "已复制" : "复制 MCP JSON"}
          </button>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300">用 HTTP 检索</h3>
          <p className="mt-1 text-[11px] text-zinc-600">
            任意语言 / 脚本直接调用 Workspace 语义检索；需服务端已索引项目。
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-400">
            {httpCurl}
          </pre>
          <button
            type="button"
            className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
            onClick={() => void copy("http", httpCurl)}
          >
            {copied === "http" ? "已复制" : "复制 curl"}
          </button>
        </div>
      </div>
    </section>
  );
}
