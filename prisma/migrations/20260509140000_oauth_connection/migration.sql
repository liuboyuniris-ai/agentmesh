-- OAuth tokens per dev user id (X-User-Id); MVP stores plaintext access token — encrypt at rest for production.

CREATE TABLE "OAuthConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthConnection_userId_provider_key" ON "OAuthConnection"("userId", "provider");

CREATE INDEX "OAuthConnection_userId_idx" ON "OAuthConnection"("userId");
