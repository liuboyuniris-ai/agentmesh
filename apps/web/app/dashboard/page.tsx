"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useActorUserId } from "@/hooks/useActorUserId";
import { PlatformIntegrationCards } from "@/components/PlatformIntegrationCards";

type InviteRow = {
  id: string;
  inviterUserId: string;
  createdAt: string;
  workspace: { id: string; name: string };
};

function DashboardContent() {
  const pathname = usePathname() ?? "/dashboard";
  const searchParams = useSearchParams();
  const githubOAuthStartHref = useMemo(() => {
    const q = searchParams.toString();
    const returnTo = q ? `${pathname}?${q}` : pathname;
    return `/api/auth/github/start?return_to=${encodeURIComponent(returnTo)}`;
  }, [pathname, searchParams]);

  const actorId = useActorUserId();
  const hdr = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-User-Id": actorId,
    }),
    [actorId]
  );

  const [rows, setRows] = useState<
    { workspaceId: string; name: string; inviteCode: string }[]
  >([]);
  const [name, setName] = useState("My Workspace");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [github, setGithub] = useState<{
    connected: boolean;
    scope: string | null;
    updatedAt: string | null;
  }>({ connected: false, scope: null, updatedAt: null });
  const [oauthBanner, setOauthBanner] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InviteRow[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) return setError(await res.text());
    setRows(await res.json());
    setError(null);
  }, []);

  const refreshInvites = useCallback(async () => {
    const res = await fetch("/api/me/invitations");
    if (!res.ok) return;
    const data = (await res.json()) as { invitations: InviteRow[] };
    setInvitations(data.invitations ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    void refreshInvites();
  }, [refresh, refreshInvites, actorId]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/github/status", { headers: hdr });
      if (!res.ok) return;
      setGithub(await res.json());
    })();

    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("github") === "connected") {
      setOauthBanner(
        "GitHub 已连接：在 Workspace 网页里从 GitHub 导入时将使用 OAuth token。"
      );
    }
    const ge = p.get("github_error");
    if (ge) {
      setOauthBanner(
        `GitHub 连接失败（${ge}）。请检查回调 URL 是否包含 /api/auth/github/callback。`
      );
    }
    if (p.get("oidc") === "connected") {
      setOauthBanner("已通过 Google / OIDC 登录。");
    }
    const oe = p.get("oidc_error");
    if (oe) {
      setOauthBanner(`OIDC 登录失败（${oe}）。请核对 IdP 与 OIDC_CLIENT_* 配置。`);
    }
  }, [hdr]);

  async function logout() {
    setError(null);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function createWs() {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: hdr,
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return setError(await res.text());
    const data = (await res.json()) as { workspaceId: string };
    window.location.href = `/workspace/${data.workspaceId}?onboarding=1`;
  }

  async function joinWs() {
    const res = await fetch("/api/workspaces/join", {
      method: "POST",
      headers: hdr,
      body: JSON.stringify({ inviteCode }),
    });
    if (!res.ok) return setError(await res.text());
    await refresh();
  }

  async function acceptInvite(id: string) {
    setError(null);
    const res = await fetch(`/api/me/invitations/${encodeURIComponent(id)}/accept`, {
      method: "POST",
      headers: hdr,
    });
    if (!res.ok) return setError(await res.text());
    await refresh();
    await refreshInvites();
  }

  async function declineInvite(id: string) {
    setError(null);
    const res = await fetch(`/api/me/invitations/${encodeURIComponent(id)}/decline`, {
      method: "POST",
      headers: hdr,
    });
    if (!res.ok) return setError(await res.text());
    await refreshInvites();
  }

  async function disconnectGithub() {
    const res = await fetch("/api/auth/github/disconnect", {
      method: "DELETE",
      headers: hdr,
    });
    if (!res.ok) return setError(await res.text());
    const st = await fetch("/api/auth/github/status", { headers: hdr });
    if (st.ok) setGithub(await st.json());
    setOauthBanner("已断开 GitHub OAuth。");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-xs text-zinc-500">
            已登录为 <code className="rounded bg-zinc-900 px-1">{actorId}</code>
            。主路径：新建 Workspace → 连接 GitHub → 选择仓库导入（无需配置 Token）。开发者工具见{" "}
            <Link className="text-blue-400 underline" href="/settings/advanced/docs">
              高级文档
            </Link>
            。
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
          onClick={() => void logout()}
        >
          退出
        </button>
      </header>

      {error ? (
        <p className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {oauthBanner ? (
        <p className="rounded border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-100">
          {oauthBanner}
        </p>
      ) : null}

      <section className="space-y-3 rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-4">
        <h2 className="text-sm font-medium text-emerald-200">开始接入代码</h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          点击上方 <strong className="text-zinc-400">+</strong> 创建 Workspace
          后将自动进入引导：连接 GitHub 并选择一个仓库，系统会克隆并建立索引。多人协作时：同一
          Workspace、各人导入/同步自己的仓库，并在各自编辑器配置{" "}
          <strong className="font-medium text-zinc-400">MCP</strong>，才能在对话里检索队友已上云的项目（见{" "}
          <Link className="text-emerald-400 underline" href="/settings/advanced/docs#collab-mainline">
            协作主线
          </Link>
          ）。
        </p>
        <p className="text-xs text-zinc-600">
          CLI、HTTP、复制 MCP 片段：展开页面底部「高级 · 开发者集成」或打开完整高级文档。
        </p>
      </section>

      <details className="rounded-lg border border-zinc-800 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-400">
          高级 · 开发者集成（CLI / MCP / HTTP）
        </summary>
        <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
          <PlatformIntegrationCards workspaceId={rows[0]?.workspaceId ?? null} />
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex rounded border border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
              href="/settings/advanced/docs"
            >
              完整高级文档
            </Link>
          </div>
        </div>
      </details>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">消息 · Workspace 邀请</h2>
        <p className="text-xs text-zinc-600">
          其他成员可通过你的 AgentMesh 账号（当前 <code className="rounded bg-zinc-900 px-1">{actorId}</code>
          ）向你发出邀请；在此处收到通知并选择接受或忽略。
        </p>
        {invitations.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无待处理邀请。</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{inv.workspace.name}</div>
                  <div className="text-xs text-zinc-500">
                    来自 <code className="rounded bg-zinc-900 px-1">{inv.inviterUserId}</code>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
                    onClick={() => void acceptInvite(inv.id)}
                  >
                    接受
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
                    onClick={() => void declineInvite(inv.id)}
                  >
                    拒绝
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">
          GitHub（连接后可在网页上从 GitHub 导入仓库）
        </h2>
        <p className="text-xs leading-relaxed text-zinc-600">
          与「使用 GitHub 登录」共用同一 GitHub OAuth App 时，请在 GitHub 开发者设置中同时填写回调：{" "}
          <code className="rounded bg-zinc-900 px-1">/api/auth/github/callback</code>（连接
          token）与{" "}
          <code className="rounded bg-zinc-900 px-1">/api/auth/github/callback</code>
          （登录）。
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            href={githubOAuthStartHref}
          >
            连接 GitHub（克隆仓库）
          </a>
          <button
            type="button"
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40"
            disabled={!github.connected}
            onClick={() => void disconnectGithub()}
          >
            断开 GitHub
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          状态：{github.connected ? "已连接" : "未连接"}
          {github.scope ? (
            <>
              {" "}
              ·{" "}
              <code className="rounded bg-zinc-900 px-1">{github.scope}</code>
            </>
          ) : null}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-violet-900/40 bg-violet-950/10 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-violet-200">新建 Workspace</h2>
            <p className="mt-1 text-xs text-zinc-500">点击下方加号区域创建。</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名称"
          />
          <button
            type="button"
            title="新建 Workspace"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-light leading-none text-white hover:bg-blue-500"
            onClick={() => void createWs()}
          >
            +
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">通过邀请码加入</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <button
            type="button"
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-900"
            onClick={() => void joinWs()}
          >
            加入
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">我的 Workspace</h2>
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {rows.map((r) => (
            <li
              key={r.workspaceId}
              className="flex items-center justify-between p-3"
            >
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-zinc-500">
                  invite: <code>{r.inviteCode}</code>
                </div>
              </div>
              <Link
                className="text-sm text-blue-400 underline"
                href={`/workspace/${r.workspaceId}`}
              >
                控制台
              </Link>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">
              暂无。点击上方「+」创建，或让同事用你的账号发邀请。
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl p-8 text-zinc-400">加载中…</div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
