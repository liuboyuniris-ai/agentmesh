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

const MCP_DIST_FOR_SNIPPET =
  process.env.NEXT_PUBLIC_MCP_DIST_ABSOLUTE_FOR_SNIPPET?.trim() ||
  NODE_DIST_PLACEHOLDER;
import { useJsonHeaders } from "@/hooks/useActorUserId";
import { WorkspaceServerImports } from "./WorkspaceServerImports";

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
    <Suspense fallback={<div className="p-8 text-zinc-400">加载中…</div>}>
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
      setErr("请填写对方的 handle 或邮箱");
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
        ? "邀请已发出（邮件已发送，对方可从邮件中的链接加入）。"
        : "邀请已创建（未发邮件时可在下方复制接受链接发给对方）。");
    if (j.acceptUrl) {
      ok += ` 接受链接：${j.acceptUrl}`;
    }
    setInviteOk(ok);
    setInviteHandle("");
    await refresh();
  }

  function formatSyncedAt(iso: string | null | undefined) {
    if (!iso) return "尚未完成同步/索引";
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
        return "进度：等待首次推送（CLI init / push、网页导入、或可选 IDE 扩展）。";
      case "indexing":
        return "进度：正在索引（切块、嵌入），通常数十秒～数分钟；可稍后点「刷新状态」。";
      case "ready":
        return "进度：已完成，可被 MCP / HTTP 检索。";
      case "error":
        return "进度：已中断，请根据下方错误重试 push 并刷新本页。";
      default:
        return `进度：状态 ${status}`;
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    } catch {
      setErr("无法写入剪贴板，请手动复制。");
    }
  }

  if (!ws) {
    return <div className="p-8 text-zinc-400">加载中…</div>;
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
        "AGENTMESH_TOKEN": "<本页 context token，勿提交到 Git>"
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
      {/* min-w-0: 避免长行 <pre> 把 grid 列撑破，连带把下方 SVG 103% 宽放大 */}
      <div className="min-w-0 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{ws.name}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              代码通过 <strong className="font-medium text-zinc-400">GitHub 授权</strong>{" "}
              导入并自动索引。在编辑器里用 <strong className="font-medium text-zinc-400">MCP</strong> 读队友已上云的项目：见{" "}
              <Link className="text-violet-400 underline" href="/settings/advanced/docs#collab-mainline">
                协作主线
              </Link>
              ；Token / 片段在下方「高级」。
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              邀请码{" "}
              <code className="rounded bg-zinc-900 px-1">{ws.inviteCode}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="text-sm text-violet-400 underline"
              href="/settings/advanced/docs#collab-mainline"
            >
              协作主线（MCP）
            </Link>
            <Link
              className="text-sm text-emerald-400 underline"
              href={`/workspace/${wsId}?onboarding=1`}
            >
              + 导入 GitHub 仓库
            </Link>
            <Link className="text-sm text-zinc-400 underline" href="/settings/advanced/docs">
              高级文档
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
            <h2 className="text-sm font-medium text-zinc-400">同步与索引</h2>
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
            高级 · 权限说明 / CLI / MCP / Token / 网页导入
          </summary>
          <div className="space-y-4 border-t border-zinc-800 p-3">
            <div className="space-y-2 text-[11px] leading-relaxed text-zinc-500">
              <p>
                <strong className="font-medium text-zinc-400">写 Workspace</strong>
                ：成员通过 GitHub 导入、本地推送或 Token；写入绑定项目所有者。
              </p>
              <p>
                <strong className="font-medium text-zinc-400">读索引</strong>：成员可使用 MCP / HTTP
                检索已共享项目（见 <code className="rounded bg-zinc-900 px-1">sharingEnabled</code>）。
              </p>
            </div>

            <div className="rounded-lg border border-violet-900/40 bg-violet-950/10 p-3">
              <h3 className="text-xs font-medium text-violet-200">CLI / MCP / Token（可选）</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
            <li>
              <strong className="font-medium text-zinc-400">主路径</strong>：在本页复制 Context Token →{" "}
              <code className="rounded bg-zinc-900 px-1">export AGENTMESH_TOKEN=…</code>，再按{" "}
              <Link className="text-violet-300 underline" href="/settings/advanced/docs#quickstart">
                高级文档
              </Link>{" "}
              配置 MCP 或 CLI（{" "}
              <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code> 模板可复制下方按钮）。
            </li>
            <li>
              <strong className="font-medium text-zinc-400">MCP</strong>：将下方 JSON 合并进宿主配置（Claude
              Code、Codex、其他 MCP 客户端）；用 Context Token 作{" "}
              <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code>。
            </li>
            <li>
              <strong className="font-medium text-zinc-400">可选 · VS Code</strong>：安装{" "}
              <code className="rounded bg-zinc-900 px-1">extensions/agentmesh-vscode</code>，根目录{" "}
              <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code>；终端里{" "}
              <code className="rounded bg-zinc-900 px-1">export AGENTMESH_TOKEN=…</code>（勿把 Token
              写入仓库）。命令面板 <strong>AgentMesh: Push to cloud</strong> 或{" "}
              <code className="rounded bg-zinc-900 px-1">agentmesh.syncOnSave</code>。
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
                ? "已复制"
                : "一键复制 mcp_config（npx · 已发 npm 时用）"}
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
                ? "已复制"
                : "一键复制 mcp_config（node · 本仓库开发）"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            粘贴到 Cursor / Antigravity 的 MCP 原始 JSON（或{" "}
            <code className="rounded bg-zinc-900 px-1">~/.gemini/antigravity/mcp_config.json</code>
            ）。若文件里<strong className="font-medium text-zinc-400">已有</strong>其他{" "}
            <code className="rounded bg-zinc-900 px-1">mcpServers</code>，请<strong className="font-medium text-zinc-400">
              合并
            </strong>
            ：只把其中的 <code className="rounded bg-zinc-900 px-1">agentmesh</code> 块放进你的{" "}
            <code className="rounded bg-zinc-900 px-1">mcpServers</code>，勿覆盖整文件。
            <strong className="font-medium text-zinc-400"> node 版</strong>复制后请把{" "}
            <code className="rounded bg-zinc-900 px-1">args</code> 里的路径改成你电脑上{" "}
            <code className="rounded bg-zinc-900 px-1">packages/mcp-server/dist/index.js</code>{" "}
            的<strong className="font-medium text-zinc-400">绝对路径</strong>（也可在 Web 部署里配置{" "}
            <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_MCP_DIST_ABSOLUTE_FOR_SNIPPET</code>{" "}
            预填），并先执行{" "}
            <code className="rounded bg-zinc-900 px-1">npm run build -w @agentmesh/mcp-server</code>。
            <strong className="font-medium text-zinc-400"> npx 版</strong>在包未发布时会 404，见{" "}
            <code className="rounded bg-zinc-900 px-1">packages/mcp-server/README.md</code>。
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-violet-600 bg-violet-950/40 px-3 py-2 text-xs text-violet-100 hover:bg-violet-900/50"
              onClick={() => void copyText("binding", agentmeshBindingJson)}
            >
              {copied === "binding" ? "已复制 .agentmesh.json" : "复制 .agentmesh.json 模板"}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-600 px-3 py-2 text-xs hover:bg-zinc-900"
              onClick={() => void copyText("ws", wsId)}
            >
              {copied === "ws" ? "已复制 Workspace ID" : "仅复制 Workspace ID"}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-600 px-3 py-2 text-xs hover:bg-zinc-900"
              disabled={!token}
              onClick={() => void copyText("token", token)}
            >
              {copied === "token"
                ? "已复制 Context Token"
                : "复制 Token → 贴到 export AGENTMESH_TOKEN"}
            </button>
          </div>
          <pre className="mt-2 max-h-32 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-500">
            {agentmeshBindingJson}
          </pre>
          {!token ? (
            <p className="mt-2 text-xs text-amber-200/90">
              当前账号未返回 context token，请确认已登录且为本 Workspace 成员。
            </p>
          ) : null}

          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase text-zinc-500">
              MCP 配置示例（stdio · 任意兼容宿主）
            </h3>
            <pre className="mt-2 max-h-48 overflow-auto rounded border border-zinc-800 bg-black/40 p-3 text-[11px] text-zinc-400">
              {mcpSnippet}
            </pre>
            <p className="mt-2 text-[11px] text-zinc-600">
              Monorepo 本地开发可将 <code className="rounded bg-zinc-900 px-1">command</code>{" "}
              改成指向本仓库 <code className="rounded bg-zinc-900 px-1">packages/mcp-server</code>{" "}
              构建后的入口。服务端需配置{" "}
              <code className="rounded bg-zinc-900 px-1">OPENAI_API_KEY</code> /{" "}
              <code className="rounded bg-zinc-900 px-1">GEMINI_API_KEY</code>{" "}
              以获得更好的嵌入质量。
            </p>
          </div>
            </div>
          </div>
        </details>

        <section className="rounded-lg border border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400">邀请协作者</h2>
          <p className="mt-1 text-xs text-zinc-600">
            填写对方的 <strong className="font-medium text-zinc-500">handle</strong> 或<strong className="font-medium text-zinc-500"> 任意邮箱</strong>（无需已注册）。
            已注册用户会收到带接受链接的邮件；未注册邮箱同样会收到邮件，点开可先注册再自动加入。需配置{" "}
            <code className="text-zinc-500">RESEND_API_KEY</code> 发信；否则 API 会返回{" "}
            <code className="text-zinc-500">acceptUrl</code> 供手动转发。Dashboard「消息」仍处理待处理邀请。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="handle（如 bob）或邮箱"
              value={inviteHandle}
              onChange={(e) => setInviteHandle(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
              onClick={() => void sendWorkspaceInvite()}
            >
              发送邀请
            </button>
          </div>
          {inviteOk ? (
            <p className="mt-2 text-xs text-emerald-400">{inviteOk}</p>
          ) : null}
        </section>

        <WorkspaceServerImports wsId={wsId} headers={headers} onImported={refresh} />

        <details className="rounded-lg border border-zinc-800">
          <summary className="cursor-pointer select-none p-4 text-sm font-medium text-zinc-400">
            索引与健康检查（跨项目检索）
          </summary>
          <div className="space-y-4 border-t border-zinc-800 p-4">
            <p className="text-xs text-zinc-600">
              成员通过 IDE 或网页导入同步后，可在此抽检 <code className="rounded bg-zinc-900 px-1">context/query</code>{" "}
              语义检索是否正常。
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
                运行 context/query
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
          <h3 className="text-xs font-semibold uppercase text-zinc-500">成员</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {ws.members.map((m) => (
              <li key={m.id}>
                <span className="font-medium">{m.userId}</span>
                <span className="ml-2 text-xs text-zinc-500">{m.role}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            通过邀请码或<strong className="font-medium text-zinc-500">对方账号 handle</strong>
            邀请（见主栏）。接受后即可用自己的 Context Token 通过 CLI / MCP / 可选扩展同步。
          </p>
        </section>

        <section className="rounded-lg border border-zinc-800 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase text-zinc-500">
              Projects（云端索引状态）
            </h3>
            <button
              type="button"
              className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-900"
              onClick={() => void refresh()}
            >
              刷新状态
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
                        我的项目
                      </span>
                    ) : null}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">{p.id}</div>
                  <div className={`mt-1 text-xs font-medium ${statusClass}`}>
                    索引：{p.indexingStatus}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                    {indexingProgressHint(p.indexingStatus)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    上次同步：{formatSyncedAt(p.lastSyncedAt)}
                  </div>
                  {fr ? (
                    <div className={`mt-1 text-[10px] leading-snug ${frClass}`}>{fr.line}</div>
                  ) : null}
                  {p.indexError ? (
                    <div className="mt-2 rounded border border-red-900/60 bg-red-950/25 p-2 text-[11px] text-red-200">
                      <span className="font-medium">lastError: </span>
                      {p.indexError}
                      <p className="mt-1 text-red-300/80">
                        可在本地再次执行 Push / 保存触发同步，或稍后点击刷新本页；若持续失败请检查日志与配额。
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-zinc-600">
                    共享：{p.sharingEnabled !== false ? "开" : "关"} · 文件树共享{" "}
                    {p.fileTreeShared !== false ? "开" : "关"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600 line-clamp-3">
                    {p.summary ?? "—"}
                  </div>
                </li>
              );
            })}
          </ul>
          {ws.projects.length === 0 ? (
            <p className="text-xs text-zinc-500">暂无；可从上方「导入 GitHub 仓库」添加。</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
