-- OAuthConnection.metadata for OIDC issuer / scopes

ALTER TABLE "OAuthConnection" ADD COLUMN "metadata" JSONB;
