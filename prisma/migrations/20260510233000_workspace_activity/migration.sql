-- CreateTable
CREATE TABLE "WorkspaceActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "sourceType" TEXT,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceActivity_workspaceId_createdAt_idx" ON "WorkspaceActivity"("workspaceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
