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
          <span className="text-zinc-600"> · 高级 / 开发者文档（主路径为 GitHub 导入）</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">接入 AgentMesh</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          与<strong className="font-medium text-zinc-300">具体编辑器无关</strong>
          ：把代码同步进 Workspace 后，本地 Agent 可通过{" "}
          <strong className="font-medium text-zinc-300">MCP</strong> 或{" "}
          <strong className="font-medium text-zinc-300">HTTP</strong> 读取<strong className="font-medium text-zinc-300">
            已索引且对你开放
          </strong>
          的片段；亦可用 <strong className="font-medium text-zinc-300">CLI</strong> 从本机推送更新。多人协作时请先看完{" "}
          <Link className="text-blue-400 underline" href="#collab-mainline">
            协作主线
          </Link>
          。
        </p>
      </header>

      <section
        id="collab-mainline"
        className="scroll-mt-20 space-y-4 rounded-lg border border-violet-900/40 bg-violet-950/20 p-5"
      >
        <h2 className="text-lg font-medium text-violet-200">
          协作主线：在 Cursor / Claude 里「读到队友已上云的代码」
        </h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          MCP / HTTP 只查询<strong className="font-medium text-zinc-400">本 Workspace 里已经同步并完成索引</strong>
          的内容。对方若从未导入仓库或 push 到 AgentMesh，你的检索再准也搜不到——这和复制粘贴不是同一类问题，而是<strong className="font-medium text-zinc-400">数据前提</strong>。
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
          <li>
            <strong className="font-medium text-zinc-200">同一 Workspace</strong>：用邀请码或邀请链接把队友加进来。
          </li>
          <li>
            <strong className="font-medium text-zinc-200">各自同步自己的 project</strong>：每人至少导入一个仓库，或在本机{" "}
            <code className="rounded bg-zinc-900 px-1">agentmesh-sync push</code> / VS Code 扩展同步，直到控制台里对应项目{" "}
            <code className="rounded bg-zinc-900 px-1">ready</code>。
          </li>
          <li>
            <strong className="font-medium text-zinc-200">各人配好 MCP（或 HTTP）</strong>：在 Workspace「高级」复制
            Token 与 MCP 片段；否则 Agent 只能退回复制粘贴，体验与平台无关。
          </li>
          <li>
            <strong className="font-medium text-zinc-200">新鲜度</strong>：默认是手动/半自动同步（再导入、再 push、扩展可「保存即
            push」）。若指望「对方刚改完你立刻能问」，需要双方都养成<strong className="font-medium text-zinc-400">
              改完即同步
            </strong>的习惯，或接入 CI / 定时任务。
          </li>
        </ol>
        <p className="text-xs text-zinc-500">
          新建项目的 <code className="rounded bg-zinc-900 px-1">sharingEnabled</code> /{" "}
          <code className="rounded bg-zinc-900 px-1">snippetsShared</code> 默认可检索；若有人在项目设置里关了共享，其他成员通过
          MCP 会搜不到该项目。
        </p>
      </section>

      <section id="quickstart" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-medium text-emerald-400">第一次成功（最短路径）</h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          目标：尽量少读文档，把一个本地仓库的文件树同步进某个 Workspace，并能在 Agent 里检索。
        </p>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-300">
          <li>
            <Link className="text-blue-400 underline" href="/login">
              登录
            </Link>
            后打开{" "}
            <Link className="text-blue-400 underline" href="/dashboard">
              Dashboard
            </Link>{" "}
            ，进入目标 Workspace 的<strong className="font-medium text-zinc-200">控制台</strong>
            。
          </li>
          <li>
            在控制台展开<strong className="font-medium text-zinc-200">「高级」</strong>
            ，复制 <code className="rounded bg-zinc-900 px-1">.agentmesh.json</code> 模板与下方
            MCP 配置示例到本机；在同一页复制 <strong className="font-medium text-zinc-200">Context Token</strong>{" "}
            作为 <code className="rounded bg-zinc-900 px-1">AGENTMESH_TOKEN</code>。
          </li>
          <li>
            Context Token 同时用于 MCP、HTTP <code className="rounded bg-zinc-900 px-1">context/query</code>{" "}
            与 CLI <code className="rounded bg-zinc-900 px-1">push</code>（勿提交到 Git）。
          </li>
          <li>
            在项目根目录：
            <pre className="mt-2 overflow-x-auto rounded border border-zinc-800 bg-black/50 p-3 text-[11px] text-zinc-400">
{`export AGENTMESH_TOKEN="…"
npx agentmesh-sync@0.3.1 init --workspace-id <控制台可见> --api-base-url <本站 origin>
npx agentmesh-sync push`}
            </pre>
            （本 monorepo 开发可用{" "}
            <code className="rounded bg-zinc-900 px-1">npm exec -w agentmesh-sync -- agentmesh-sync push</code>
            。）
          </li>
          <li>
            回到控制台侧栏查看项目：
            <code className="rounded bg-zinc-900 px-1">indexingStatus</code> 变为{" "}
            <code className="rounded bg-zinc-900 px-1">ready</code>、出现{" "}
            <code className="rounded bg-zinc-900 px-1">lastSyncedAt</code> 即表示本轮同步与索引完成。
          </li>
        </ol>
      </section>

      <section id="three-ways" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-medium text-emerald-400">三种入口（同等重要）</h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          登录并选定 Workspace 后，Dashboard 与控制台会尽量自动填入{" "}
          <code className="rounded bg-zinc-900 px-1">workspaceId</code>；未登录时可用占位符对照字段含义。
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <PlatformIntegrationCards />
        </div>
      </section>

      <section id="mcp-default" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-medium text-emerald-400">MCP：任意 Agent 可读的标准能力</h2>
        <p className="text-sm leading-relaxed text-zinc-400">
          MCP 不是「Cursor 专属高级功能」。只要宿主实现了 Model Context Protocol（stdio），把上表中的
          JSON 合并进配置即可：例如 Claude Code / Cursor / 其他支持 MCP 的 IDE 或独立 Agent 运行时。控制台「高级」里的
          MCP 块是标准 <code className="rounded bg-zinc-900 px-1">mcpServers</code>{" "}
          结构，可按宿主文档放到项目或用户级 MCP 设置中。
        </p>
      </section>

      <section id="sync" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-medium text-emerald-400">同步与索引状态（如何知道成功了）</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-zinc-400">
          <li>
            <code className="rounded bg-zinc-900 px-1">lastSyncedAt</code>：最近一次完成全量/增量索引并写入{" "}
            <code className="rounded bg-zinc-900 px-1">ready</code> 的时间。
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-1">indexError</code> / 控制台上的{" "}
            <strong className="text-zinc-300">lastError</strong>：失败原因摘要；请在本机再次{" "}
            <code className="rounded bg-zinc-900 px-1">push</code> 或触发 IDE
            同步，然后<strong className="text-zinc-300">刷新控制台</strong>查看是否恢复。
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-1">indexingStatus</code>：
            <code className="rounded bg-zinc-900 px-1">pending</code> 等待首次推送；{" "}
            <code className="rounded bg-zinc-900 px-1">indexing</code>{" "}
            表示服务端正在切块与向量索引，通常数十秒到数分钟；{" "}
            <code className="rounded bg-zinc-900 px-1">ready</code> 可检索；{" "}
            <code className="rounded bg-zinc-900 px-1">error</code> 需按上条重试。
          </li>
        </ul>
      </section>

      <section id="permissions" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-medium text-emerald-400">权限与共享边界</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-xs text-zinc-400">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-300">
              <tr>
                <th className="p-3 font-medium">能力</th>
                <th className="p-3 font-medium">Who</th>
                <th className="p-3 font-medium">说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              <tr>
                <td className="p-3 font-medium text-zinc-300">写入 / 覆盖项目文件</td>
                <td className="p-3">Workspace 成员</td>
                <td className="p-3">
                  通过 Context Token（<code className="rounded bg-zinc-800 px-1">AGENTMESH_TOKEN</code>
                  ）代表<strong>你自己</strong>；只能替换<strong>你作为 owner</strong> 名下对应的 local 项目数据。
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-zinc-300">读索引 · 语义检索</td>
                <td className="p-3">成员（MCP / HTTP）</td>
                <td className="p-3">
                  通常可检索本 Workspace 内已同步且<strong>未关闭共享</strong>的项目片段；具体以项目级{" "}
                  <code className="rounded bg-zinc-800 px-1">sharingEnabled</code> 等为准。
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-zinc-300">看控制台 · 成员 · 状态</td>
                <td className="p-3">成员</td>
                <td className="p-3">
                  登录后进入 Workspace；可看到自己与其他成员的<strong>存在</strong>及项目列表与索引状态。
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-zinc-300">「只看我自己的项目」</td>
                <td className="p-3">推送侧已绑定</td>
                <td className="p-3">
                  覆盖与创建始终带 <code className="rounded bg-zinc-800 px-1">ownerUserId</code>
                  ；他人无法用其 Token 替你覆盖。若需在<strong>检索层</strong>完全隔离，需关闭共享或拆
                  Workspace（产品可继续收紧 API）。
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-zinc-600">
        更多实现细节见仓库内 CLI README 与各 API 路由；遇到问题从控制台项目卡片上的错误信息与{" "}
        <code className="rounded bg-zinc-900 px-1">indexingStatus</code> 查起。
      </p>
    </main>
  );
}
