import Link from "next/link";

export function AppNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 text-sm">
        <Link href="/" className="font-medium text-zinc-100">
          AgentMesh
        </Link>
        <Link
          href="/settings/advanced/docs"
          className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          Docs
        </Link>
        <Link
          href="/dashboard"
          className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          Dashboard
        </Link>
        <Link
          href="/login"
          className="ml-auto text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
        >
          Log in
        </Link>
      </div>
    </nav>
  );
}
