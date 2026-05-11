/**
 * Full `mcp_config.json`-shaped payloads for Cursor / Antigravity (stdio MCP).
 */
export function buildMcpConfigObject(params: {
  apiBaseUrl: string;
  workspaceId: string;
  token: string;
  launch:
    | { mode: "npx" }
    | { mode: "node"; distPath: string };
}): {
  mcpServers: {
    agentmesh: {
      command: string;
      args: string[];
      env: Record<string, string>;
    };
  };
} {
  const env = {
    AGENTMESH_API_BASE_URL: params.apiBaseUrl.replace(/\/$/, ""),
    AGENTMESH_WORKSPACE_ID: params.workspaceId,
    AGENTMESH_TOKEN: params.token,
  };

  if (params.launch.mode === "npx") {
    return {
      mcpServers: {
        agentmesh: {
          command: "npx",
          args: ["-y", "@agentmesh/mcp-server"],
          env,
        },
      },
    };
  }

  return {
    mcpServers: {
      agentmesh: {
        command: "node",
        args: [params.launch.distPath],
        env,
      },
    },
  };
}

export function buildMcpConfigJsonString(
  params: Parameters<typeof buildMcpConfigObject>[0]
): string {
  return `${JSON.stringify(buildMcpConfigObject(params), null, 2)}\n`;
}

/** Obvious placeholder for monorepo dev before user edits path. */
export const NODE_DIST_PLACEHOLDER =
  "/ABSOLUTE/PATH/TO/multiagent/packages/mcp-server/dist/index.js";
