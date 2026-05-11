export async function broadcastWorkspaceEvent(
  workspaceId: string,
  event: Record<string, unknown>
): Promise<void> {
  const url =
    process.env.REALTIME_BROADCAST_URL ?? "http://127.0.0.1:4001/broadcast";
  const secret = process.env.REALTIME_INTERNAL_SECRET;
  if (!secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ workspaceId, event }),
    });
  } catch {
    /* realtime optional during dev */
  }
}
