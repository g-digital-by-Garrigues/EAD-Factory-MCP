# EAD Factory MCP

[![npm version](https://img.shields.io/npm/v/@g-digital/mcp-ead-factory)](https://www.npmjs.com/package/@g-digital/mcp-ead-factory)
[![npm downloads](https://img.shields.io/npm/dm/@g-digital/mcp-ead-factory)](https://www.npmjs.com/package/@g-digital/mcp-ead-factory)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![provenance](https://img.shields.io/badge/npm-provenance-green)](https://www.npmjs.com/package/@g-digital/mcp-ead-factory)
[![smithery badge](https://smithery.ai/badge/g-digital/ead-factory)](https://smithery.ai/servers/g-digital/ead-factory)

**EAD Factory MCP — Digital Trust services APIs for your agents.**

This MCP server bridges any MCP-compatible agent (Claude Code, Claude Desktop, Cursor, Windsurf, Cline, VS Code, JetBrains, Zed) to EADTrust's Digital Trust services: Evidence Manager (qualified digital evidence + timestamping) and Signature Manager (electronic signature workflows).

> Need credentials? See: [Get your testing credentials here!!](https://webforms.pipedrive.com/f/bYUKJVgt3TZ0QiINtf0mimlgL3BJw79kQaN3i7nXnqoPYabRqYPI5KX9ohhp7T5TTt)

## Quick start

```bash
npx -y @g-digital/mcp-ead-factory
```

You will need Okta credentials (`OKTA_CLIENT_ID` + `OKTA_CLIENT_SECRET`) and at least the Evidence Manager + Signature Manager base URLs for the environment you target (see [Environment URLs](#environment-urls)).

## Where to install

This MCP is published to every major MCP distribution channel by the [g-digital MCP distribution pipeline](https://github.com/g-digital-by-Garrigues/MCP_Market_Distribution). Pick whichever fits your stack:

| Channel | Install command / URL |
|---|---|
| **npm** | `npx -y @g-digital/mcp-ead-factory` — [npmjs.com/package/@g-digital/mcp-ead-factory](https://www.npmjs.com/package/@g-digital/mcp-ead-factory) |
| **Docker Hub** | `docker pull gdigital/ead-factory:latest` — [hub.docker.com/r/gdigital/ead-factory](https://hub.docker.com/r/gdigital/ead-factory) |
| **MCP Official Registry** | Auto-discovered as `io.github.g-digital-by-Garrigues/ead-factory` by any client that reads the registry — [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/v0/servers/io.github.g-digital-by-Garrigues/ead-factory) |
| **n8n community node** | In n8n Settings → Community Nodes → install `@g-digital/n8n-nodes-ead-factory` (works with the AI Agent node via `usableAsTool`) — [npmjs.com/package/@g-digital/n8n-nodes-ead-factory](https://www.npmjs.com/package/@g-digital/n8n-nodes-ead-factory) |
| **Smithery** | `smithery mcp install g-digital/ead-factory` (from v1.0.7) — [smithery.ai/servers/g-digital/ead-factory](https://smithery.ai/servers/g-digital/ead-factory) |

Every channel ships the same MCP server contract; the tools and env-var configuration below apply regardless of which install path you choose.

## Tools

### Evidence Manager

| Tool | Description |
|---|---|
| `generate_evidence` | Full workflow: authenticate → SHA-256 hash → register evidence → upload file to S3 → poll until COMPLETED/ERROR |
| `get_evidence` | Retrieve full evidence details by ID (status, timestamps, custody, metadata) |

### Signature Manager

| Tool | Description |
|---|---|
| `create_signature_request` | Creates a new signature request (DRAFT). Supports `fullFlow=true` to complete the entire flow in one call using preconfigured participants |
| `add_document_to_signature_request` | Adds a document to a DRAFT signature request and uploads the file to S3 |
| `add_signatory_to_document` | Adds a signatory to a document within a signature request |
| `add_validator_to_signatory` | Adds a validator to a signatory (must approve before the signatory can sign) |
| `add_observer_to_document` | Adds an observer to a document (receives notifications but does not sign) |
| `activate_signature_request` | Activates a signature request (DRAFT → ACTIVE), triggering notifications to signatories |
| `get_signature_request` | Retrieves full details of a signature request by ID (status, documents, participants, history) |

## Register the MCP in your client

### Claude Desktop

```json
{
  "mcpServers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

### Claude Code (CLI)

```json
{
  "mcpServers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

### Cursor

```json
{
  "mcpServers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

### Windsurf

```json
{
  "mcpServers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

### Cline

```json
{
  "mcpServers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

### VS Code

```json
{
  "servers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

### JetBrains

```json
{
  "mcpServers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

### Zed

```json
{
  "mcpServers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "API_BASE_URL": "",
        "FULL_FLOW_EMAIL_BASE": "",
        "FULL_FLOW_FILE_PATH": "",
        "HTTP_PORT": "",
        "OKTA_CLIENT_ID": "",
        "OKTA_CLIENT_SECRET": "<PASTE_OKTA_CLIENT_SECRET_HERE>",
        "OKTA_SCOPE": "",
        "OKTA_TOKEN_URL": "",
        "POLL_INTERVAL_MS": "",
        "POLL_MAX_ATTEMPTS": "",
        "SIGNATURE_API_BASE_URL": "",
        "TRANSPORT": ""
      }
    }
  }
}
```

> Need credentials? See: https://eadtrust.example.com/onboarding

## Configuration

| Name | Required | Secret | Description |
| --- | --- | --- | --- |
| `API_BASE_URL` | Yes | No | Evidence Manager API base URL |
| `FULL_FLOW_EMAIL_BASE` | Yes | No | Full flow base email — used to compose participant emails (user+signatory@domain, etc.) |
| `FULL_FLOW_FILE_PATH` | Yes | No | Full flow default file path |
| `HTTP_PORT` | Yes | No | HTTP_PORT |
| `OKTA_CLIENT_ID` | Yes | No | OKTA_CLIENT_ID |
| `OKTA_CLIENT_SECRET` | Yes | Yes | OKTA_CLIENT_SECRET (See https://eadtrust.example.com/onboarding for credential acquisition.) |
| `OKTA_SCOPE` | Yes | No | OKTA_SCOPE |
| `OKTA_TOKEN_URL` | Yes | No | OAuth credentials (Okta client_credentials flow) Used both for calling Evidence Manager API and for verifying incoming Bearer tokens (HTTP mode) |
| `POLL_INTERVAL_MS` | Yes | No | Polling configuration for evidence status |
| `POLL_MAX_ATTEMPTS` | Yes | No | POLL_MAX_ATTEMPTS |
| `SIGNATURE_API_BASE_URL` | Yes | No | Signature Manager API base URL |
| `TRANSPORT` | Yes | No | Transport: "stdio" for local Claude Code, "http" for remote deployment with auth |
### Environment URLs

#### AWS

| Environment | `API_BASE_URL` | `OKTA_TOKEN_URL` |
|---|---|---|
| INT | `https://api.int.gcloudfactory.com/digital-trust` | `https://legalappfactory.okta.com/oauth2/aus5zlw4kr0vhHKyx417/v1/token` |
| PRE | `https://api.pre.gcloudfactory.com/digital-trust` | `https://sso.garrigues.io.builders/oauth2/aus653dgdgTFL2mhw417/v1/token` |
| PRO | `https://api.gcloudfactory.com/digital-trust` | `https://legalappfactory.okta.com/oauth2/aus657e2pcoS6hOS6417/v1/token` |

#### OCI

| Environment | `API_BASE_URL` |
|---|---|
| INT | `https://api.int.eadtrust.gcloudfactory.com/digital-trust` |
| PRO | `https://api.eadtrust.gcloudfactory.com/digital-trust` |


## Remote deployment (HTTP + Bearer auth)

Set `TRANSPORT=http` to run the server as an HTTP service. The `/mcp` endpoint requires a valid Okta Bearer token (verified against the introspection endpoint derived from `OKTA_TOKEN_URL`). The `/health` endpoint is unauthenticated for monitoring.

## Architecture

```
Client (Claude Code / MCP client)
  │
  ├─ stdio ──► McpServer
  │
  └─ HTTP  ──► Express + Bearer auth (Okta introspect) ──► StreamableHTTP ──► McpServer
                                                                │
                                                          tools/call
                                                                │
                                                                ▼
                                                      workflow.service
                                                       ├── auth.service         (Okta client_credentials → token cache)
                                                       ├── hash.service         (SHA-256 from local file)
                                                       ├── evidence.service     (POST /api/v1/private/evidences)
                                                       └── s3-upload.service    (PUT presigned URL + retry)
```

## `generate_evidence` — Input schema

| Field | Type | Required | Description |
|---|---|---|---|
| `filePath` | string | Yes | Absolute path to the file on disk |
| `evidenceId` | string (UUID) | Yes | Unique ID for idempotency |
| `title` | string | Yes | Human-readable title |
| `createdBy` | string | Yes | Creator name (max 50 chars) |
| `capturedAt` | string (ISO 8601) | Yes | Capture datetime |
| `custodyType` | `INTERNAL` \| `EXTERNAL` | No | Defaults to `INTERNAL` |
| `testimonyTSP` | boolean | No | TSP via EADTrust (default `true`) |
| `testimonyDLT` | boolean | No | DLT via Lacnet (requires tenant activation) |
| `requiredTestimonyProviders` | string | No | Comma-separated: `"TSP"`, `"DLT"`, `"TSP,DLT"` |
| `metadata` | string (JSON) | No | Custom key-value pairs as a JSON string |

## API endpoints consumed

- `POST {OKTA_TOKEN_URL}` — OAuth `client_credentials` token
- `POST {API_BASE_URL}/api/v1/private/evidences` — register evidence
- `GET {API_BASE_URL}/api/v1/private/evidences/{id}` — fetch evidence
- `PUT <presigned-s3-url>` — upload file binary

## License

MIT
