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
        协作检索 · 就绪检查
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        MCP 只能搜<strong className="font-medium text-zinc-400">本 Workspace 里已进云并完成索引</strong>
        的内容；下面三项需同时就绪，否则容易觉得「搜不到队友代码」。
      </p>
      <ul className="mt-3 space-y-2">
        <Row ok>
          你已在本 Workspace（无需额外操作）。
        </Row>
        <Row ok={myReady}>
          {myReady ? (
            <>你至少有一个项目<strong className="font-medium text-zinc-400">索引 ready</strong>，可被检索。</>
          ) : (
            <>
              你还需要一个 <strong className="font-medium text-zinc-400">ready</strong> 的项目。
              {myPending ? " 有项目仍在索引或失败，请查看下方卡片。" : null}{" "}
              <Link className="text-emerald-400 underline" href={`/workspace/${wsId}?onboarding=1`}>
                去导入或推送
              </Link>
              。
            </>
          )}
        </Row>
        <Row ok={othersReady.length > 0}>
          {othersReady.length > 0 ? (
            <>
              其他成员共有{" "}
              <strong className="font-medium text-zinc-400">{othersReady.length}</strong>{" "}
              个已共享且 ready 的项目可供检索
              {othersTotal.length > othersReady.length
                ? `（另有 ${othersTotal.length - othersReady.length} 个尚未 ready）`
                : ""}
              。
              {staleOthers.length > 0 ? (
                <span className="ml-1 text-amber-200/85">
                  其中 {staleOthers.length} 个索引较旧，对方更新后需再同步。
                </span>
              ) : null}
            </>
          ) : (
            <>
              目前<strong className="font-medium text-zinc-400">没有</strong>其他成员的 ready
              共享项目——对方需导入或 push，且关闭共享会搜不到。
            </>
          )}
        </Row>
        <Row ok={hasToken}>
          {hasToken ? (
            <>
              已为你颁发 Context Token（展开「高级」可复制）。请在 Cursor / Claude 里配置{" "}
              <strong className="font-medium text-zinc-400">MCP</strong>，否则 Agent 不会自动查云。
              <Link className="ml-1 text-violet-400 underline" href="/settings/advanced/docs#collab-mainline">
                协作主线
              </Link>
            </>
          ) : (
            <>
              未检测到 Context Token，无法代表你调用 MCP。请确认已登录且为本空间成员。
            </>
          )}
        </Row>
      </ul>
    </section>
  );
}
