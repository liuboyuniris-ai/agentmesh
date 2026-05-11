"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  actorLabel: string;
  projectName: string;
  sourceType: string | null;
  kindLabel: string;
  detail: string | null;
  createdAt: string;
};

function sourceHint(st: string | null): string {
  switch (st) {
    case "git":
      return "Git repo";
    case "local":
      return "Local push";
    case "live_agent":
      return "Live";
    default:
      return st ?? "—";
  }
}

export function WorkspaceActivityFeed({
  wsId,
  headers,
  refreshSignal = 0,
}: {
  wsId: string;
  headers: Record<string, string>;
  /** Increment when parent refetches workspace so this list reloads. */
  refreshSignal?: number;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${wsId}/activity?limit=25`, {
      headers,
    });
    if (!res.ok) {
      setItems([]);
      setLoading(false);
      return;
    }
    const j = (await res.json()) as { items: Item[] };
    setItems(j.items ?? []);
    setLoading(false);
  }, [wsId, headers]);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  return (
    <section className="rounded-lg border border-zinc-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase text-zinc-500">
          Activity
        </h3>
        <button
          type="button"
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-900"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-zinc-600">
        Who triggered a <strong className="font-medium text-zinc-500">full re-index</strong> and
        when. The index is not a live mirror of the remote. See project cards and the readiness
        checklist for freshness.
      </p>
      {loading ? (
        <p className="mt-3 text-xs text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-600">
          No entries yet. Import or index a project to see activity here.
        </p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded border border-zinc-800/80 bg-zinc-950/40 p-2 text-[11px] leading-snug"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-medium text-zinc-300">{it.actorLabel}</span>
                <time className="shrink-0 text-[10px] text-zinc-500">
                  {new Date(it.createdAt).toLocaleString()}
                </time>
              </div>
              <div className="mt-0.5 text-zinc-400">
                <span className={it.kindLabel.toLowerCase().includes("fail") ? "text-amber-200/90" : ""}>
                  {it.kindLabel}
                </span>
                <span className="text-zinc-600"> · </span>
                <span className="text-zinc-300">{it.projectName}</span>
                <span className="text-zinc-600"> · </span>
                <span className="text-zinc-500">{sourceHint(it.sourceType)}</span>
              </div>
              {it.detail ? (
                <p className="mt-1 line-clamp-3 font-mono text-[10px] text-red-200/85">
                  {it.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
