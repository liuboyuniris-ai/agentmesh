"use client";

import { useCallback, useEffect, useState } from "react";
import { describeIndexFreshness } from "@/lib/workspace/indexFreshness";

type Status = {
  indexingStatus: string;
  lastSyncedAt: string | null;
  indexError: string | null;
  name: string;
  sourceType: string;
};

export function ProjectSyncRow({
  wsId,
  projectId,
  headers,
  onRetry,
}: {
  wsId: string;
  projectId: string;
  headers: Record<string, string>;
  onRetry?: () => void;
}) {
  const [st, setSt] = useState<Status | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(
      `/api/workspaces/${wsId}/projects/${projectId}/status`,
      { headers }
    );
    if (!res.ok) return;
    setSt(await res.json());
  }, [wsId, projectId, headers]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!st) return;
    if (st.indexingStatus === "ready" || st.indexingStatus === "error") {
      return;
    }
    const id = setInterval(() => void fetchStatus(), 2500);
    return () => clearInterval(id);
  }, [st, fetchStatus]);

  async function retry() {
    await fetch(`/api/workspaces/${wsId}/projects/${projectId}/reindex`, {
      method: "POST",
      headers,
    });
    void fetchStatus();
    onRetry?.();
  }

  if (!st) {
    return (
      <div className="rounded border border-zinc-800 p-3 text-xs text-zinc-500">
        Loading sync status…
      </div>
    );
  }

  const color =
    st.indexingStatus === "ready"
      ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-100"
      : st.indexingStatus === "error"
        ? "border-red-900/60 bg-red-950/25 text-red-100"
        : st.indexingStatus === "indexing"
          ? "border-amber-900/50 bg-amber-950/20 text-amber-100"
          : "border-zinc-800 bg-zinc-950/40 text-zinc-300";

  const label =
    st.indexingStatus === "ready"
      ? "Ready"
      : st.indexingStatus === "error"
        ? "Sync failed"
        : st.indexingStatus === "indexing"
          ? "Indexing…"
          : "Waiting for sync…";

  const fr =
    st.indexingStatus === "ready"
      ? describeIndexFreshness({
          lastSyncedAt: st.lastSyncedAt,
          indexingStatus: st.indexingStatus,
          sourceType: st.sourceType,
        })
      : null;

  const frLineClass =
    fr?.tone === "stale"
      ? "text-amber-200/90"
      : fr?.tone === "aging"
        ? "text-amber-100/75"
        : fr?.tone === "fresh"
          ? "text-emerald-300/85"
          : "text-zinc-400";

  return (
    <div className={`rounded border p-3 text-sm ${color}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{st.name}</span>
        <span className="text-xs opacity-90">{label}</span>
      </div>
      {st.lastSyncedAt ? (
        <p className="mt-1 text-[11px] opacity-80">
          Last completed: {new Date(st.lastSyncedAt).toLocaleString()}
        </p>
      ) : null}
      {fr ? (
        <p className={`mt-1 text-[11px] leading-snug ${frLineClass}`}>{fr.line}</p>
      ) : null}
      {fr ? (
        <p className="mt-1 text-[10px] leading-snug text-zinc-500">{fr.hint}</p>
      ) : null}
      {st.indexError ? (
        <p className="mt-2 text-[11px] leading-relaxed opacity-95">
          {st.indexError}
        </p>
      ) : null}
      {st.indexingStatus === "error" && st.sourceType === "git" ? (
        <button
          type="button"
          className="mt-2 rounded border border-zinc-600 px-2 py-1 text-xs hover:bg-black/30"
          onClick={() => void retry()}
        >
          Retry sync
        </button>
      ) : null}
      {st.indexingStatus === "ready" && st.sourceType === "git" ? (
        <button
          type="button"
          className="mt-2 rounded border border-emerald-800/80 px-2 py-1 text-xs text-emerald-100/95 hover:bg-emerald-950/40"
          onClick={() => void retry()}
        >
          Pull latest from GitHub & re-index
        </button>
      ) : null}
    </div>
  );
}
