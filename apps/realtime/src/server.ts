import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { WebSocketServer } from "ws";
import { URL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import type Redis from "ioredis";
import { attachRedisBridge, workspaceChannel } from "./redis-bridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();
const SECRET = process.env.REALTIME_INTERNAL_SECRET ?? "dev-secret-change-me";

type Client = { ws: import("ws").WebSocket; workspaceId: string };

const clients = new Map<string, Set<Client>>();

function room(wsId: string) {
  if (!clients.has(wsId)) clients.set(wsId, new Set());
  return clients.get(wsId)!;
}

function broadcastLocal(wsId: string, raw: string) {
  for (const c of room(wsId)) {
    if (c.ws.readyState === 1) c.ws.send(raw);
  }
}

let publisher: Redis | null = null;
const redisUrl = process.env.REDIS_URL?.trim();
if (redisUrl) {
  const bridge = attachRedisBridge({
    url: redisUrl,
    onMessage(wsId, raw) {
      broadcastLocal(wsId, raw);
    },
  });
  publisher = bridge.publisher;
  console.log("[agentmesh-realtime] Redis Pub/Sub enabled");
}

function emitToWorkspace(wsId: string, raw: string) {
  if (publisher) {
    void publisher.publish(workspaceChannel(wsId), raw);
  } else {
    broadcastLocal(wsId, raw);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/health")) {
    res.writeHead(200);
    res.end("ok");
    return;
  }

  if (req.method === "POST" && req.url?.startsWith("/broadcast")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    const secret = req.headers["x-internal-secret"];
    if (secret !== SECRET) {
      res.writeHead(401);
      res.end("unauthorized");
      return;
    }
    try {
      const parsed = JSON.parse(body) as {
        workspaceId?: string;
        event?: unknown;
      };
      if (!parsed.workspaceId) {
        res.writeHead(400);
        res.end("missing workspaceId");
        return;
      }
      const base =
        parsed.event &&
        typeof parsed.event === "object" &&
        parsed.event !== null &&
        !Array.isArray(parsed.event)
          ? (parsed.event as Record<string, unknown>)
          : { payload: parsed.event };
      const payload = JSON.stringify({ ...base, ts: Date.now() });
      emitToWorkspace(parsed.workspaceId, payload);
      res.writeHead(200);
      res.end("ok");
    } catch {
      res.writeHead(400);
      res.end("bad json");
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "", "http://localhost");
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const wsId = url.searchParams.get("workspaceId");
  const token = url.searchParams.get("token");
  if (!wsId || !token) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, async (ws) => {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: wsId, contextToken: token },
    });
    if (!member) {
      ws.close(4403, "forbidden");
      return;
    }

    const entry: Client = { ws, workspaceId: wsId };
    room(wsId).add(entry);

    ws.send(JSON.stringify({ type: "connected", workspaceId: wsId }));

    ws.on("message", (data) => {
      const raw =
        typeof data === "string"
          ? data
          : Buffer.isBuffer(data)
            ? data.toString("utf8")
            : String(data);
      emitToWorkspace(wsId, raw);
    });

    ws.on("close", () => {
      room(wsId).delete(entry);
    });
  });
});

const PORT = Number(process.env.PORT ?? 4001);
server.listen(PORT, () => {
  console.log(`[agentmesh-realtime] ws+broadcast http://127.0.0.1:${PORT}`);
});
