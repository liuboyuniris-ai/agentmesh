const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Age in ms since last successful index; null if unknown. */
export function indexAgeMs(lastSyncedAt: string | null | undefined): number | null {
  if (!lastSyncedAt) return null;
  const t = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Date.now() - t);
}

export type FreshnessTone = "fresh" | "aging" | "stale";

export function freshnessTone(ageMs: number | null): FreshnessTone | null {
  if (ageMs == null) return null;
  if (ageMs < DAY) return "fresh";
  if (ageMs < 3 * DAY) return "aging";
  return "stale";
}

/** Short label + CSS hint for project cards / sync rows. */
export function describeIndexFreshness(params: {
  lastSyncedAt: string | null | undefined;
  indexingStatus: string;
  sourceType?: string | null;
}): { line: string; hint: string; tone: FreshnessTone | null } | null {
  if (params.indexingStatus !== "ready") return null;
  const ageMs = indexAgeMs(params.lastSyncedAt);
  const tone = freshnessTone(ageMs);
  if (tone === null) {
    return {
      line: "云端索引：完成时间未知（可刷新后重试）。",
      hint:
        params.sourceType === "git"
          ? "更新流程：push → 控制台「从 GitHub 拉取最新并重新索引」。"
          : "更新流程：本机 push / 扩展同步。",
      tone: null,
    };
  }

  const hours = Math.round(ageMs / HOUR);
  const days = Math.floor(ageMs / DAY);
  const ageStr =
    hours < 48 ? `约 ${hours} 小时前` : `约 ${days} 天前`;

  const updateGit =
    "当前为快照，不是实时：请先将改动 push 到 GitHub，再在此处「从 GitHub 拉取最新并重新索引」。";
  const updateLocal =
    "当前为快照，不是实时：改代码后请在本机 `agentmesh-sync push` 或用扩展 Push（可开保存即同步）。";
  const updateHint = params.sourceType === "git" ? updateGit : updateLocal;

  if (tone === "fresh") {
    return {
      line: `云端索引较新（${ageStr} 更新）。`,
      hint: updateHint,
      tone: "fresh",
    };
  }
  if (tone === "aging") {
    return {
      line: `云端索引已有 ${ageStr} 未重建；队友 MCP 可能仍看到旧内容。`,
      hint: updateHint,
      tone: "aging",
    };
  }
  return {
    line: `云端索引已 ${ageStr} 未更新，强烈建议同步后再协作检索。`,
    hint: updateHint,
    tone: "stale",
  };
}
