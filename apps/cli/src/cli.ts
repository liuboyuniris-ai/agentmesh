#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { program } from "commander";
import chokidar from "chokidar";
import fg from "fast-glob";

type SyncConfig = {
  apiBaseUrl: string;
  workspaceId: string;
  token: string;
  projectId?: string;
};

const CONFIG_REL = ".agentmesh/sync.json";
const MANIFEST_REL = ".agentmesh/file-hashes.json";

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function readConfig(cwd: string): Promise<SyncConfig | null> {
  const envToken = process.env.AGENTMESH_TOKEN?.trim() ?? "";

  try {
    const raw = await fs.readFile(path.join(cwd, CONFIG_REL), "utf8");
    const j = JSON.parse(raw) as Partial<SyncConfig>;
    const token = (j.token?.trim() || envToken) as string;
    if (j.apiBaseUrl?.trim() && j.workspaceId?.trim() && token) {
      return {
        apiBaseUrl: j.apiBaseUrl.replace(/\/$/, "").trim(),
        workspaceId: j.workspaceId.trim(),
        token,
        projectId: j.projectId?.trim() || undefined,
      };
    }
  } catch {
    /* fall through */
  }

  try {
    const raw = await fs.readFile(path.join(cwd, ".agentmesh.json"), "utf8");
    const j = JSON.parse(raw) as {
      apiBaseUrl?: string;
      workspaceId?: string;
      projectId?: string;
    };
    if (!j.apiBaseUrl?.trim() || !j.workspaceId?.trim()) return null;
    if (!envToken) return null;
    return {
      apiBaseUrl: j.apiBaseUrl.replace(/\/$/, "").trim(),
      workspaceId: j.workspaceId.trim(),
      token: envToken,
      projectId: j.projectId?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

async function writeConfig(cwd: string, cfg: SyncConfig): Promise<void> {
  await fs.mkdir(path.join(cwd, ".agentmesh"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, CONFIG_REL),
    `${JSON.stringify(cfg, null, 2)}\n`,
    "utf8"
  );
}

async function readManifest(cwd: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(cwd, MANIFEST_REL), "utf8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeManifest(
  cwd: string,
  manifest: Record<string, string>
): Promise<void> {
  await fs.mkdir(path.join(cwd, ".agentmesh"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, MANIFEST_REL),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

async function scanWorkspaceFiles(cwd: string): Promise<Record<string, string>> {
  const rel = await fg(
    [
      "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yml,yaml,rs,go,py,java,prisma,vue,html,css,toml,txt}",
      "package.json",
      "README.md",
    ],
    {
      cwd,
      dot: false,
      ignore: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "**/dist/**",
        "**/build/**",
      ],
    }
  );
  const out: Record<string, string> = {};
  const cap = 120;
  let n = 0;
  for (const r of rel) {
    if (n >= cap) break;
    const abs = path.join(cwd, r);
    try {
      const stat = await fs.stat(abs);
      if (!stat.isFile() || stat.size > 96_000) continue;
      out[r.replace(/\\/g, "/")] = await fs.readFile(abs, "utf8");
      n++;
    } catch {
      /* skip */
    }
  }
  return out;
}

function manifestFromFiles(files: Record<string, string>): Record<string, string> {
  const m: Record<string, string> = {};
  for (const [rel, content] of Object.entries(files)) {
    m[rel] = hashContent(content);
  }
  return m;
}

async function postLocalProject(
  cwd: string,
  cfg: SyncConfig,
  opts: { name: string; files: Record<string, string> }
): Promise<{ projectId?: string }> {
  const body: Record<string, unknown> = {
    name: opts.name,
    files: opts.files,
  };
  if (cfg.projectId) body.projectId = cfg.projectId;

  const res = await fetch(
    `${cfg.apiBaseUrl}/api/workspaces/${cfg.workspaceId}/projects/local`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify(body),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  const json = JSON.parse(text) as { project?: { id: string } };
  return { projectId: json.project?.id };
}

program.name("agentmesh-sync").description("AgentMesh local → cloud sync (CLI)");

program
  .command("init")
  .description("Write .agentmesh.json (and optional .agentmesh/sync.json) in the current directory")
  .requiredOption("--workspace-id <id>")
  .option(
    "--api-base-url <url>",
    "Next.js app origin",
    process.env.AGENTMESH_API_BASE_URL ?? "http://localhost:3000"
  )
  .option(
    "--token <token>",
    "Context token or console「同步专用 Token」; omit and use env AGENTMESH_TOKEN"
  )
  .action(
    async (opts: {
      workspaceId: string;
      apiBaseUrl: string;
      token?: string;
    }) => {
      const cwd = process.cwd();
      const apiBaseUrl = opts.apiBaseUrl.replace(/\/$/, "");
      const manifest = {
        apiBaseUrl,
        workspaceId: opts.workspaceId.trim(),
      };
      await fs.writeFile(
        path.join(cwd, ".agentmesh.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8"
      );
      const envTok = process.env.AGENTMESH_TOKEN?.trim() ?? "";
      const tok = (opts.token?.trim() || envTok) as string;
      if (tok) {
        await writeConfig(cwd, {
          apiBaseUrl,
          workspaceId: opts.workspaceId.trim(),
          token: tok,
        });
        console.log(`Wrote .agentmesh.json and ${CONFIG_REL}`);
      } else {
        console.log("Wrote .agentmesh.json");
        console.log(
          "Next: export AGENTMESH_TOKEN=… (Workspace Context Token), then agentmesh-sync push"
        );
      }
    }
  );

program
  .command("connect")
  .requiredOption("--workspace-id <id>")
  .requiredOption("--token <token>")
  .option(
    "--api-base-url <url>",
    "Next.js app origin",
    process.env.AGENTMESH_API_BASE_URL ?? "http://localhost:3000"
  )
  .action(async (opts: { workspaceId: string; token: string; apiBaseUrl: string }) => {
    const cwd = process.cwd();
    await writeConfig(cwd, {
      apiBaseUrl: opts.apiBaseUrl.replace(/\/$/, ""),
      workspaceId: opts.workspaceId,
      token: opts.token,
    });
    console.log(`Saved ${CONFIG_REL} (add .agentmesh/ to .gitignore if needed)`);
  });

program
  .command("push")
  .option("--name <name>", "project display name", path.basename(process.cwd()))
  .action(async (opts: { name: string }) => {
    const cwd = process.cwd();
    const cfg = await readConfig(cwd);
    if (!cfg) {
      throw new Error(
        "Configure: run `agentmesh-sync init`, or `agentmesh-sync connect`, or create .agentmesh.json + AGENTMESH_TOKEN"
      );
    }
    const files = await scanWorkspaceFiles(cwd);
    const { projectId } = await postLocalProject(cwd, cfg, {
      name: opts.name,
      files,
    });
    if (projectId) {
      cfg.projectId = projectId;
      try {
        await writeConfig(cwd, cfg);
      } catch {
        /* optional */
      }
    }
    await writeManifest(cwd, manifestFromFiles(files));
    console.log("Pushed to AgentMesh. projectId=", cfg.projectId ?? projectId);
  });

program
  .command("watch")
  .option("--debounce <ms>", "debounce window", "1500")
  .action(async (opts: { debounce: string }) => {
    const cwd = process.cwd();
    const debounceMs = Number(opts.debounce) || 1500;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const sync = async () => {
      const cfg = await readConfig(cwd);
      if (!cfg) {
        console.error("[agentmesh-sync] missing config / AGENTMESH_TOKEN");
        return;
      }
      const prev = await readManifest(cwd);
      const full = await scanWorkspaceFiles(cwd);
      const nextHashes = manifestFromFiles(full);
      const changed =
        Object.keys(nextHashes).length !== Object.keys(prev).length ||
        Object.entries(nextHashes).some(([k, h]) => prev[k] !== h);
      if (!changed) {
        console.log("[agentmesh-sync] no file changes");
        return;
      }

      try {
        const { projectId } = await postLocalProject(cwd, cfg, {
          name: path.basename(cwd),
          files: full,
        });
        if (projectId && !cfg.projectId) {
          cfg.projectId = projectId;
          try {
            await writeConfig(cwd, cfg);
          } catch {
            /* */
          }
        }
        await writeManifest(cwd, nextHashes);
        console.log(
          "[agentmesh-sync] synced",
          Object.keys(full).length,
          "files",
          new Date().toISOString()
        );
      } catch (e) {
        console.error("[agentmesh-sync]", e instanceof Error ? e.message : e);
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void sync(), debounceMs);
    };

    chokidar
      .watch(["**/*"], {
        cwd,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/.agentmesh/**",
        ],
        ignoreInitial: true,
      })
      .on("all", schedule);

    console.log("[agentmesh-sync] watching", cwd, `(debounce ${debounceMs}ms)`);
  });

await program.parseAsync(process.argv);
