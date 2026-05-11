"use client";

import Link from "next/link";
import { PlatformIntegrationCards } from "@/components/PlatformIntegrationCards";

export function HomeIntegrations() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-medium text-zinc-300">三种入口：CLI · MCP · HTTP</h2>
      <p className="mt-1 text-xs text-zinc-500">
        与编辑器无关；MCP 为推荐的标准 Agent 读上下文方式。登录后 Dashboard
        会填入默认 Workspace；未登录可先看占位符或阅读{" "}
        <Link className="text-blue-400 underline" href="/settings/advanced/docs">
          高级文档
        </Link>
        。
      </p>
      <div className="mt-4">
        <PlatformIntegrationCards />
      </div>
    </div>
  );
}
