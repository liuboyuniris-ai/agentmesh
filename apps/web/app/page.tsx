import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AgentMesh</h1>
        <p className="mt-2 text-zinc-400">
          Main flow:{" "}
          <strong className="font-medium text-zinc-300">
            Log in → Create a workspace → Authorize GitHub → Pick a repo
          </strong>
          . Code is imported into the workspace and indexed automatically. CLI / MCP / tokens are
          in the{" "}
          <Link className="text-blue-400 underline underline-offset-4" href="/settings/advanced/docs">
            developer docs
          </Link>
          .
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
        <p className="mb-3 text-xs font-medium uppercase text-zinc-500">Self-host (this repo)</p>
        <ol className="list-decimal space-y-2 pl-5 text-zinc-300">
          <li>
            Copy <code className="rounded bg-zinc-800 px-1">env.example</code> to{" "}
            <code className="rounded bg-zinc-800 px-1">.env</code>; set the database and optional{" "}
            <code className="rounded bg-zinc-800 px-1">OPENAI_API_KEY</code>
          </li>
          <li>
            <code className="rounded bg-zinc-800 px-1">
              npm install && npx prisma migrate deploy && npm run db:seed
            </code>
          </li>
          <li>
            <code className="rounded bg-zinc-800 px-1">npm run dev</code>
          </li>
          <li>
            Open{" "}
            <Link className="text-blue-400 underline" href="/login">
              Log in / Register
            </Link>
            , create a workspace from the Dashboard, and follow the flow to connect GitHub.
          </li>
        </ol>
      </div>
      <Link
        className="text-blue-400 underline underline-offset-4"
        href="/login"
      >
        Log in / Register →
      </Link>
    </main>
  );
}
