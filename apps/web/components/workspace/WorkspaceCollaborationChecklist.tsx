"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { describeIndexFreshness } from "@/lib/workspace/indexFreshness";

type Project = {
  id: string;
  name: string;
  indexingStatus: string;
  ownerUserId: string;
  lastSyncedAt: string | null;
  sharingEnabled?: boolean;
  sourceType?: string;
};

type Props = {
  wsId: string;
  viewerUserId?: string;
  myContextToken?: string | null;
  projects: Project[];
};

export function WorkspaceCollaborationChecklist({
  wsId,
  viewerUserId,
  myContextToken,
  projects,
}: Props) {
  const viewer = viewerUserId ?? "";
  const myReady = projects.some(
    (p) =>
      p.ownerUserId === viewer && p.indexingStatus === "ready"
  );
  const myPending = projects.some(
    (p) => p.ownerUserId === viewer && p.indexingStatus !== "ready"
  );
  const othersReady = projects.filter(
    (p) =>
      p.ownerUserId !== viewer &&
      p.indexingStatus === "ready" &&
      p.sharingEnabled !== false
  );
  const othersTotal = projects.filter((p) => p.ownerUserId !== viewer);
  const hasToken = Boolean(myContextToken?.trim());

  const staleOthers = othersReady.filter((p) => {
    const d = describeIndexFreshness({
      lastSyncedAt: p.lastSyncedAt,
      indexingStatus: p.indexingStatus,
      sourceType: p.sourceType,
    });
    return d?.tone === "stale" || d?.tone === "aging";
  });

  function Row({
    ok,
    children,
  }: {
    ok: boolean;
    children: ReactNode;
  }) {
    return (
      <li className="flex gap-2 text-[12px] leading-snug text-zinc-400">
        <span className="shrink-0 font-medium" aria-hidden>
          {ok ? "✓" : "○"}
        </span>
        <span className={ok ? "text-zinc-300" : ""}>{children}</span>
      </li>
    );
  }

  return (
    <section className="rounded-lg border border-emerald-900/35 bg-emerald-950/15 p-4">
      <h2 className="text-sm font-medium text-emerald-200/95">
        Collaborative search · readiness
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        MCP only searches{" "}
        <strong className="font-medium text-zinc-400">
          content that is in this workspace and fully indexed
        </strong>
        . All three items below should be true; otherwise it feels like “I can’t find my teammate’s
        code.”
      </p>
      <ul className="mt-3 space-y-2">
        <Row ok>
          You are a member of this workspace (nothing else required).
        </Row>
        <Row ok={myReady}>
          {myReady ? (
            <>
              You have at least one project with a <strong className="font-medium text-zinc-400">ready</strong>{" "}
              index that can be searched.
            </>
          ) : (
            <>
              You still need a <strong className="font-medium text-zinc-400">ready</strong> project.
              {myPending
                ? " Some projects are still indexing or failed—see the cards below. "
                : " "}
              <Link className="text-emerald-400 underline" href={`/workspace/${wsId}?onboarding=1`}>
                Import or push
              </Link>
              .
            </>
          )}
        </Row>
        <Row ok={othersReady.length > 0}>
          {othersReady.length > 0 ? (
            <>
              Other members share{" "}
              <strong className="font-medium text-zinc-400">{othersReady.length}</strong> project(s)
              that are <strong className="font-medium text-zinc-400">ready</strong> and searchable
              {othersTotal.length > othersReady.length
                ? ` (${othersTotal.length - othersReady.length} not ready yet)`
                : ""}
              .
              {staleOthers.length > 0 ? (
                <span className="ml-1 text-amber-200/85">
                  {staleOthers.length} index(es) are stale—ask them to sync after updates.
                </span>
              ) : null}
            </>
          ) : (
            <>
              There are <strong className="font-medium text-zinc-400">no</strong> shared{" "}
              <strong className="font-medium text-zinc-400">ready</strong> projects from other
              members—they need to import or push. If they turn off sharing, MCP won’t return that
              project.
            </>
          )}
        </Row>
        <Row ok={hasToken}>
          {hasToken ? (
            <>
              A Context Token was issued (open <strong>Advanced</strong> on the workspace page to
              copy it). Configure <strong className="font-medium text-zinc-400">MCP</strong> in
              Cursor / Claude; otherwise the agent will not query the cloud automatically.{" "}
              <Link className="ml-1 text-violet-400 underline" href="/settings/advanced/docs#collab-mainline">
                Collaboration guide
              </Link>
            </>
          ) : (
            <>
              No Context Token detected—you can’t call MCP on your behalf. Make sure you are logged
              in and are a member of this workspace.
            </>
          )}
        </Row>
      </ul>
    </section>
  );
}
