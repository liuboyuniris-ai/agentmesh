import Link from "next/link";
import { PlatformIntegrationCards } from "@/components/PlatformIntegrationCards";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-12 px-6 py-10 pb-20">
      <header className="space-y-3">
        <p className="text-xs text-zinc-500">
          <Link className="text-blue-400 underline" href="/dashboard">
            ← Dashboard
          </Link>
          <span className="text-zinc-600"> · Advanced / developer docs (GitHub import is the main path)</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Using AgentMesh</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          <strong className="font-medium text-zinc-300">Editor-agnostic</strong>: after you sync code
          into a workspace, local agents can read{" "}
          <strong className="font-medium text-zinc-300">indexed snippets you’re allowed to see</strong>{" "}
          via <strong className="font-medium text-zinc-300">MCP</strong> or{" "}
          <strong className="font-medium text-zinc-300">HTTP</strong>, or push updates from your
          machine with the <strong className="font-medium text-zinc-300">CLI</strong>. For teams, read
          the{" "}
          <Link className="text-blue-400 underline" href="#collab-mainline">
            collaboration guide
          </Link>{" "}
          first.
        </p>
      </header>

      <section
        id="collab-mainline"
        className="scroll-mt-20 space-y-4 rounded-lg border border-violet-900/40 bg-violet-950/20 p-5"
      >
        <h2 className="text-lg font-medium text-violet-200">
          Collaboration: “see my teammate’s code in Cursor / Claude”
        </h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          MCP / HTTP only query{" "}
          <strong className="font-medium text-zinc-400">
            what is already synced and indexed in this workspace
          </strong>
          . If they never imported or pushed, you won’t find their files—that’s a data prerequisite,
          not a copy‑paste limitation.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
          <li>
            <strong className="font-medium text-zinc-200">Same workspace</strong>: invite teammates
            with the invite code or link.
          </li>
          <li>
            <strong className="font-medium text-zinc-200">Each syncs their own projects</strong>: everyone
            imports at least one repo, or runs{" "}
            <code className="rounded bg-zinc-900 px-1">agentmesh-sync push</code> / the VS Code
            extension, until the console shows <code className="rounded bg-zinc-900 px-1">ready</code>.
          </li>
          <li>
            <strong className="font-medium text-zinc-200">Configure MCP (or HTTP) each</strong>: copy
            the token and MCP block from the workspace <strong>Advanced</strong> panel—without it the
            agent falls back to manual paste.
          </li>
          <li>
            <strong className="font-medium text-zinc-200">Freshness</strong>: default is manual /
            semi‑automatic (re-import, push, extension “sync on save”). For “they just changed it”, both
            sides need a habit of <strong className="font-medium text-zinc-400">sync after edits</strong>{" "}
            or CI / scheduled jobs.
          </li>
        </ol>
        <p className="text-xs text-zinc-500">
          New projects default to searchable{" "}
          <code className="rounded bg-zinc-900 px-1">sharingEnabled</code> /{" "}
          <code className="rounded bg-zinc-900 px-1">snippetsShared</code>. If someone turns sharing off,
          MCP won’t return that project.
        </p>
      </section>

      <section id="quickstart" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-medium text-emerald-400">First success (shortest path)</h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          Goal: sync one local repo into a workspace and query it from an agent with minimal reading.
        </p>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-300">
          <li>
            <Link className="text-blue-400 underline" href="/login">
              Sign in
            </Link>
            , open{" "}
            <Link className="text-blue-400 underline" href="/dashboard">
              Dashboard
            </Link>
            , and enter your workspace <strong className="font-medium text-zinc-200">console</strong>.
          </li>
          <li>
            Open <strong className="font-medium text-zinc-200">Advanced</strong> in the console, copy the{" "}
            <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code> template and MCP sample
            locally; on the same page copy the <strong className="font-medium text-zinc-200">Context Token</strong>{" "}
            as <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code>.
          </li>
          <li>
            The Context Token is shared by MCP, HTTP{" "}
            <code className="rounded bg-zinc-900 px-1">context/query</code>, and CLI{" "}
            <code className="rounded bg-zinc-900 px-1">push</code> (never commit it).
          </li>
          <li>
            In the project root:
            <pre className="mt-2 overflow-x-auto rounded border border-zinc-800 bg-black/50 p-3 text-[11px] text-zinc-400">
{`export AGENTMESH_TOKEN="…"
npx agentmesh-sync@0.3.1 init --workspace-id <from console> --api-base-url <this site origin>
npx agentmesh-sync push`}
            </pre>
            (In this monorepo you can use{" "}
            <code className="rounded bg-zinc-900 px-1">npm exec -w agentmesh-sync -- agentmesh-sync push</code>
            .)
          </li>
          <li>
            In the console sidebar, wait until <code className="rounded bg-zinc-900 px-1">indexingStatus</code>{" "}
            is <code className="rounded bg-zinc-900 px-1">ready</code> and{" "}
            <code className="rounded bg-zinc-900 px-1">lastSyncedAt</code> updates—then sync + indexing
            finished.
          </li>
        </ol>
      </section>

      <section id="three-ways" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-medium text-emerald-400">Three entry points</h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          After sign-in, Dashboard and the console pre-fill{" "}
          <code className="rounded bg-zinc-900 px-1">workspaceId</code> when possible; placeholders
          explain fields when you’re logged out.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <PlatformIntegrationCards />
        </div>
      </section>

      <section id="mcp-default" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-medium text-emerald-400">MCP: standard agent-readable capability</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          MCP isn’t Cursor-only. Any host that implements Model Context Protocol (stdio) can merge the
          JSON above—Claude Code, Cursor, other MCP IDEs, or a standalone agent runtime. The
          <strong> Advanced</strong> block on the workspace page is a normal{" "}
          <code className="rounded bg-zinc-900 px-1">mcpServers</code> shape; place it per your host’s
          docs (project or user config).
        </p>
      </section>

      <section id="sync" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-medium text-emerald-400">Sync & index status (how you know it worked)</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-zinc-400">
          <li>
            <code className="rounded bg-zinc-900 px-1">lastSyncedAt</code>: last time a full/incremental
            index completed and reached <code className="rounded bg-zinc-900 px-1">ready</code>.
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-1">indexError</code> / console{" "}
            <strong className="text-zinc-300">lastError</strong>: failure summary—push again or trigger IDE
            sync, then <strong className="text-zinc-300">refresh the console</strong>.
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-1">indexingStatus</code>:{" "}
            <code className="rounded bg-zinc-900 px-1">pending</code> waits for first push;{" "}
            <code className="rounded bg-zinc-900 px-1">indexing</code> means chunking + embeddings (often
            seconds to minutes); <code className="rounded bg-zinc-900 px-1">ready</code> is searchable;{" "}
            <code className="rounded bg-zinc-900 px-1">error</code> needs a retry as above.
          </li>
        </ul>
      </section>

      <section id="permissions" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-medium text-emerald-400">Permissions & sharing</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-xs text-zinc-400">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-300">
              <tr>
                <th className="p-3 font-medium">Capability</th>
                <th className="p-3 font-medium">Who</th>
                <th className="p-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              <tr>
                <td className="p-3 font-medium text-zinc-300">Write / overwrite project data</td>
                <td className="p-3">Workspace members</td>
                <td className="p-3">
                  Via Context Token (<code className="rounded bg-zinc-800 px-1">AGENTMESH_TOKEN</code>)
                  as <strong>you</strong>; only replaces data for projects <strong>you own</strong>.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-zinc-300">Read index · semantic search</td>
                <td className="p-3">Members (MCP / HTTP)</td>
                <td className="p-3">
                  Generally search synced projects that are <strong>not sharing-disabled</strong>; see
                  project <code className="rounded bg-zinc-800 px-1">sharingEnabled</code> etc.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-zinc-300">Console · members · status</td>
                <td className="p-3">Members</td>
                <td className="p-3">
                  Signed-in workspace view; see membership and project list + index status.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-zinc-300">“Only my projects” on push</td>
                <td className="p-3">Push side</td>
                <td className="p-3">
                  Writes always carry <code className="rounded bg-zinc-800 px-1">ownerUserId</code>;
                  others can’t use their token to overwrite your projects. Stricter search isolation may
                  require disabling sharing or splitting workspaces.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-zinc-600">
        Implementation details live in the CLI README and API routes; when debugging, start from project
        card errors and <code className="rounded bg-zinc-900 px-1">indexingStatus</code>.
      </p>
    </main>
  );
}
