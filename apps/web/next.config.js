const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Monorepo: load repo-root `.env` (same as Prisma). Next first loads only `apps/web`,
// then sets __NEXT_PROCESSED_ENV — a second loadEnvConfig would no-op unless override=true.
const repoRoot = path.resolve(__dirname, "../..");
const isDev = process.env.NODE_ENV !== "production";
loadEnvConfig(repoRoot, isDev, console, true);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@agentmesh/protocol", "@agentmesh/sdk"],
};

module.exports = nextConfig;
