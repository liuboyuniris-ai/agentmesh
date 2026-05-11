"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { safeNextPath } from "@/lib/http/safeNextPath";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim().toLowerCase(), password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? (await res.text()));
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const ghErr = searchParams.get("github_error");

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <header>
        <h1 className="text-xl font-semibold">登录</h1>
        <p className="mt-1 text-xs text-zinc-500">
          登录后可管理 Workspace、接收邀请；同步项目可用 CLI / MCP / HTTP，与编辑器无关。
        </p>
      </header>

      {ghErr ? (
        <p className="rounded border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-100">
          GitHub 登录失败（{ghErr}）。请确认 GitHub App 的回调 URL 包含{" "}
          <code className="rounded bg-zinc-900 px-1">
            …/api/auth/github/callback
          </code>
          ，并已配置 <code className="rounded bg-zinc-900 px-1">GITHUB_CLIENT_*</code>。
        </p>
      ) : null}

      {error ? (
        <p className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">用户名与密码</h2>
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="AgentMesh 账号（小写 handle）"
          autoComplete="username"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          className="w-full rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
          onClick={() => void submit()}
        >
          登录
        </button>
        <p className="text-[11px] text-zinc-600">
          本地种子账号：<code className="rounded bg-zinc-900 px-1">alice</code> /{" "}
          <code className="rounded bg-zinc-900 px-1">demo</code>
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">第三方登录</h2>
        <p className="text-xs text-zinc-600">
          GitHub：授权后可使用与本站相同的 Client ID 完成登录，并用于后续在控制台「连接
          GitHub」克隆仓库（所需 scope 在 GitHub App 中配置）。
        </p>
        <div className="flex flex-col gap-2">
          <a
            className="rounded border border-zinc-600 px-3 py-2 text-center text-sm hover:bg-zinc-900"
            href={`/api/auth/github/signin/start?return_to=${encodeURIComponent(next)}`}
          >
            使用 GitHub 登录并授权
          </a>
          <a
            className="rounded border border-zinc-600 px-3 py-2 text-center text-sm hover:bg-zinc-900"
            href="/api/auth/oidc/start"
          >
            使用 Google / OIDC 登录
          </a>
        </div>
        <p className="text-[11px] text-zinc-600">
          Google：请在环境变量中配置{" "}
          <code className="rounded bg-zinc-900 px-1">OIDC_ISSUER=https://accounts.google.com</code>{" "}
          及 <code className="rounded bg-zinc-900 px-1">OIDC_CLIENT_*</code>，回调为{" "}
          <code className="rounded bg-zinc-900 px-1">/api/auth/oidc/callback</code>。
        </p>
      </section>

      <p className="text-center text-sm text-zinc-500">
        还没有账号？{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-blue-400 underline">
          注册
        </Link>
        {" · "}
        <Link href="/settings/advanced/docs" className="text-blue-400 underline">
          高级文档
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">加载中…</div>}>
      <LoginForm />
    </Suspense>
  );
}
