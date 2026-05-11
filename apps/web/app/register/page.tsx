"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { safeNextPath } from "@/lib/http/safeNextPath";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const emailFromQuery = searchParams.get("email")?.trim() ?? "";

  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [emailFromQuery]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim().toLowerCase(),
          password,
          email: email.trim() || undefined,
        }),
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

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <header>
        <h1 className="text-xl font-semibold">Register</h1>
        <p className="mt-1 text-xs text-zinc-500">
          You’ll be signed in after registering. Your{" "}
          <strong className="font-medium text-zinc-400">handle</strong> is your AgentMesh
          username—others can invite you by it.
        </p>
      </header>

      {error ? (
        <p className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Handle (lowercase letter first, 3–32 chars)"
          autoComplete="username"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Password (≥6 characters)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="email"
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          placeholder="Email (optional; use invited address when joining via invite)"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          onClick={() => void submit()}
        >
          Register & sign in
        </button>
      </section>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-blue-400 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
