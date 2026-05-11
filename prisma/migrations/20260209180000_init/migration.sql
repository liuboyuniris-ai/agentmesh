-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "agentConfig" JSONB NOT NULL DEFAULT '{}',
    "contextToken" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "summary" TEXT,
    "fileTree" JSONB,
    "modules" JSONB,
    "exposedInterfaces" JSONB,
    "vectorNamespace" TEXT,
    "sharingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fileTreeShared" BOOLEAN NOT NULL DEFAULT true,
    "snippetsShared" BOOLEAN NOT NULL DEFAULT true,
    "indexingStatus" TEXT NOT NULL DEFAULT 'pending',
    "indexError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddingChunk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "excerpt" TEXT NOT NULL,
    "embedding" JSONB,

    CONSTRAINT "EmbeddingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextEdge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromProjectId" TEXT NOT NULL,
    "toProjectId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "discoveredBy" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'context_discovery',
    "state" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromAgent" TEXT NOT NULL,
    "toTarget" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_inviteCode_key" ON "Workspace"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_contextToken_key" ON "WorkspaceMember"("contextToken");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_vectorNamespace_key" ON "Project"("vectorNamespace");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_ownerUserId_idx" ON "Project"("ownerUserId");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_projectId_idx" ON "EmbeddingChunk"("projectId");

-- CreateIndex
CREATE INDEX "ContextEdge_workspaceId_idx" ON "ContextEdge"("workspaceId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationMessage_messageId_key" ON "CollaborationMessage"("messageId");

-- CreateIndex
CREATE INDEX "CollaborationMessage_workspaceId_taskId_idx" ON "CollaborationMessage"("workspaceId", "taskId");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddingChunk" ADD CONSTRAINT "EmbeddingChunk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextEdge" ADD CONSTRAINT "ContextEdge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationMessage" ADD CONSTRAINT "CollaborationMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

