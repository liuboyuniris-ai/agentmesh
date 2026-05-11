"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type RepoRow = {
  fullName: string;
  private: boolean;
  description: string | null;
  updatedAt: string | null;
};

type Props = {
  wsId: string;
  headers: Record<string, string>;
  /** Called after a successful import so the parent can refetch workspace (client state). */
  onImported?: () => void | Promise<void>;
};

export function OnboardingFlow({ wsId, headers, onImported }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");

  const [github, setGithub] = useState<{ connected: boolean }>({
    connected: false,
  });
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [q, setQ] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const githubStartHref = useMemo(() => {
    const returnTo = `/workspace/${wsId}?onboarding=1&step=repo`;
    return `/api/auth/github/start?return_to=${encodeURIComponent(returnTo)}`;
  }, [wsId]);

  const refreshGithub = useCallback(async () => {
    const res = await fetch("/api/auth/github/status", { headers });
    if (!res.ok) return;
    const j = (await res.json()) as { connected: boolean };
    setGithub({ connected: j.connected });
  }, [headers]);

  useEffect(() => {
    void refreshGithub();
  }, [refreshGithub]);

  const loadRepos = useCallback(async () => {
    if (!github.connected) return;
    setErr(null);
    setLoadingRepos(true);
    try {
      const url = new URL("/api/me/github-repos", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { headers });
      const text = await res.text();
      if (!res.ok) {
        setErr(text);
        setRepos([]);
        return;
      }
      const j = JSON.parse(text) as { repos: RepoRow[] };
      setRepos(j.repos ?? []);
    } finally {
      setLoadingRepos(false);
    }
  }, [github.connected, headers, q]);

  useEffect(() => {
    if (!github.connected) return;
    const t = setTimeout(() => void loadRepos(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [github.connected, loadRepos, q]);

  const uiStep =
    github.connected || stepParam === "repo" ? "select_repo" : "connect_github";

  async function importRepo(fullName: string) {
    setErr(null);
    setImporting(fullName);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/projects/github`, {
        method: "POST",
        headers,
        body: JSON.stringify({ repoFullName: fullName }),
      });
      const text = await res.text();
      if (!res.ok) {
        setErr(text);
        return;
      }
      await onImported?.();
      router.replace(`/workspace/${wsId}`);
      router.refresh();
    } finally {
      setImporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 p-8">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">连接你的代码库</h1>
        <p className="mt-2 text-sm text-zinc-500">
          共两步：授权 GitHub，然后选一个仓库导入。完成后云端会自动建索引——之后你和队友可用{" "}
          <strong className="font-medium text-zinc-400">MCP</strong> 在各自编辑器里检索本 Workspace 内{" "}
          <strong className="font-medium text-zinc-400">已同步、已开放共享</strong>的项目（详见{" "}
          <Link className="text-blue-400 underline" href="/settings/advanced/docs#collab-mainline">
            协作主线
          </Link>
          ）。
        </p>
      </header>

      {err ? (
        <pre className="whitespace-pre-wrap rounded border border-red-900 bg-red-950/30 p-3 text-xs text-red-200">
          {err}
        </pre>
      ) : null}

      <ol className="space-y-6">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-medium text-white">
            ✓
          </span>
          <div>
            <p className="font-medium text-zinc-200">Workspace 已创建</p>
            <p className="mt-1 text-xs text-zinc-500">已加入本空间，无需其他设置。</p>
          </div>
        </li>

        <li className="flex gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              github.connected
                ? "bg-emerald-600 text-white"
                : "border border-zinc-600 text-zinc-400"
            }`}
          >
            {github.connected ? "✓" : "2"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-200">连接 GitHub</p>
            <p className="mt-1 text-xs text-zinc-500">
              仅用于访问你授权的仓库；不会在浏览器里复制 Token。
            </p>
            {!github.connected ? (
              <a
                className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                href={githubStartHref}
              >
                连接 GitHub
              </a>
            ) : (
              <p className="mt-2 text-xs text-emerald-400">已连接</p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
              uiStep === "select_repo" && repos.length >= 0
                ? "border border-zinc-600 text-zinc-400"
                : "border border-zinc-800 text-zinc-600"
            }`}
          >
            3
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-200">选择仓库</p>
            {!github.connected ? (
              <p className="mt-1 text-xs text-zinc-600">请先完成 GitHub 授权。</p>
            ) : (
              <>
                <input
                  className="mt-3 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  placeholder="搜索 owner/repo…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded border border-zinc-800">
                  {loadingRepos ? (
                    <p className="p-4 text-xs text-zinc-500">加载仓库列表…</p>
                  ) : repos.length === 0 ? (
                    <p className="p-4 text-xs text-zinc-500">没有匹配的仓库。</p>
                  ) : (
                    repos.map((r) => (
                      <div
                        key={r.fullName}
                        className="flex items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-zinc-200">
                            {r.fullName}
                          </div>
                          {r.description ? (
                            <div className="truncate text-[11px] text-zinc-500">
                              {r.description}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={importing !== null}
                          className="shrink-0 rounded border border-emerald-700/80 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-950/50 disabled:opacity-40"
                          onClick={() => void importRepo(r.fullName)}
                        >
                          {importing === r.fullName ? "导入中…" : "导入"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </li>
      </ol>

      <div className="rounded-lg border border-zinc-700/80 bg-zinc-900/40 p-4">
        <p className="text-xs font-medium text-zinc-300">和队友互相在 Agent 里读代码？</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-zinc-500">
          <li>把人拉进<strong className="font-medium text-zinc-400">同一个 Workspace</strong>（邀请码/邀请链接）；</li>
          <li>对方也要<strong className="font-medium text-zinc-400">导入或 push 自己的仓库</strong>，否则你搜不到；</li>
          <li>
            双方在各自 Cursor / Claude 里配置{" "}
            <strong className="font-medium text-zinc-400">MCP + Context Token</strong>（控制台「高级」有片段）。完整说明见{" "}
            <Link className="text-blue-400 underline" href="/settings/advanced/docs#collab-mainline">
              文档 · 协作主线
            </Link>
            。
          </li>
        </ul>
      </div>

      <p className="text-center text-[11px] text-zinc-600">
        开发者工具见{" "}
        <Link className="text-blue-400 underline" href="/settings/advanced/docs">
          高级文档
        </Link>
      </p>
    </div>
  );
}
