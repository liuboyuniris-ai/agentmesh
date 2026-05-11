"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  /** If set, curl/MCP samples use this workspace id; otherwise a placeholder */
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

  const cliBlock = `# Set token on your machine (same as “Copy token” in the console)
export AGENTMESH_TOKEN="${tokenPh}"

# Option A: this monorepo root
cd /path/to/multiagent && npm exec -w agentmesh-sync -- agentmesh-sync push

# Option B: your app repo
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
          <h2 className="text-sm font-medium text-emerald-400">
            Three ways in: CLI · MCP · HTTP (editor-agnostic)
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            <strong className="font-medium text-zinc-500">CLI</strong> pushes local code{" "}
            <strong className="font-medium text-zinc-500">to the cloud</strong> and refreshes the
            index. <strong className="font-medium text-zinc-500">MCP / HTTP</strong> let an agent or
            script <strong className="font-medium text-zinc-500">query what’s already in the workspace</strong>{" "}
            (someone must have synced first).
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Any agent: sync code into the workspace, then push with CLI, read context via MCP in chat,
            or call HTTP yourself. Replace{" "}
            <code className="rounded bg-zinc-900 px-1">{tokenPh}</code> with the Context Token from the
            workspace page (same as <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code>
            ). Replace <code className="rounded bg-zinc-900 px-1">YOUR_WORKSPACE_ID</code> with your
            workspace id if it wasn’t filled in automatically.
          </p>
        </div>
      ) : null}
      <div className={gridClass}>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300">Push with CLI</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            Install: <code className="rounded bg-zinc-900 px-1">npm i -D agentmesh-sync@0.3.1</code>
            (or in this monorepo{" "}
            <code className="rounded bg-zinc-900 px-1">npm exec -w agentmesh-sync</code>). Root needs{" "}
            <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code> +{" "}
            <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code>.
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-400">
            {cliBlock}
          </pre>
          <button
            type="button"
            className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
            onClick={() => void copy("cli", cliBlock)}
          >
            {copied === "cli" ? "Copied" : "Copy CLI snippet"}
          </button>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300">MCP (standard agent context)</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
            <strong className="font-medium text-zinc-500">Default path</strong>: merge the JSON below
            into any MCP-capable host (Claude Code, Codex, Cursor, Windsurf, custom runtime). Tools
            include <code className="rounded bg-zinc-900 px-1">agentmesh_query_context</code>. In this
            monorepo you can point <code className="rounded bg-zinc-900 px-1">command</code> at local{" "}
            <code className="rounded bg-zinc-900 px-1">packages/mcp-server</code>.
          </p>
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-400">
            {mcpJson}
          </pre>
          <button
            type="button"
            className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
            onClick={() => void copy("mcp", mcpJson)}
          >
            {copied === "mcp" ? "Copied" : "Copy MCP JSON"}
          </button>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300">Search over HTTP</h3>
          <p className="mt-1 text-[11px] text-zinc-600">
            Call workspace semantic search from any language; the project must be indexed on the server.
          </p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-400">
            {httpCurl}
          </pre>
          <button
            type="button"
            className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
            onClick={() => void copy("http", httpCurl)}
          >
            {copied === "http" ? "Copied" : "Copy curl"}
          </button>
        </div>
      </div>
    </section>
  );
}
