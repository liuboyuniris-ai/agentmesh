"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Phase =
  | "idle"
  | "checking"
  | "accepting"
  | "redirect_register"
  | "redirect_login"
  | "ok"
  | "err";

function InviteAcceptInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const t = token?.trim();
    if (!t) {
      setPhase("err");
      setMessage("Invalid link: missing token.");
      return;
    }

    let cancelled = false;

    void (async () => {
      setPhase("checking");
      const sessionRes = await fetch("/api/auth/session", {
        credentials: "include",
      });
      const sessionJson = (await sessionRes.json().catch(() => ({}))) as {
        user?: { id: string } | null;
      };
      const loggedIn = Boolean(sessionJson.user?.id);

      if (!loggedIn) {
        const metaRes = await fetch(
          `/api/invites/token-meta?token=${encodeURIComponent(t)}`,
          { credentials: "include" }
        );
        const metaText = await metaRes.text();
        if (cancelled) return;
        if (!metaRes.ok) {
          setPhase("err");
          try {
            const j = JSON.parse(metaText) as { error?: string };
            setMessage(j.error ?? metaText.slice(0, 200));
          } catch {
            setMessage(metaText.slice(0, 200));
          }
          return;
        }
        const meta = JSON.parse(metaText) as {
          inviteeEmail: string | null;
          accountExists: boolean;
        };
        const next = `/invite/accept?token=${encodeURIComponent(t)}`;
        if (meta.accountExists) {
          setPhase("redirect_login");
          window.location.assign(
            `/login?next=${encodeURIComponent(next)}`
          );
          return;
        }
        const q = new URLSearchParams();
        q.set("next", next);
        if (meta.inviteeEmail) {
          q.set("email", meta.inviteeEmail);
        }
        setPhase("redirect_register");
        window.location.assign(`/register?${q.toString()}`);
        return;
      }

      setPhase("accepting");
      const res = await fetch("/api/invites/accept-by-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const bodyText = await res.text();
      if (cancelled) return;
      if (res.ok) {
        try {
          const j = JSON.parse(bodyText) as { workspaceId?: string };
          const wid = j.workspaceId ?? null;
          setWorkspaceId(wid);
          setPhase("ok");
          setMessage("Joined the workspace—redirecting…");
          if (wid) {
            router.replace(`/workspace/${wid}`);
          }
        } catch {
          setPhase("ok");
          setMessage("Joined the workspace.");
        }
        return;
      }
      setPhase("err");
      try {
        const j = JSON.parse(bodyText) as { error?: string };
        if (j.error === "wrong_account") {
          setMessage(
            "Signed-in account doesn’t match this invite. Sign out and use the account from the email."
          );
        } else {
          setMessage(j.error ?? bodyText.slice(0, 200));
        }
      } catch {
        setMessage(bodyText.slice(0, 200));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 p-8 text-zinc-200">
      <h1 className="text-lg font-semibold">Workspace invite</h1>
      {(phase === "checking" ||
        phase === "accepting" ||
        phase === "redirect_register" ||
        phase === "redirect_login") && (
        <p className="text-sm text-zinc-400">Working…</p>
      )}
      {phase === "ok" ? (
        <p className="text-sm text-emerald-400">{message}</p>
      ) : null}
      {phase === "err" ? (
        <p className="text-sm text-red-400">{message}</p>
      ) : null}
      {phase === "ok" && workspaceId ? (
        <Link
          className="text-sm text-blue-400 underline"
          href={`/workspace/${workspaceId}`}
        >
          If you weren’t redirected, open the workspace console
        </Link>
      ) : null}
      <Link className="text-xs text-zinc-500 underline" href="/dashboard">
        Back to Dashboard
      </Link>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading…</div>}>
      <InviteAcceptInner />
    </Suspense>
  );
}
