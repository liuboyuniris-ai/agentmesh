#!/usr/bin/env node
import process from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiBase =
  process.env.AGENTMESH_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";
const wsId = process.env.AGENTMESH_WORKSPACE_ID ?? "";
const token = process.env.AGENTMESH_TOKEN ?? "";

if (!wsId || !token) {
  console.error(
    "Missing AGENTMESH_WORKSPACE_ID or AGENTMESH_TOKEN environment variables."
  );
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const server = new McpServer({
  name: "agentmesh-mcp",
  version: "0.2.0",
});

server.registerTool(
  "agentmesh_query_context",
  {
    description:
      "Workspace-wide semantic retrieval over authorized ProjectContext indexes (pgvector-backed when enabled).",
    inputSchema: {
      query: z.string().describe("Natural language query"),
      top_k: z.number().int().min(1).max(20).optional(),
      task_id: z.string().optional(),
      project_ids: z.array(z.string()).optional(),
    },
  },
  async (args) => {
    const res = await fetch(
      `${apiBase}/api/workspaces/${wsId}/context/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: args.query,
          top_k: args.top_k ?? 5,
          task_id: args.task_id,
          project_ids: args.project_ids,
        }),
      }
    );
    const text = await res.text();
    return {
      content: [{ type: "text", text }],
      isError: !res.ok,
    };
  }
);

server.registerTool(
  "agentmesh_send_message",
  {
    description:
      "Post a structured v2 collaboration message (proposal, dependency_discovered, sync_request, …).",
    inputSchema: {
      type: z.string(),
      from: z.string().optional(),
      to: z.string().optional(),
      task_id: z.string().optional(),
      content: z.record(z.any()),
      requires_response: z.boolean().optional(),
    },
  },
  async (args) => {
    const res = await fetch(`${apiBase}/api/workspaces/${wsId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: args.type,
        from: args.from,
        to: args.to,
        task_id: args.task_id,
        content: args.content,
        requires_response: args.requires_response,
      }),
    });
    const text = await res.text();
    return {
      content: [{ type: "text", text }],
      isError: !res.ok,
    };
  }
);

server.registerTool(
  "agentmesh_broadcast_live_status",
  {
    description:
      "Publish LiveAgentStatus-style payload to the Workspace over HTTP (forwarded to WebSocket room).",
    inputSchema: {
      agent_id: z.string(),
      current_phase: z.enum([
        "reading",
        "planning",
        "implementing",
        "testing",
        "idle",
      ]),
      active_files: z.array(z.string()).optional(),
      current_task: z.string().optional(),
      blockers: z.array(z.string()).optional(),
    },
  },
  async (args) => {
    const res = await fetch(`${apiBase}/api/workspaces/${wsId}/live-status`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
    const text = await res.text();
    return {
      content: [{ type: "text", text }],
      isError: !res.ok,
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
