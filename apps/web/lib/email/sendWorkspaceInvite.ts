export type SendWorkspaceInviteArgs = {
  toEmail: string;
  acceptUrl: string;
  workspaceName: string;
  inviterLabel: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/**
 * Optional Resend integration. Without RESEND_API_KEY, returns sent: false (inviter may use devAcceptUrl from API).
 */
export async function sendWorkspaceInviteEmail(
  args: SendWorkspaceInviteArgs
): Promise<{ sent: boolean; skippedReason?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM?.trim() ?? "AgentMesh <onboarding@resend.dev>";

  if (!key) {
    return { sent: false, skippedReason: "no_resend_api_key" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.toEmail],
      subject: `Invitation to ${args.workspaceName} on AgentMesh`,
      html: `<p>${escapeHtml(args.inviterLabel)} invited you to workspace <strong>${escapeHtml(args.workspaceName)}</strong>.</p><p><a href="${escapeHtml(args.acceptUrl)}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("[invite-email] Resend error", res.status, t);
    return { sent: false, skippedReason: "resend_failed" };
  }

  return { sent: true };
}
