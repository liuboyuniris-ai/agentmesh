import Redis from "ioredis";

const CHANNEL_PREFIX = "workspace:";
const CHANNEL_SUFFIX = ":events";

export type RedisPublisher = Pick<Redis, "publish">;

export function workspaceChannel(workspaceId: string): string {
  return `${CHANNEL_PREFIX}${workspaceId}${CHANNEL_SUFFIX}`;
}

/** Subscriber receives `{ workspaceId, message }` for each Redis message. */
export function attachRedisBridge(params: {
  url: string;
  onMessage: (workspaceId: string, raw: string) => void;
}): { publisher: Redis; subscriber: Redis } {
  const publisher = new Redis(params.url, { lazyConnect: false });
  const subscriber = new Redis(params.url, { lazyConnect: false });

  subscriber.psubscribe(`${CHANNEL_PREFIX}*${CHANNEL_SUFFIX}`, (err) => {
    if (err) console.error("[agentmesh-realtime] redis psubscribe error", err);
  });

  subscriber.on(
    "pmessage",
    (_pattern: string, channel: string, message: string) => {
      const inner = channel.slice(
        CHANNEL_PREFIX.length,
        channel.length - CHANNEL_SUFFIX.length
      );
      if (!inner) return;
      params.onMessage(inner, message);
    }
  );

  return { publisher, subscriber };
}
