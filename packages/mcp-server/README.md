# @agentmesh/mcp-server

stdio MCP server that exposes workspace semantic search (e.g. `agentmesh_query_context`) against your AgentMesh deployment.

## Environment

| Variable | Description |
|----------|-------------|
| `AGENTMESH_API_BASE_URL` | Web app origin, e.g. `https://app.example.com` or `http://localhost:3000` (no trailing slash). |
| `AGENTMESH_WORKSPACE_ID` | Workspace id from the console / URL. |
| `AGENTMESH_TOKEN` | Member **Context Token** (same as `AGENTMESH_TOKEN` for CLI). Do not commit. |

## Production / end users (intended path)

Once this package is **published to npm** (today it is `private: true` in this monorepo), end users can rely on:

```json
{
  "mcpServers": {
    "agentmesh": {
      "command": "npx",
      "args": ["-y", "@agentmesh/mcp-server"],
      "env": {
        "AGENTMESH_API_BASE_URL": "https://your-deployment.example",
        "AGENTMESH_WORKSPACE_ID": "your_workspace_id",
        "AGENTMESH_TOKEN": "your_context_token"
      }
    }
  }
}
```

They do **not** need to clone the repo or run a local build—only Node/npx and the three env vars.

## Local monorepo development

`npx -y @agentmesh/mcp-server` **will 404** on the public registry while the package remains unpublished. Use the built entrypoint instead:

1. From the **repository root**:

   ```bash
   npm run build -w @agentmesh/mcp-server
   ```

2. Point MCP at `dist/index.js` with an **absolute path** (adjust to your machine):

   ```json
   {
     "mcpServers": {
       "agentmesh": {
         "command": "node",
         "args": ["/absolute/path/to/multiagent/packages/mcp-server/dist/index.js"],
         "env": {
           "AGENTMESH_API_BASE_URL": "http://localhost:3000",
           "AGENTMESH_WORKSPACE_ID": "your_workspace_id",
           "AGENTMESH_TOKEN": "your_context_token"
         }
       }
     }
   }
   ```

3. Re-run the build after changing MCP server code.

## Clients

- **Cursor / VS Code family**: merge the `mcpServers` block into your MCP settings JSON.
- **Antigravity**: `Manage MCP servers` → `View raw config`, or edit `~/.gemini/antigravity/mcp_config.json` on macOS.

Restart the IDE (or refresh MCP) after edits.

## CLI binary

After `npm run build -w @agentmesh/mcp-server`, the published `bin` is `agentmesh-mcp` → `dist/index.js`.
