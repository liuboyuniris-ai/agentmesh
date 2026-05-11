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
  if (tone === null || ageMs == null) {
    return {
      line: "Cloud index: completion time unknown (try refreshing).",
      hint:
        params.sourceType === "git"
          ? "To update: push → “Pull latest from GitHub & re-index” in the console."
          : "To update: push from your machine / use the VS Code extension.",
      tone: null,
    };
  }

  const hours = Math.round(ageMs / HOUR);
  const days = Math.floor(ageMs / DAY);
  const ageStr =
    hours < 48 ? `~${hours} hours ago` : `~${days} days ago`;

  const updateGit =
    "Snapshot, not live: push changes to GitHub first, then use “Pull latest from GitHub & re-index” here.";
  const updateLocal =
    "Snapshot, not live: after local edits run `agentmesh-sync push` or use the extension (optional sync-on-save).";
  const updateHint = params.sourceType === "git" ? updateGit : updateLocal;

  if (tone === "fresh") {
    return {
      line: `Cloud index is recent (updated ${ageStr}).`,
      hint: updateHint,
      tone: "fresh",
    };
  }
  if (tone === "aging") {
    return {
      line: `Cloud index has not been rebuilt for ${ageStr}; teammates may still see older content via MCP.`,
      hint: updateHint,
      tone: "aging",
    };
  }
  return {
    line: `Cloud index is ${ageStr} old—sync before relying on collaborative search.`,
    hint: updateHint,
    tone: "stale",
  };
}
