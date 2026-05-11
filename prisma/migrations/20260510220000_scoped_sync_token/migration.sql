-- CreateTable
CREATE TABLE "ScopedSyncToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScopedSyncToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScopedSyncToken_tokenHash_key" ON "ScopedSyncToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ScopedSyncToken_workspaceId_idx" ON "ScopedSyncToken"("workspaceId");

-- AddForeignKey
ALTER TABLE "ScopedSyncToken" ADD CONSTRAINT "ScopedSyncToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
