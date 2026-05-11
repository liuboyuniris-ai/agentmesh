# AgentMesh (VS Code / Cursor extension)

Current version: **0.2.0**

## Install

### From VSIX (release / CI artifact)

```bash
cd extensions/agentmesh-vscode && npm install && npm run compile && npm run package
```

Install the generated `.vsix` via **Extensions → … → Install from VSIX…**.

### From source (debug)

Open `extensions/agentmesh-vscode` in VS Code / Cursor, **Run → Start Debugging** (launch extension host).

## Configure

1. In your **project root**, add `.agentmesh.json` from the Workspace web console (高级 → 复制模板).
2. Set **`AGENTMESH_TOKEN`** in the environment before launching the editor, **or** set `agentmesh.contextToken` in workspace settings.
3. **Push to cloud:** command **AgentMesh: Push to Cloud** or keybinding **⌘⇧Y** / **Ctrl+Shift+Y**.
4. Optional: enable **`agentmesh.syncOnSave`** for debounced auto-sync after save. After the **first successful sync**, the extension may ask whether to turn this on.

## Settings

| ID | Description |
|----|-------------|
| `agentmesh.apiBaseUrl` | Web app origin (default `http://localhost:3000`) |
| `agentmesh.workspaceId` | Workspace id |
| `agentmesh.contextToken` | Bearer token (optional if `AGENTMESH_TOKEN` is set) |
| `agentmesh.projectId` | Existing cloud project id for overwrite sync |
| `agentmesh.syncOnSave` | Auto-sync after save |
| `agentmesh.syncOnSaveDebounceMs` | Debounce (default `2000`) |

## CLI alternative

To sync **without** the IDE extension, use **`agentmesh-sync@0.3.1`** (`npm i -D agentmesh-sync`) — see `apps/cli/README.md`.
