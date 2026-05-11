"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { ProjectSyncRow } from "@/components/workspace/ProjectSyncRow";
import { WorkspaceActivityFeed } from "@/components/workspace/WorkspaceActivityFeed";
import { WorkspaceCollaborationChecklist } from "@/components/workspace/WorkspaceCollaborationChecklist";
import { describeIndexFreshness } from "@/lib/workspace/indexFreshness";
import {
  buildMcpConfigJsonString,
  NODE_DIST_PLACEHOLDER,
} from "@/lib/mcp/antigravityConfig";
import { useJsonHeaders } from "@/hooks/useActorUserId";
import { WorkspaceServerImports } from "./WorkspaceServerImports";

const MCP_DIST_FOR_SNIPPET =
  process.env.NEXT_PUBLIC_MCP_DIST_ABSOLUTE_FOR_SNIPPET?.trim() ||
  NODE_DIST_PLACEHOLDER;

type WsPayload = {
  id: string;
  name: string;
  inviteCode: string;
  viewerUserId?: string;
  myContextToken?: string | null;
  members: {
    id: string;
    userId: string;
    role: string;
  }[];
  projects: {
    id: string;
    name: string;
    indexingStatus: string;
    summary: string | null;
    ownerUserId: string;
    lastSyncedAt: string | null;
    indexError: string | null;
    sharingEnabled?: boolean;
    fileTreeShared?: boolean;
    snippetsShared?: boolean;
    sourceType?: string;
  }[];
};

export default function WorkspaceHomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading…</div>}>
      <WorkspaceHomePageContent />
    </Suspense>
  );
}

function WorkspaceHomePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const wsId = params.wsId as string;

  const [ws, setWs] = useState<WsPayload | null>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [query, setQuery] = useState("routing configuration");
  const [hits, setHits] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteOk, setInviteOk] = useState<string | null>(null);

  const headers = useJsonHeaders();

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${wsId}`, { headers });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setWs(await res.json());
    setErr(null);
    setActivityRefreshKey((k) => k + 1);
  }, [wsId, headers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  async function runQuery() {
    setErr(null);
    const token = ws?.myContextToken;
    const res = await fetch(`/api/workspaces/${wsId}/context/query`, {
      method: "POST",
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, top_k: 5 }),
    });
    const body = await res.text();
    if (!res.ok) return setErr(body);
    setHits(JSON.parse(body));
  }

  async function sendWorkspaceInvite() {
    setErr(null);
    setInviteOk(null);
    const raw = inviteHandle.trim();
    if (!raw) {
      setErr("Enter the invitee’s handle or email");
      return;
    }
    const res = await fetch(`/api/workspaces/${wsId}/invites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ invitee: raw }),
    });
    const bodyText = await res.text();
    if (!res.ok) return setErr(bodyText);
    let j: {
      message?: string;
      email?: { sent?: boolean };
      acceptUrl?: string;
    } = {};
    try {
      j = JSON.parse(bodyText) as typeof j;
    } catch {
      /* ignore */
    }
    const emailed = Boolean(j.email?.sent);
    let ok =
      j.message ??
      (emailed
        ? "Invitation sent (email delivered; they can join from the link)."
        : "Invitation created (if email wasn’t sent, copy the accept link below).");
    if (j.acceptUrl) {
      ok += ` Accept link: ${j.acceptUrl}`;
    }
    setInviteOk(ok);
    setInviteHandle("");
    await refresh();
  }

  function formatSyncedAt(iso: string | null | undefined) {
    if (!iso) return "Not synced / indexed yet";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  function indexingProgressHint(status: string): string {
    switch (status) {
      case "pending":
        return "Status: waiting for first push (CLI init/push, web import, or optional IDE extension).";
      case "indexing":
        return "Status: indexing (chunk + embed)—often seconds to a few minutes; use “Refresh status”.";
      case "ready":
        return "Status: ready—searchable via MCP / HTTP.";
      case "error":
        return "Status: stopped—fix the error below, push again, and refresh this page.";
      default:
        return `Status: ${status}`;
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    } catch {
      setErr("Clipboard unavailable—copy manually.");
    }
  }

  if (!ws) {
    return <div className="p-8 text-zinc-400">Loading…</div>;
  }

  const onboardingParam = searchParams.get("onboarding") === "1";
  const showOnboarding = ws.projects.length === 0 || onboardingParam;

  if (showOnboarding) {
    return (
      <OnboardingFlow
        wsId={wsId}
        headers={headers}
        onImported={async () => {
          await refresh();
        }}
      />
    );
  }

  const token = ws.myContextToken ?? "";
  const mcpSnippet = `{
  "mcpServers": {
    "agentmesh": {
      "command": "npx",
      "args": ["-y", "@agentmesh/mcp-server"],
      "env": {
        "AGENTMESH_API_BASE_URL": "${origin || "http://localhost:3000"}",
        "AGENTMESH_WORKSPACE_ID": "${wsId}",
        "AGENTMESH_TOKEN": "<context token from this page—do not commit>"
      }
    }
  }
}`;

  const agentmeshBindingJson = JSON.stringify(
    {
      apiBaseUrl: origin || "http://localhost:3000",
      workspaceId: wsId,
    },
    null,
    2
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_320px]">
      {/* min-w-0: long <pre> lines won’t blow out the grid column */}
      <div className="min-w-0 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{ws.name}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              Import code with <strong className="font-medium text-zinc-400">GitHub</strong>—we clone
              and index automatically. Use <strong className="font-medium text-zinc-400">MCP</strong>{" "}
              in your editor to read teammates’ shared projects: see the{" "}
              <Link className="text-violet-400 underline" href="/settings/advanced/docs#collab-mainline">
                collaboration guide
              </Link>
              ; token and snippets under <strong>Advanced</strong> below.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Invite code{" "}
              <code className="rounded bg-zinc-900 px-1">{ws.inviteCode}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="text-sm text-violet-400 underline"
              href="/settings/advanced/docs#collab-mainline"
            >
              Collaboration (MCP)
            </Link>
            <Link
              className="text-sm text-emerald-400 underline"
              href={`/workspace/${wsId}?onboarding=1`}
            >
              + Import GitHub repo
            </Link>
            <Link className="text-sm text-zinc-400 underline" href="/settings/advanced/docs">
              Docs
            </Link>
            <Link className="text-sm text-zinc-400 underline" href="/dashboard">
              ← Dashboard
            </Link>
          </div>
        </header>

        <WorkspaceCollaborationChecklist
          wsId={wsId}
          viewerUserId={ws.viewerUserId}
          myContextToken={ws.myContextToken}
          projects={ws.projects}
        />

        {err ? (
          <pre className="whitespace-pre-wrap rounded border border-red-900 bg-red-950/30 p-3 text-xs text-red-200">
            {err}
          </pre>
        ) : null}

        {ws.projects.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">Sync & indexing</h2>
            {ws.projects.map((p) => (
              <ProjectSyncRow
                key={p.id}
                wsId={wsId}
                projectId={p.id}
                headers={headers}
                onRetry={refresh}
              />
            ))}
          </section>
        ) : null}

        <details className="rounded-lg border border-zinc-800 bg-zinc-950/40">
          <summary className="cursor-pointer select-none p-3 text-xs font-medium text-zinc-400">
            Advanced · permissions / CLI / MCP / token / web import
          </summary>
          <div className="space-y-4 border-t border-zinc-800 p-3">
            <div className="space-y-2 text-[11px] leading-relaxed text-zinc-500">
              <p>
                <strong className="font-medium text-zinc-400">Write</strong>: members import via
                GitHub, push locally, or use a token; writes are scoped to project owners.
              </p>
              <p>
                <strong className="font-medium text-zinc-400">Read index</strong>: members can use MCP
                or HTTP to search shared projects (see{" "}
                <code className="rounded bg-zinc-900 px-1">sharingEnabled</code>).
              </p>
            </div>

            <div className="rounded-lg border border-violet-900/40 bg-violet-950/10 p-3">
              <h3 className="text-xs font-medium text-violet-200">CLI / MCP / token (optional)</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
            <li>
              <strong className="font-medium text-zinc-400">Main path</strong>: copy the Context Token
              on this page →{" "}
              <code className="rounded bg-zinc-900 px-1">export AGENTMESH_TOKEN=…</code>, then follow{" "}
              <Link className="text-violet-300 underline" href="/settings/advanced/docs#quickstart">
                the docs
              </Link>{" "}
              to configure MCP or CLI (copy the{" "}
              <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code> template below).
            </li>
            <li>
              <strong className="font-medium text-zinc-400">MCP</strong>: merge the JSON below into
              your host config (Claude Code, Codex, any MCP client). Use the Context Token as{" "}
              <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code>.
            </li>
            <li>
              <strong className="font-medium text-zinc-400">Optional · VS Code</strong>: install{" "}
              <code className="rounded bg-zinc-900 px-1">extensions/agentmesh-vscode</code>, add{" "}
              <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code> at the repo root; in a
              terminal run{" "}
              <code className="rounded bg-zinc-900 px-1">export AGENTMESH_TOKEN=…</code> (never commit
              the token). Command palette <strong>AgentMesh: Push to cloud</strong> or{" "}
              <code className="rounded bg-zinc-900 px-1">agentmesh.syncOnSave</code>.
            </li>
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-emerald-700/80 bg-emerald-950/35 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-900/40"
              disabled={!token}
              onClick={() =>
                void copyText(
                  "mcpnpx",
                  buildMcpConfigJsonString({
                    apiBaseUrl: origin || "http://localhost:3000",
                    workspaceId: wsId,
                    token,
                    launch: { mode: "npx" },
                  })
                )
              }
            >
              {copied === "mcpnpx"
                ? "Copied"
                : "Copy mcp_config (npx · when package is on npm)"}
            </button>
            <button
              type="button"
              className="rounded border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-100 hover:bg-amber-900/35"
              disabled={!token}
              onClick={() =>
                void copyText(
                  "mcpnode",
                  buildMcpConfigJsonString({
                    apiBaseUrl: origin || "http://localhost:3000",
                    workspaceId: wsId,
                    token,
                    launch: {
                      mode: "node",
                      distPath: MCP_DIST_FOR_SNIPPET,
                    },
                  })
                )
              }
            >
              {copied === "mcpnode"
                ? "Copied"
                : "Copy mcp_config (node · monorepo dev)"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Paste into Cursor / Antigravity raw MCP JSON (or{" "}
            <code className="rounded bg-zinc-900 px-1">~/.gemini/antigravity/mcp_config.json</code>
            ). If you already have other{" "}
            <code className="rounded bg-zinc-900 px-1">mcpServers</code>,{" "}
            <strong className="font-medium text-zinc-400">merge</strong>: only add the{" "}
            <code className="rounded bg-zinc-900 px-1">agentmesh</code> entry—do not replace the whole
            file.
            <strong className="font-medium text-zinc-400"> Node build</strong>: after copying, set{" "}
            <code className="rounded bg-zinc-900 px-1">args</code> to the{" "}
            <strong className="font-medium text-zinc-400">absolute path</strong> of{" "}
            <code className="rounded bg-zinc-900 px-1">packages/mcp-server/dist/index.js</code> on
            your machine (or pre-fill via{" "}
            <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_MCP_DIST_ABSOLUTE_FOR_SNIPPET</code>{" "}
            in your web deploy), and run{" "}
            <code className="rounded bg-zinc-900 px-1">npm run build -w @agentmesh/mcp-server</code>.{" "}
            <strong className="font-medium text-zinc-400">npx</strong> returns 404 until the package
            is published—see{" "}
            <code className="rounded bg-zinc-900 px-1">packages/mcp-server/README.md</code>.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-violet-600 bg-violet-950/40 px-3 py-2 text-xs text-violet-100 hover:bg-violet-900/50"
              onClick={() => void copyText("binding", agentmeshBindingJson)}
            >
              {copied === "binding" ? "Copied .agentmesh.json" : "Copy .agentmesh.json template"}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-600 px-3 py-2 text-xs hover:bg-zinc-900"
              onClick={() => void copyText("ws", wsId)}
            >
              {copied === "ws" ? "Copied workspace ID" : "Copy workspace ID only"}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-600 px-3 py-2 text-xs hover:bg-zinc-900"
              disabled={!token}
              onClick={() => void copyText("token", token)}
            >
              {copied === "token"
                ? "Copied context token"
                : "Copy token for export AGENTMESH_TOKEN"}
            </button>
          </div>
          <pre className="mt-2 max-h-32 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-500">
            {agentmeshBindingJson}
          </pre>
          {!token ? (
            <p className="mt-2 text-xs text-amber-200/90">
              No context token for this account—confirm you are signed in and are a member of this
              workspace.
            </p>
          ) : null}

          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-zinc-500">
              MCP sample (stdio · any compatible host)
            </h3>
            <pre className="mt-2 max-h-48 overflow-auto rounded border border-zinc-800 bg-black/40 p-3 text-[11px] text-zinc-400">
              {mcpSnippet}
            </pre>
            <p className="mt-2 text-[11px] text-zinc-600">
              For monorepo dev you can point <code className="rounded bg-zinc-900 px-1">command</code>{" "}
              at the built entry under{" "}
              <code className="rounded bg-zinc-900 px-1">packages/mcp-server</code>. Set{" "}
              <code className="rounded bg-zinc-900 px-1">OPENAI_API_KEY</code> /{" "}
              <code className="rounded bg-zinc-900 px-1">GEMINI_API_KEY</code> on the server for
              better embeddings.
            </p>
          </div>
            </div>
          </div>
        </details>

        <section className="rounded-lg border border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400">Invite collaborators</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Enter their <strong className="font-medium text-zinc-500">handle</strong> or{" "}
            <strong className="font-medium text-zinc-500">any email</strong> (they need not be
            registered yet). Registered users get an email with an accept link; new emails get mail
            too and can sign up from the link. Configure <code className="text-zinc-500">RESEND_API_KEY</code>{" "}
            to send mail; otherwise the API returns <code className="text-zinc-500">acceptUrl</code>{" "}
            to share manually. Pending invites also appear under Dashboard → Inbox.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="handle (e.g. bob) or email"
              value={inviteHandle}
              onChange={(e) => setInviteHandle(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
              onClick={() => void sendWorkspaceInvite()}
            >
              Send invite
            </button>
          </div>
          {inviteOk ? (
            <p className="mt-2 text-xs text-emerald-400">{inviteOk}</p>
          ) : null}
        </section>

        <WorkspaceServerImports wsId={wsId} headers={headers} onImported={refresh} />

        <details className="rounded-lg border border-zinc-800">
          <summary className="cursor-pointer select-none p-4 text-sm font-medium text-zinc-400">
            Index & health check (cross-project search)
          </summary>
          <div className="space-y-4 border-t border-zinc-800 p-4">
            <p className="text-xs text-zinc-600">
              After syncing from an IDE or the web UI, spot-check{" "}
              <code className="rounded bg-zinc-900 px-1">context/query</code> here
            </p>
            <div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                className="mt-2 rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-900"
                onClick={() => void runQuery()}
              >
                Run context/query
              </button>
              {hits ? (
                <pre className="mt-3 max-h-80 min-w-0 max-w-full overflow-auto break-words rounded bg-black/40 p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(hits, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        </details>
      </div>

      <aside className="space-y-4">
        <WorkspaceActivityFeed
          wsId={wsId}
          headers={headers}
          refreshSignal={activityRefreshKey}
        />

        <section className="rounded-lg border border-zinc-800 p-3">
          <h3 className="text-xs font-semibold uppercase text-zinc-500">Members</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {ws.members.map((m) => (
              <li key={m.id}>
                <span className="font-medium">{m.userId}</span>
                <span className="ml-2 text-xs text-zinc-500">{m.role}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            Invite via invite code or the other person’s{" "}
            <strong className="font-medium text-zinc-500">handle</strong> (main column). After they
            accept, they can use their Context Token with CLI / MCP / the optional extension.
          </p>
        </section>

        <section className="rounded-lg border border-zinc-800 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase text-zinc-500">
              Projects (cloud index status)
            </h3>
            <button
              type="button"
              className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-900"
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>
          <ul className="mt-2 space-y-3 text-sm">
            {ws.projects.map((p) => {
              const mine = ws.viewerUserId && p.ownerUserId === ws.viewerUserId;
              const statusClass =
                p.indexingStatus === "ready"
                  ? "text-emerald-500"
                  : p.indexingStatus === "error"
                    ? "text-red-400"
                    : p.indexingStatus === "indexing"
                      ? "text-amber-400"
                      : "text-zinc-500";
              const fr =
                p.indexingStatus === "ready"
                  ? describeIndexFreshness({
                      lastSyncedAt: p.lastSyncedAt,
                      indexingStatus: p.indexingStatus,
                      sourceType: p.sourceType,
                    })
                  : null;
              const frClass =
                fr?.tone === "stale"
                  ? "text-amber-200/90"
                  : fr?.tone === "aging"
                    ? "text-amber-100/80"
                    : fr?.tone === "fresh"
                      ? "text-emerald-400/90"
                      : "text-zinc-500";
              return (
                <li key={p.id} className="rounded border border-zinc-800 p-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{p.name}</span>
                    {mine ? (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        Mine
                      </span>
                    ) : null}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">{p.id}</div>
                  <div className={`mt-1 text-xs font-medium ${statusClass}`}>
                    Index: {p.indexingStatus}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                    {indexingProgressHint(p.indexingStatus)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    Last sync: {formatSyncedAt(p.lastSyncedAt)}
                  </div>
                  {fr ? (
                    <div className={`mt-1 text-[10px] leading-snug ${frClass}`}>{fr.line}</div>
                  ) : null}
                  {p.indexError ? (
                    <div className="mt-2 rounded border border-red-900/60 bg-red-950/25 p-2 text-[11px] text-red-200">
                      <span className="font-medium">lastError: </span>
                      {p.indexError}
                      <p className="mt-1 text-red-300/80">
                        Try pushing again from your machine or sync from the IDE, then refresh. If it
                        keeps failing, check logs and provider quotas.
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-zinc-600">
                    Sharing: {p.sharingEnabled !== false ? "on" : "off"} · file tree{" "}
                    {p.fileTreeShared !== false ? "on" : "off"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 line-clamp-3">
                    {p.summary ?? "—"}
                  </div>
                </li>
              );
            })}
          </ul>
          {ws.projects.length === 0 ? (
            <p className="text-xs text-zinc-500">None yet—use “Import GitHub repo” above.</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
