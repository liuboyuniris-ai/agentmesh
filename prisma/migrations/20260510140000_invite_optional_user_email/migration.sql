-- Allow email-only invites before the invitee registers
ALTER TABLE "WorkspaceInvite" ADD COLUMN "inviteeEmail" TEXT;

ALTER TABLE "WorkspaceInvite" ALTER COLUMN "inviteeUserId" DROP NOT NULL;

CREATE INDEX "WorkspaceInvite_inviteeEmail_status_idx" ON "WorkspaceInvite"("inviteeEmail", "status");
