import type { AgentMessageV2, LiveAgentStatus } from "@agentmesh/protocol";

export type AgentMeshClientOptions = {
  apiBaseUrl: string;
  wsBaseUrl: string;
  workspaceId: string;
  token: string;
  agentName?: string;
  projectPath?: string;
};

export class AgentMeshClient {
  private ws: import("ws").WebSocket | null = null;
  private opts: AgentMeshClientOptions;

  constructor(opts: AgentMeshClientOptions) {
    this.opts = opts;
  }

  /** Node / Cursor MCP runtime: opens WebSocket to realtime server. Browser: use native WebSocket. */
  async connect(): Promise<void> {
    const WebSocketImpl = await loadWs();
    const url = `${this.opts.wsBaseUrl}/ws?workspaceId=${encodeURIComponent(this.opts.workspaceId)}&token=${encodeURIComponent(this.opts.token)}`;
    this.ws = new WebSocketImpl(url) as import("ws").WebSocket;
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error("ws missing"));
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
    });
  }

  broadcastStatus(status: LiveAgentStatus): void {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(
      JSON.stringify({ type: "member_agent_status", payload: status })
    );
  }

  async queryContext(body: {
    query: string;
    scope?: string;
    top_k?: number;
  }): Promise<unknown> {
    const res = await fetch(
      `${this.opts.apiBaseUrl}/api/workspaces/${this.opts.workspaceId}/context/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.token}`,
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async sendMessage(msg: Omit<AgentMessageV2, "message_id" | "timestamp">): Promise<unknown> {
    const res = await fetch(
      `${this.opts.apiBaseUrl}/api/workspaces/${this.opts.workspaceId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.opts.token}`,
        },
        body: JSON.stringify(msg),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}

async function loadWs(): Promise<(typeof import("ws"))["default"]> {
  const mod = await import("ws");
  return mod.default;
}
