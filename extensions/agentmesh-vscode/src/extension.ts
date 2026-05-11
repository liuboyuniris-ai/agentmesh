import * as vscode from "vscode";

const MAX_FILES = 120;
const MAX_BYTES = 96_000;

const GLOB =
  "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yml,yaml,css,html,prisma,rs,go,py,java,kt,swift,vue,toml,txt}";

type AgentmeshBindingFile = {
  apiBaseUrl?: string;
  workspaceId?: string;
  projectId?: string;
};

const saveDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

let extensionContext: vscode.ExtensionContext;

function secretStorageKey(folder: vscode.WorkspaceFolder): string {
  return `agentmesh.ctx:${folder.uri.toString()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  const reloadAllBindingsSilent = () => {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      void applyBindingFromDisk(folder, { silent: true });
    }
  };

  reloadAllBindingsSilent();

  const bindingWatcher = vscode.workspace.createFileSystemWatcher("**/.agentmesh.json");
  bindingWatcher.onDidChange(reloadAllBindingsSilent);
  bindingWatcher.onDidCreate(reloadAllBindingsSilent);
  bindingWatcher.onDidDelete(reloadAllBindingsSilent);
  context.subscriptions.push(bindingWatcher);

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      reloadAllBindingsSilent();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.scheme !== "file") return;
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      if (!folder) return;
      const rel = vscode.workspace.asRelativePath(doc.uri, false);
      if (rel.includes("..")) return;
      const norm = rel.replace(/\\/g, "/");
      if (
        norm === ".agentmesh.json" ||
        norm.endsWith("/.agentmesh.json") ||
        norm.startsWith(".agentmesh/") ||
        norm.split("/").some((s) => s === "node_modules" || s === ".git")
      ) {
        return;
      }
      scheduleDebouncedSaveSync(folder);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentmesh.signInWithBrowser", () =>
      signInWithBrowser()
    ),
    vscode.commands.registerCommand("agentmesh.reloadBinding", () =>
      reloadBindingCommand()
    ),
    vscode.commands.registerCommand("agentmesh.syncWorkspace", () =>
      syncWorkspaceInteractive()
    ),
    vscode.commands.registerCommand("agentmesh.selectProject", () =>
      selectProjectForSync()
    ),
    vscode.commands.registerCommand("agentmesh.openChat", () => openChat())
  );
}

async function effectiveToken(
  cfg: vscode.WorkspaceConfiguration,
  folder: vscode.WorkspaceFolder
): Promise<string> {
  const fromSecret =
    (await extensionContext.secrets.get(secretStorageKey(folder)))?.trim() ??
    "";
  if (fromSecret.length) return fromSecret;
  const fromCfg = cfg.get<string>("contextToken")?.trim() ?? "";
  if (fromCfg.length) return fromCfg;
  return process.env.AGENTMESH_TOKEN?.trim() ?? "";
}

async function signInWithBrowser() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage("AgentMesh: open a folder first.");
    return;
  }
  await applyBindingFromDisk(folder, { silent: true });
  const cfg = getConf(folder.uri);
  const base =
    cfg.get<string>("apiBaseUrl")?.replace(/\/$/, "").trim() ?? "";
  const ws = cfg.get<string>("workspaceId")?.trim() ?? "";
  if (!base || !ws) {
    vscode.window.showErrorMessage(
      "AgentMesh: add .agentmesh.json (apiBaseUrl + workspaceId) or set them in Settings."
    );
    return;
  }

  let initRes: Response;
  try {
    initRes = await fetch(`${base}/api/auth/device/init`, { method: "POST" });
  } catch (e) {
    vscode.window.showErrorMessage(
      `AgentMesh: device init failed — ${e instanceof Error ? e.message : String(e)}`
    );
    return;
  }

  if (!initRes.ok) {
    vscode.window.showErrorMessage(
      `AgentMesh: device init HTTP ${initRes.status}: ${(await initRes.text()).slice(0, 160)}`
    );
    return;
  }

  const initJson = (await initRes.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri_complete?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
  };

  const deviceCode = initJson.device_code?.trim();
  const userCode = initJson.user_code?.trim();
  if (!deviceCode || !userCode) {
    vscode.window.showErrorMessage("AgentMesh: invalid device init response.");
    return;
  }

  const verifyUrlRaw =
    initJson.verification_uri_complete?.trim() ||
    `${initJson.verification_uri ?? `${base}/device`}?user_code=${encodeURIComponent(userCode)}`;
  const u = verifyUrlRaw.startsWith("http")
    ? new URL(verifyUrlRaw)
    : new URL(verifyUrlRaw, `${base}/`);
  u.searchParams.set("bind_workspace", ws);

  await vscode.env.openExternal(vscode.Uri.parse(u.toString()));
  void copyToClipboard(userCode);
  vscode.window.showInformationMessage(
    `AgentMesh: pairing code ${userCode} — pasted to clipboard. Approve in the browser for workspace ${ws.slice(0, 8)}…`,
    "Copy code again"
  ).then((sel) => {
    if (sel === "Copy code again") void copyToClipboard(userCode);
  });

  const deadline = Date.now() + (initJson.expires_in ?? 900) * 1000;
  const pollMs = Math.max(2000, (initJson.interval ?? 5) * 1000);

  while (Date.now() < deadline) {
    await sleep(pollMs);
    let tr: Response;
    try {
      tr = await fetch(`${base}/api/auth/device/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: deviceCode }),
      });
    } catch {
      continue;
    }

    let body: { error?: string; access_token?: string };
    try {
      body = (await tr.json()) as typeof body;
    } catch {
      continue;
    }

    if (tr.ok && body.access_token?.trim()) {
      await extensionContext.secrets.store(
        secretStorageKey(folder),
        body.access_token.trim()
      );
      vscode.window.showInformationMessage(
        "AgentMesh: signed in. Context token stored in Secret Storage."
      );
      return;
    }
    if (body.error === "authorization_pending") continue;
    if (body.error === "expired_token") break;
    vscode.window.showWarningMessage(
      `AgentMesh: device poll — ${body.error ?? tr.status}`
    );
    return;
  }

  vscode.window.showErrorMessage(
    "AgentMesh: authorization expired or was denied. Close any old browser tabs and try Sign in again."
  );
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await vscode.env.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function getConf(scope?: vscode.ConfigurationScope) {
  return vscode.workspace.getConfiguration("agentmesh", scope);
}

