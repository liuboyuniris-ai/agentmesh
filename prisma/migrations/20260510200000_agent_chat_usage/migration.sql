-- CreateTable
CREATE TABLE "AgentChatThread" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolCallId" TEXT,
    "toolPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentUsageLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentUsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentChatThread_workspaceId_userId_idx" ON "AgentChatThread"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "AgentChatMessage_threadId_idx" ON "AgentChatMessage"("threadId");

-- CreateIndex
CREATE INDEX "AgentUsageLedger_userId_createdAt_idx" ON "AgentUsageLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentUsageLedger_workspaceId_createdAt_idx" ON "AgentUsageLedger"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentChatThread" ADD CONSTRAINT "AgentChatThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentChatMessage" ADD CONSTRAINT "AgentChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
