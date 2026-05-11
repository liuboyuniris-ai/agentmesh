import type { WorkspaceInvite } from "@prisma/client";

/** Whether the logged-in viewer may accept or decline this invite. */
export function inviteMatchesViewer(
  invite: Pick<WorkspaceInvite, "inviteeUserId" | "inviteeEmail">,
  userId: string,
  userEmail: string | null | undefined
): boolean {
  if (invite.inviteeUserId != null && invite.inviteeUserId === userId) {
    return true;
  }
  const want = invite.inviteeEmail?.trim().toLowerCase() ?? "";
  const have = userEmail?.trim().toLowerCase() ?? "";
  return Boolean(want && have && want === have);
}