function scheduleDebouncedSaveSync(folder: vscode.WorkspaceFolder) {
  const g = getConf(folder.uri);
  if (!g.get<boolean>("syncOnSave")) return;
  const ms = Math.max(400, g.get<number>("syncOnSaveDebounceMs") ?? 2000);
  const key = folder.uri.toString();
  const prev = saveDebounceTimers.get(key);
  if (prev) clearTimeout(prev);
  saveDebounceTimers.set(
    key,
    setTimeout(() => {
      saveDebounceTimers.delete(key);
      void executeSync(folder, { showProgress: false, quiet: true });
    }, ms)
  );
}

async function applyBindingFromDisk(
  folder: vscode.WorkspaceFolder,
  opts: { silent: boolean }
): Promise<boolean> {
  const uri = vscode.Uri.joinPath(folder.uri, ".agentmesh.json");
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    const j = JSON.parse(Buffer.from(raw).toString("utf8")) as AgentmeshBindingFile;

    const cfg = getConf(folder.uri);
    if (typeof j.apiBaseUrl === "string" && j.apiBaseUrl.trim()) {
      await cfg.update(
        "apiBaseUrl",
        j.apiBaseUrl.replace(/\/$/, "").trim(),
        vscode.ConfigurationTarget.WorkspaceFolder
      );
    }
    if (typeof j.workspaceId === "string" && j.workspaceId.trim()) {
      await cfg.update(
        "workspaceId",
        j.workspaceId.trim(),
        vscode.ConfigurationTarget.WorkspaceFolder
      );
    }
    if (typeof j.projectId === "string" && j.projectId.trim().length > 0) {
      await cfg.update(
        "projectId",
        j.projectId.trim(),
        vscode.ConfigurationTarget.WorkspaceFolder
      );
    } else if (j.projectId === "") {
      await cfg.update("projectId", "", vscode.ConfigurationTarget.WorkspaceFolder);
    }

    if (!opts.silent) {
      vscode.window.showInformationMessage(
        "AgentMesh: applied .agentmesh.json to this folder settings."
      );
    }
    return true;
  } catch {
    return false;
  }
}

