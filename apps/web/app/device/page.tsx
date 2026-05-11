"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type WsRow = { workspaceId: string; name: string; role: string };

function DeviceApproveInner() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get("user_code") ?? "";
  const bindWorkspace = searchParams.get("bind_workspace")?.trim() ?? "";

  const [userCode, setUserCode] = useState(prefill);
  const [workspaces, setWorkspaces] = useState<WsRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/workspaces");
    if (!res.ok) {
      setErr(await res.text());
      setLoading(false);
      return;
    }
    const rows = (await res.json()) as WsRow[];
    setWorkspaces(rows);
    setWorkspaceId((prev) => {
      if (prev) return prev;
      const bound =
        bindWorkspace && rows.some((r) => r.workspaceId === bindWorkspace)
          ? bindWorkspace
          : "";
      if (bound) return bound;
      return rows.length === 1 && rows[0] ? rows[0].workspaceId : "";
    });
    setLoading(false);
  }, [bindWorkspace]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (prefill) setUserCode(prefill);
  }, [prefill]);

  async function approve() {
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/auth/device/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userCode,
        workspaceId,
      }),
    });
    if (!res.ok) {
      const raw = await res.text();
      let errBody = raw;
      try {
        const j = JSON.parse(raw) as { error?: string };
        if (j.error) errBody = j.error;
      } catch {
        /* keep raw */
      }
      setErr(errBody);
      return;
    }
    setMsg("已授权 VS Code / 本地工具。可关闭此页。");
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8 text-zinc-200">
      <h1 className="text-lg font-semibold">设备授权</h1>
      <p className="text-sm text-zinc-400">
        在编辑器里启动「浏览器登录」后，将显示的配对码填在下方，并选择要授权的
        Workspace。完成后面板会把成员 Token 下发给本地扩展。
      </p>

      {loading ? (
        <p className="text-sm text-zinc-500">加载 Workspace 列表…</p>
      ) : null}

      <label className="block text-sm">
        <span className="text-zinc-500">配对码</span>
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm tracking-wider"
          value={userCode}
          onChange={(e) => setUserCode(e.target.value)}
          placeholder="例如 ABCD-EFGH"
          autoComplete="off"
        />
      </label>

      <label className="block text-sm">
        <span className="text-zinc-500">Workspace</span>
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
        >
          <option value="">选择…</option>
          {workspaces.map((w) => (
            <option key={w.workspaceId} value={w.workspaceId}>
              {w.name} ({w.role})
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        disabled={!userCode.trim() || !workspaceId}
        onClick={() => void approve()}
      >
        授权设备
      </button>

      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
    </div>
  );
}

export default function DevicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">加载中…</div>}>
      <DeviceApproveInner />
    </Suspense>
  );
}
