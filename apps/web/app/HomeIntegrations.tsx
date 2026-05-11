"use client";

import Link from "next/link";
import { PlatformIntegrationCards } from "@/components/PlatformIntegrationCards";

export function HomeIntegrations() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-medium text-zinc-300">Three entry points: CLI · MCP · HTTP</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Editor-agnostic; MCP is the recommended standard for agents. After sign-in the Dashboard fills
        a default workspace; without sign-in you’ll see placeholders or can read the{" "}
        <Link className="text-blue-400 underline" href="/settings/advanced/docs">
          developer docs
        </Link>
        .
      </p>
      <div className="mt-4">
        <PlatformIntegrationCards />
      </div>
    </div>
  );
}