async function reloadBindingCommand() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage("AgentMesh: open a folder first.");
    return;
  }
  const ok = await applyBindingFromDisk(folder, { silent: true });
  if (ok) {
    vscode.window.showInformationMessage(
      "AgentMesh: reloaded .agentmesh.json (apiBaseUrl / workspaceId / projectId)."
    );
  } else {
    vscode.window.showWarningMessage(
      "AgentMesh: no .agentmesh.json at workspace root."
    );
  }
}

async function selectProjectForSync() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage("AgentMesh: open a folder first.");
    return;
  }
  await applyBindingFromDisk(folder, { silent: true });
  const cfg = getConf(folder.uri);
  const base =
    cfg.get<string>("apiBaseUrl")?.replace(/\/$/, "").trim() ?? "";
  const ws = cfg.get<string>("workspaceId")?.trim() ?? "";
  const token = await effectiveToken(cfg, folder);

  if (!base || !ws) {
    vscode.window.showErrorMessage(
      "AgentMesh: add .agentmesh.json (or set apiBaseUrl + workspaceId in Settings)."
    );
    return;
  }
  if (!token) {
    vscode.window.showErrorMessage(
      "AgentMesh: Sign in with Browser, or set AGENTMESH_TOKEN / agentmesh.contextToken in Settings."
    );
    return;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let res: Response;
  try {
    res = await fetch(`${base}/api/workspaces/${encodeURIComponent(ws)}`, {
      headers,
    });
  } catch (e) {
    vscode.window.showErrorMessage(
      `AgentMesh: request failed: ${e instanceof Error ? e.message : String(e)}`
    );
    return;
  }

  if (!res.ok) {
    const t = await res.text();
    vscode.window.showErrorMessage(`AgentMesh: list projects failed: ${t.slice(0, 200)}`);
    return;
  }

  const data = (await res.json()) as {
    projects?: { id: string; name: string; indexingStatus: string }[];
  };
  const projects = data.projects ?? [];
  if (!projects.length) {
    const pick = await vscode.window.showQuickPick(
      [
        {
          label: "$(add) First sync (create new Project)",
          description: "Clear projectId and run a full sync",
          id: "__new__",
        },
      ],
      { title: "AgentMesh projects" }
    );
    if (!pick || pick.id !== "__new__") return;
    await cfg.update(
      "projectId",
      "",
      vscode.ConfigurationTarget.WorkspaceFolder
    );
    vscode.window.showInformationMessage(
      "AgentMesh: projectId cleared. Run Sync to create a new cloud Project."
    );
    return;
  }

  const items: (vscode.QuickPickItem & { id: string })[] = [
    {
      label: "$(add) Create new Project on next sync",
      description: "Clear stored project id",
      id: "__new__",
    },
    ...projects.map((p) => ({
      label: `${p.name} (${p.indexingStatus})`,
      description: p.id,
      id: p.id,
    })),
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "AgentMesh: bind sync to Project",
  });
  if (!picked) return;

  if (picked.id === "__new__") {
    await cfg.update(
      "projectId",
      "",
      vscode.ConfigurationTarget.WorkspaceFolder
    );
    vscode.window.showInformationMessage("AgentMesh: will create a new Project on next sync.");
  } else {
    await cfg.update(
      "projectId",
      picked.id,
      vscode.ConfigurationTarget.WorkspaceFolder
    );
    vscode.window.showInformationMessage(
      `AgentMesh: sync will update Project ${picked.id.slice(0, 8)}…`
    );
  }
}

async function syncWorkspaceInteractive() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage("AgentMesh: open a folder first.");
    return;
  }
  await executeSync(folder, { showProgress: true, quiet: false });
}

