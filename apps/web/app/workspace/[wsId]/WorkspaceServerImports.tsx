"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useState } from "react";

const LOCAL_UPLOAD_MAX_FILES = 120;
const LOCAL_UPLOAD_MAX_BYTES = 96_000;

const LOCAL_TEXT_EXT = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "md",
  "mdx",
  "yaml",
  "yml",
  "css",
  "html",
  "htm",
  "prisma",
  "rs",
  "go",
  "py",
  "java",
  "kt",
  "swift",
  "vue",
  "toml",
  "txt",
]);

type GithubRepoRow = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  html_url: string;
  description: string | null;
};

export function WorkspaceServerImports(props: {
  wsId: string;
  headers: Record<string, string>;
  onImported: () => void;
}) {
  const { wsId, headers, onImported } = props;

  const [repoUrl, setRepoUrl] = useState("https://github.com/vercel/next.js.git");
  const [projName, setProjName] = useState("next.js sample");
  const [github, setGithub] = useState<{
    connected: boolean;
    scope: string | null;
  }>({ connected: false, scope: null });
  const [ghRepos, setGhRepos] = useState<GithubRepoRow[]>([]);
  const [ghPage, setGhPage] = useState(1);
  const [ghBanner, setGhBanner] = useState<string | null>(null);
  const [pickedRepo, setPickedRepo] = useState<GithubRepoRow | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localProjName, setLocalProjName] = useState("uploaded-project");
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProjName, setZipProjName] = useState("zip-project");
  const [zipDragging, setZipDragging] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/github/status");
      if (res.ok) {
        const j = (await res.json()) as { connected: boolean; scope: string | null };
        setGithub({ connected: j.connected, scope: j.scope });
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("github") === "connected") {
      setGhBanner(
        "GitHub connected—pick a repo under “Import from GitHub” below (no manual token)."
      );
      setGithub((c) => ({ ...c, connected: true }));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [wsId]);

  async function importGithubPicked() {
    if (!pickedRepo) return;
    setImportBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/projects/git`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          repoUrl: pickedRepo.clone_url,
          name: pickedRepo.name,
          branch: pickedRepo.default_branch,
        }),
      });
      const body = await res.text();
      if (!res.ok) return setErr(body);
      onImported();
      setGhBanner(
        `Imported “${pickedRepo.full_name}”—clone / indexing finished or in progress.`
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function loadGhRepos(page: number) {
    setErr(null);
    const res = await fetch(`/api/auth/github/repos?page=${page}&per_page=20`);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;
      return setErr(j?.message ?? j?.error ?? (await res.text()));
    }
    const data = (await res.json()) as { repos: GithubRepoRow[]; page: number };
    setGhRepos(data.repos);
    setGhPage(data.page);
  }

  async function uploadZipFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setErr("Please upload a .zip file");
      return;
    }
    setZipBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("zip", file);
      fd.set("name", zipProjName);
      const res = await fetch(`/api/workspaces/${wsId}/projects/zip`, {
        method: "POST",
        headers: { "X-User-Id": headers["X-User-Id"] },
        body: fd,
      });
      const body = await res.text();
      if (!res.ok) return setErr(body);
      onImported();
    } finally {
      setZipBusy(false);
    }
  }

  async function onLocalFolderPick(ev: ChangeEvent<HTMLInputElement>) {
    const list = ev.target.files;
    ev.target.value = "";
    if (!list?.length) return;

    const files: Record<string, string> = {};
    let count = 0;
    const skipDirs = new Set(["node_modules", ".git", ".next", "dist", "build"]);

    for (const f of Array.from(list)) {
      const rel =
        (f as File & { webkitRelativePath?: string }).webkitRelativePath ??
        f.name;
      const norm = rel.replace(/\\/g, "/").replace(/^\/+/, "");
      if (norm.includes("..")) continue;
      if (norm.split("/").some((s) => skipDirs.has(s))) continue;

      const base = norm.split("/").pop() ?? "";
      const ext = base.includes(".")
        ? base.split(".").pop()!.toLowerCase()
        : "";
      if (!LOCAL_TEXT_EXT.has(ext)) continue;
      if (f.size > LOCAL_UPLOAD_MAX_BYTES) continue;

      try {
        files[norm] = await f.text();
      } catch {
        continue;
      }
      count++;
      if (count >= LOCAL_UPLOAD_MAX_FILES) break;
    }

    if (!Object.keys(files).length) {
      setErr("No uploadable text files found, or files exceed the per-file size limit.");
      return;
    }

    setLocalBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/projects/local`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: localProjName, files }),
      });
      const body = await res.text();
      if (!res.ok) return setErr(body);
      onImported();
    } finally {
      setLocalBusy(false);
    }
  }

  async function connectGit() {
    setErr(null);
    const res = await fetch(`/api/workspaces/${wsId}/projects/git`, {
      method: "POST",
      headers,
      body: JSON.stringify({ repoUrl, name: projName, branch: "main" }),
    });
    const body = await res.text();
    if (!res.ok) return setErr(body);
    onImported();
  }

  return (
    <details className="rounded-lg border border-zinc-800">
      <summary className="cursor-pointer select-none p-4 text-sm font-medium text-zinc-400">
        Optional: server-side import (no IDE)
      </summary>
      <div className="space-y-6 border-t border-zinc-800 p-4">
        {err ? (
          <pre className="whitespace-pre-wrap rounded border border-red-900 bg-red-950/30 p-3 text-xs text-red-200">
            {err}
          </pre>
        ) : null}
        {ghBanner ? (
          <p className="rounded border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-100">
            {ghBanner}
          </p>
        ) : null}

        <section className="rounded-lg border border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400">Import from GitHub</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Sign in on the{" "}
            <Link className="text-blue-400 underline" href="/dashboard">
              Dashboard
            </Link>{" "}
            and connect GitHub first.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
              href={`/api/auth/github/start?return_to=${encodeURIComponent(`/workspace/${wsId}`)}`}
            >
              {github.connected ? "Re-authorize GitHub" : "Connect GitHub account"}
            </a>
            <button
              type="button"
              disabled={!github.connected || importBusy}
              className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40"
              onClick={() => void loadGhRepos(1)}
            >
              Load my repositories
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            OAuth: {github.connected ? "Connected" : "Not connected"}
            {github.scope ? (
              <>
                {" "}
                · <code className="rounded bg-zinc-900 px-1">{github.scope}</code>
              </>
            ) : null}
          </p>
          {ghRepos.length ? (
            <div className="mt-4 space-y-2">
              <label className="text-xs text-zinc-500">Repository to import</label>
              <select
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={pickedRepo?.full_name ?? ""}
                onChange={(e) => {
                  const r = ghRepos.find((x) => x.full_name === e.target.value);
                  setPickedRepo(r ?? null);
                }}
              >
                <option value="">—</option>
                {ghRepos.map((r) => (
                  <option key={r.id} value={r.full_name}>
                    {r.full_name}
                    {r.private ? " · private" : ""} · {r.default_branch}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!pickedRepo || importBusy}
                  className="rounded bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-40"
                  onClick={() => void importGithubPicked()}
                >
                  {importBusy ? "Importing…" : "Import selected & index"}
                </button>
                <button
                  type="button"
                  disabled={importBusy || ghPage < 2}
                  className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40"
                  onClick={() => void loadGhRepos(ghPage - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={importBusy || ghRepos.length < 20}
                  className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40"
                  onClick={() => void loadGhRepos(ghPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400">Local folder (browser)</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Up to {LOCAL_UPLOAD_MAX_FILES} files, {Math.round(LOCAL_UPLOAD_MAX_BYTES / 1000)}KB each.
          </p>
          <input
            className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Display name"
            value={localProjName}
            onChange={(e) => setLocalProjName(e.target.value)}
          />
          <input
            type="file"
            className="mt-2 block w-full cursor-pointer text-sm file:mr-3 file:rounded file:border file:border-zinc-600 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm"
            multiple
            disabled={localBusy}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => void onLocalFolderPick(e)}
          />
          {localBusy ? (
            <p className="mt-2 text-xs text-zinc-500">Uploading & indexing…</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400">ZIP upload</h2>
          <p className="mt-1 text-xs text-zinc-600">≤8MB zip, ~200 text files.</p>
          <input
            className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Display name after extract"
            value={zipProjName}
            onChange={(e) => setZipProjName(e.target.value)}
          />
          <div
            className={`mt-3 flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded border border-dashed px-4 py-6 text-center text-sm transition-colors ${
              zipDragging
                ? "border-violet-500 bg-violet-950/30"
                : "border-zinc-600 bg-zinc-950/50 hover:border-zinc-500"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setZipDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setZipDragging(true);
            }}
            onDragLeave={() => setZipDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setZipDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void uploadZipFile(f);
            }}
            onClick={() =>
              document.getElementById(`zip-input-server-${wsId}`)?.click()
            }
            role="presentation"
          >
            {zipBusy ? "Extracting & indexing…" : "Drop a .zip here, or click to choose"}
            <input
              id={`zip-input-server-${wsId}`}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              disabled={zipBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadZipFile(f);
              }}
            />
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400">Advanced: raw Git URL</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Server must have <code className="rounded bg-zinc-900 px-1">git</code> installed.
          </p>
          <input
            className="mt-3 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Display name"
            value={projName}
            onChange={(e) => setProjName(e.target.value)}
          />
          <button
            type="button"
            className="mt-3 rounded bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600"
            onClick={() => void connectGit()}
          >
            Clone &amp; index
          </button>
        </section>
      </div>
    </details>
  );
}
