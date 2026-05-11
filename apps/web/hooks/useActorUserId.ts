"use client";

import { useEffect, useMemo, useState } from "react";

const fallback =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_DEV_USER_ID ?? "alice"
    : "alice";

/**
 * Server resolves cookie sessions first; this keeps dev headers aligned when logged in.
 */
export function useActorUserId(): string {
  const [id, setId] = useState(fallback);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = (await res.json()) as {
          user: { id: string } | null;
        };
        if (data.user?.id) setId(data.user.id);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return id;
}

export function useJsonHeaders(): Record<string, string> {
  const id = useActorUserId();
  return useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-User-Id": id,
    }),
    [id]
  );
}
