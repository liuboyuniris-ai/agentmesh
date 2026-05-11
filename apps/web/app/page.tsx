import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AgentMesh</h1>
        <p className="mt-2 text-zinc-400">
          主流程：<strong className="font-medium text-zinc-300">登录 → 新建 Workspace → GitHub 授权 →
          选择仓库</strong>
          ，代码会自动进入 Workspace 并建立索引。CLI / MCP / Token 等见{" "}
          <Link className="text-blue-400 underline underline-offset-4" href="/settings/advanced/docs">
            高级文档
          </Link>
          。
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
        <p className="mb-3 text-xs font-medium uppercase text-zinc-500">
          自建部署（本仓库）
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-zinc-300">
          <li>
            复制 <code className="rounded bg-zinc-800 px-1">env.example</code> →{" "}
            <code className="rounded bg-zinc-800 px-1">.env</code>，配置数据库与可选{" "}
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
            打开 <Link className="text-blue-400 underline" href="/login">登录 / 注册</Link>
            ，在 Dashboard 创建 Workspace 并按引导连接 GitHub。
          </li>
        </ol>
      </div>
      <Link
        className="text-blue-400 underline underline-offset-4"
        href="/login"
      >
        登录 / 注册 →
      </Link>
    </main>
  );
}