async function executeSync(
  folder: vscode.WorkspaceFolder,
  opts: { showProgress: boolean; quiet: boolean }
): Promise<void> {
  await applyBindingFromDisk(folder, { silent: true });
  const cfg = getConf(folder.uri);
  const base =
    cfg.get<string>("apiBaseUrl")?.replace(/\/$/, "").trim() ?? "";
  const ws = cfg.get<string>("workspaceId")?.trim() ?? "";
  const token = await effectiveToken(cfg, folder);
  const initialProjectId = cfg.get<string>("projectId")?.trim() ?? "";

  if (!base || !ws) {
    if (!opts.quiet) {
      vscode.window.showErrorMessage(
        "AgentMesh: add .agentmesh.json from the web console, or set apiBaseUrl + workspaceId."
      );
    }
    return;
  }
  if (!token) {
    if (!opts.quiet) {
      vscode.window.showErrorMessage(
        "AgentMesh: Sign in with Browser (device code), or set AGENTMESH_TOKEN / agentmesh.contextToken."
      );
    }
    return;
  }

  const run = async () => {
    const hadProjectId = Boolean(initialProjectId);
    let projectId = initialProjectId;
    const pattern = new vscode.RelativePattern(folder, GLOB);
    const uris = await vscode.workspace.findFiles(
      pattern,
      "**/{node_modules,.git,.next,dist,build}/**",
      MAX_FILES
    );

    const files: Record<string, string> = {};
    for (const uri of uris) {
      const rel = vscode.workspace.asRelativePath(uri);
      if (rel.includes("..")) continue;
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString("utf8");
        files[rel] =
          text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
      } catch {
        /* skip */
      }
    }

    if (!Object.keys(files).length) {
      if (!opts.quiet) {
        vscode.window.showWarningMessage("AgentMesh: no matching files to upload.");
      }
      return;
    }

    const name = folder.name;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const body: Record<string, unknown> = { name, files };
    if (projectId) body.projectId = projectId;

    const res = await fetch(
      `${base}/api/workspaces/${encodeURIComponent(ws)}/projects/local`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    const resText = await res.text();
    if (!res.ok) {
      if (opts.quiet) {
        vscode.window.showWarningMessage(
          `AgentMesh auto-sync failed: ${resText.slice(0, 120)}`
        );
      } else {
        vscode.window.showErrorMessage(
          `AgentMesh sync failed: ${resText.slice(0, 200)}`
        );
      }
      return;
    }

    let newId = projectId;
    if (!projectId) {
      try {
        const j = JSON.parse(resText) as { project?: { id?: string } };
        if (j.project?.id) newId = j.project.id;
      } catch {
        /* ignore */
      }
      if (newId) {
        await cfg.update(
          "projectId",
          newId,
          vscode.ConfigurationTarget.WorkspaceFolder
        );
        projectId = newId;
        const bindingUri = vscode.Uri.joinPath(folder.uri, ".agentmesh.json");
        try {
          await vscode.workspace.fs.stat(bindingUri);
          const raw = await vscode.workspace.fs.readFile(bindingUri);
          const parsed = JSON.parse(
            Buffer.from(raw).toString("utf8")
          ) as AgentmeshBindingFile;
          parsed.projectId = newId;
          await vscode.workspace.fs.writeFile(
            bindingUri,
            Buffer.from(JSON.stringify(parsed, null, 2), "utf8")
          );
        } catch {
          /* no file */
        }
      }
    }

    if (!opts.quiet) {
      if (newId && !hadProjectId) {
        const choice = await vscode.window.showInformationMessage(
          "AgentMesh：首次同步完成，已保存云端 Project。是否在保存文件后自动同步？（设置项 agentmesh.syncOnSave）",
          "开启自动同步",
          "暂不"
        );
        if (choice === "开启自动同步") {
          await cfg.update(
            "syncOnSave",
            true,
            vscode.ConfigurationTarget.WorkspaceFolder
          );
        }
      } else {
        vscode.window.showInformationMessage(
          "AgentMesh: project uploaded and re-indexed."
        );
      }
    } else {
      await vscode.window.setStatusBarMessage(
        `AgentMesh: synced (${Object.keys(files).length} files)`,
        2500
      );
    }
  };

  if (opts.showProgress) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "AgentMesh: syncing files…",
        cancellable: false,
      },
      run
    );
  } else {
    await run();
  }
}

async function openChat() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const cfg = folder ? getConf(folder.uri) : vscode.workspace.getConfiguration("agentmesh");
  if (folder) await applyBindingFromDisk(folder, { silent: true });
  const base = cfg.get<string>("apiBaseUrl")?.replace(/\/$/, "").trim() ?? "";
  const ws = cfg.get<string>("workspaceId")?.trim() ?? "";
  if (!base || !ws) {
    vscode.window.showErrorMessage("AgentMesh: configure apiBaseUrl and workspaceId.");
    return;
  }
  const uri = vscode.Uri.parse(
    `${base}/workspace/${encodeURIComponent(ws)}`
  );
  await vscode.env.openExternal(uri);
}

export function deactivate() {}
