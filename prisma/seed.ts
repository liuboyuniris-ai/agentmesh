import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function token(n = 24) {
  return randomBytes(n).toString("hex");
}
function invite() {
  return randomBytes(5).toString("hex");
}

async function main() {
  await prisma.collaborationMessage.deleteMany();
  await prisma.task.deleteMany();
  await prisma.embeddingChunk.deleteMany();
  await prisma.contextEdge.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceInvite.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();

  await prisma.session.deleteMany();
  await prisma.oidcIdentity.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agentListing.deleteMany();
  await prisma.oAuthConnection.deleteMany();

  const demoHash = bcrypt.hashSync("demo", 10);

  await prisma.user.createMany({
    data: [
      {
        id: "alice",
        passwordHash: demoHash,
        displayName: "Alice",
      },
      {
        id: "bob",
        passwordHash: demoHash,
        displayName: "Bob",
      },
    ],
  });

  await prisma.agentListing.createMany({
    data: [
      {
        slug: "claude-code",
        name: "Claude Code",
        provider: "anthropic",
        description:
          "Anthropic Claude tuned for repository-wide edits and coding agents.",
        isPublished: true,
      },
      {
        slug: "gpt-codex",
        name: "GPT Codex",
        provider: "openai",
        description:
          "OpenAI coding agent integration for refactors, reviews, and codegen.",
        isPublished: true,
      },
      {
        slug: "cursor-agent",
        name: "Cursor Agent",
        provider: "cursor",
        description:
          "IDE-native agent loop with MCP tools for repo context and edits.",
        isPublished: true,
      },
    ],
  });

  const ws = await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      inviteCode: invite(),
    },
  });

  const aliceTok = token();
  const bobTok = token();

  await prisma.workspaceMember.createMany({
    data: [
      {
        workspaceId: ws.id,
        userId: "alice",
        displayName: "Alice",
        role: "owner",
        contextToken: aliceTok,
        agentConfig: {
          agent_id: "alice-agent",
          name: "Alice Agent",
          type: "claude",
          capabilities: ["frontend"],
        },
      },
      {
        workspaceId: ws.id,
        userId: "bob",
        displayName: "Bob",
        role: "member",
        contextToken: bobTok,
        agentConfig: {
          agent_id: "bob-agent",
          name: "Bob Agent",
          type: "openai",
          capabilities: ["backend"],
        },
      },
    ],
  });

  console.log("Seed OK:", {
    workspaceId: ws.id,
    inviteCode: ws.inviteCode,
    aliceToken: aliceTok,
    bobToken: bobTok,
    demoLogin: { handle: "alice", password: "demo" },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
