import { prisma } from "@/lib/prisma";

const DETAIL_MAX = 2000;

export const ACTIVITY_KIND_INDEX_READY = "project_index_ready";
export const ACTIVITY_KIND_INDEX_ERROR = "project_index_error";

async function createRow(params: {
  workspaceId: string;
  actorUserId: string;
  projectId: string;
  projectName: string;
  sourceType: string | null;
  kind: string;
  detail?: string | null;
}) {
  try {
    const delegate = prisma.workspaceActivity;
    if (!delegate?.create) {
      console.warn(
        "[workspaceActivity] Prisma client missing workspaceActivity; run `npx prisma generate` and apply migrations."
      );
      return;
    }
    await delegate.create({
      data: {
        workspaceId: params.workspaceId,
        actorUserId: params.actorUserId,
        projectId: params.projectId,
        projectName: params.projectName.slice(0, 256),
        sourceType: params.sourceType,
        kind: params.kind,
        detail:
          params.detail && params.detail.length > 0
            ? params.detail.slice(0, DETAIL_MAX)
            : null,
      },
    });

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    void delegate
      .deleteMany({
        where: {
          workspaceId: params.workspaceId,
          createdAt: { lt: cutoff },
        },
      })
      .catch(() => {
        /* ignore */
      });
  } catch (e) {
    console.warn("[workspaceActivity] record failed:", e);
  }
}

/** Call when `runFullProjectIndex` finishes successfully (`ready`). */
export async function recordProjectIndexReady(projectId: string): Promise<void> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      workspaceId: true,
      ownerUserId: true,
      id: true,
      name: true,
      sourceType: true,
    },
  });
  if (!p) return;
  await createRow({
    workspaceId: p.workspaceId,
    actorUserId: p.ownerUserId,
    projectId: p.id,
    projectName: p.name,
    sourceType: p.sourceType,
    kind: ACTIVITY_KIND_INDEX_READY,
    detail: null,
  });
}

/** Call when indexing fails after `project` row exists. */
export async function recordProjectIndexError(
  projectId: string,
  detail: string
): Promise<void> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      workspaceId: true,
      ownerUserId: true,
      id: true,
      name: true,
      sourceType: true,
    },
  });
  if (!p) return;
  await createRow({
    workspaceId: p.workspaceId,
    actorUserId: p.ownerUserId,
    projectId: p.id,
    projectName: p.name,
    sourceType: p.sourceType,
    kind: ACTIVITY_KIND_INDEX_ERROR,
    detail,
  });
}
