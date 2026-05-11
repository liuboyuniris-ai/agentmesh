-- Magic-link fields for WorkspaceInvite
ALTER TABLE "WorkspaceInvite" ADD COLUMN "acceptTokenHash" TEXT;
ALTER TABLE "WorkspaceInvite" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "WorkspaceInvite_acceptTokenHash_key" ON "WorkspaceInvite"("acceptTokenHash");

-- Device authorization (extension pairing)
CREATE TABLE "DeviceAuthSession" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "userId" TEXT,
    "workspaceId" TEXT,
    "contextToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceAuthSession_deviceCodeHash_key" ON "DeviceAuthSession"("deviceCodeHash");
CREATE UNIQUE INDEX "DeviceAuthSession_userCode_key" ON "DeviceAuthSession"("userCode");
