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
        "GitHub connected: importing from GitHub in the workspace UI will use your OAuth token."
      );
    }
    const ge = p.get("github_error");
    if (ge) {
      setOauthBanner(
        `GitHub connection failed (${ge}). Check that the callback URL includes /api/auth/github/callback.`
      );
    }
    if (p.get("oidc") === "connected") {
      setOauthBanner("Signed in with Google / OIDC.");
    }
    const oe = p.get("oidc_error");
    if (oe) {
      setOauthBanner(`OIDC sign-in failed (${oe}). Verify IdP and OIDC_CLIENT_* settings.`);
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
    setOauthBanner("Disconnected GitHub OAuth.");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-xs text-zinc-500">
            Signed in as <code className="rounded bg-zinc-900 px-1">{actorId}</code>. Main path:
            create a workspace → connect GitHub → pick a repo to import (no manual token setup).
            Developer tools:{" "}
            <Link className="text-blue-400 underline" href="/settings/advanced/docs">
              docs
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
          onClick={() => void logout()}
        >
          Log out
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
        <h2 className="text-sm font-medium text-emerald-200">Bring your code in</h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          After you click <strong className="text-zinc-400">+</strong> to create a workspace you’ll
          be guided: connect GitHub and pick a repo—we clone and index it. For teams: everyone
          joins the same workspace, each imports/syncs their own repos, and each configures{" "}
          <strong className="font-medium text-zinc-400">MCP</strong> in their editor so agents can
          search what’s already in the cloud (see{" "}
          <Link className="text-emerald-400 underline" href="/settings/advanced/docs#collab-mainline">
            collaboration guide
          </Link>
          ).
        </p>
        <p className="text-xs text-zinc-600">
          CLI, HTTP, and MCP snippets: expand “Advanced · developer integrations” below or open the
          full docs.
        </p>
      </section>

      <details className="rounded-lg border border-zinc-800 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-400">
          Advanced · developer integrations (CLI / MCP / HTTP)
        </summary>
        <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
          <PlatformIntegrationCards workspaceId={rows[0]?.workspaceId ?? null} />
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex rounded border border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
              href="/settings/advanced/docs"
            >
              Full developer docs
            </Link>
          </div>
        </div>
      </details>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">Inbox · workspace invites</h2>
        <p className="text-xs text-zinc-600">
          Others can invite your AgentMesh account (
          <code className="rounded bg-zinc-900 px-1">{actorId}</code>) to a workspace. Accept or
          decline here.
        </p>
        {invitations.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending invitations.</p>
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
                    From <code className="rounded bg-zinc-900 px-1">{inv.inviterUserId}</code>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
                    onClick={() => void acceptInvite(inv.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-900"
                    onClick={() => void declineInvite(inv.id)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">
          GitHub (connect to import repos from the web UI)
        </h2>
        <p className="text-xs leading-relaxed text-zinc-600">
          If you use the same GitHub OAuth app for “Sign in with GitHub”, register callback{" "}
          <code className="rounded bg-zinc-900 px-1">/api/auth/github/callback</code> in GitHub
          developer settings (used for both login and link token).
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            href={githubOAuthStartHref}
          >
            Connect GitHub (clone repos)
          </a>
          <button
            type="button"
            className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40"
            disabled={!github.connected}
            onClick={() => void disconnectGithub()}
          >
            Disconnect GitHub
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Status: {github.connected ? "Connected" : "Not connected"}
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
            <h2 className="text-sm font-medium text-violet-200">New workspace</h2>
            <p className="mt-1 text-xs text-zinc-500">Use the + button below.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
          />
          <button
            type="button"
            title="Create workspace"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-light leading-none text-white hover:bg-blue-500"
            onClick={() => void createWs()}
          >
            +
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">Join with invite code</h2>
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
            Join
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">My workspaces</h2>
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
                Open console
              </Link>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">
              None yet. Create one with + above, or ask a teammate to invite this account.
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
        <div className="mx-auto max-w-4xl p-8 text-zinc-400">Loading…</div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
