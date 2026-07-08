# Onboarding Guide — EAD Factory MCP Server

Get from zero to your first tool call in under 5 minutes.

---

## Step 1 — Get your credentials

Visit [https://digitaltrust.gcloudfactory.com](https://digitaltrust.gcloudfactory.com) to create an account or obtain API credentials.

You will need a **service account** (OAuth2 `client_credentials`): the token endpoint URL, a client ID, and a client secret.

---

## Step 2 — Install the MCP server

### Claude Desktop or Claude Code

Open your configuration file:

- **Claude Desktop (Mac):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Code:** `~/.claude.json`

Add this block inside `"mcpServers"`:

```json
"ead-factory": {
  "command": "npx",
  "args": ["-y", "@g-digital/mcp-ead-factory"],
  "env": {
    "MCP_SVC_TOKEN_URL": "https://your-idp.example.com/oauth2/v1/token",
    "MCP_SVC_CLIENT_ID": "your-client-id",
    "MCP_SVC_CLIENT_SECRET": "your-client-secret"
  }
}
```

Replace the placeholder values with your real service-account credentials (token endpoint URL, client ID, client secret).

---

## Step 3 — Restart Claude

- **Claude Desktop:** Quit and relaunch the app.
- **Claude Code:** Run `/mcp` to verify the server appears in the connected servers list.

The server starts automatically when Claude launches. Startup takes 2–5 seconds on first run (npm downloads the package).

---

## Step 4 — Make your first tool call

Try this prompt in Claude:

```
Using the ead-factory MCP server, call ead_factory_help and summarize what this server can do.
```

Claude will call the `ead_factory_help` tool. If you get back an overview of the Evidence, Signature, and Notification managers, setup is complete — no credentials are needed for this call.

---

## Bundled workflow guides

This package includes step-by-step guides as Claude Code slash-commands. After setup, try:

- `/create-internal-evidence` — opens a guided workflow
- `/create-signature-request` — opens a guided workflow
- `/create-notification-request` — opens a guided workflow

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `"Missing Authorization: Bearer <jwt>"` | HTTP mode: no Bearer header sent | Use stdio mode (npx) or add the Bearer header to your client |
| `"JWT is expired"` | Session token has expired | Claude will auto-refresh; if it fails, restart the server |
| `"Upstream HTTP 401"` | Wrong credentials | Re-check `MCP_SVC_TOKEN_URL` / `MCP_SVC_CLIENT_ID` / `MCP_SVC_CLIENT_SECRET` in your config |
| `"Upstream HTTP 503"` | API temporarily unavailable | Wait 1–2 minutes and retry |
| Tool not found in Claude | Server not connected | Run `/mcp` in Claude Code to verify connection; check Claude Desktop logs |
| `Error: Cannot find package` | npm cache issue | Run `npx --yes @g-digital/mcp-ead-factory` manually once to pre-warm the cache |

For additional help, open an issue on the [g-digital GitHub](https://github.com/g-digital-by-Garrigues) or contact your account team.
