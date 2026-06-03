# EAD Factory — n8n connector

> Connect to EAD Factory to generate certified digital evidence and manage qualified signature request workflows.

Install this connector and use EAD Factory operations as steps inside any n8n workflow. Each operation maps to one capability of the underlying EAD Factory platform.

## Install (self-hosted n8n)

```bash
npm install @g-digital/n8n-nodes-ead-factory
```

Then restart n8n. The node will appear in the Nodes panel under "EAD Factory".

## Using with n8n AI Agent

For AI-driven automation, configure an **n8n AI Agent node** with the following system prompt. It covers all lifecycle workflows: evidence creation, certified notifications, signature processes, dossier certification, and certified chats.

**→ Full system prompt and workflow guide:** [`@g-digital/n8n-agent-system-prompt`](https://www.npmjs.com/package/@g-digital/mcp-gocertius) — see the `docs/n8n-agent-workflows/gocertius-ead-system-prompt.md` in [MCP_Market_Distribution](https://github.com/g-digital-by-Garrigues/MCP_Market_Distribution/blob/main/docs/n8n-agent-workflows/gocertius-ead-system-prompt.md).

### Quick system prompt snippet

Paste this into your AI Agent node's **System Message**:

```
You are a Digital Trust assistant using the EAD Factory n8n connector.
UUID generation: generate UUID v4 for all `id` fields you must supply.
IDs from responses: never invent path parameters — always use values returned by previous tool calls.
Async operations: after evidence_seal, dossier_certify, signature activation, and chat certification — poll the corresponding list/status tool until the terminal state is reached before proceeding.
File uploads: when a tool returns uploadFileUrl or url, PUT the file bytes there with a separate HTTP Request node before calling the next step.
See the full lifecycle guide at: https://github.com/g-digital-by-Garrigues/MCP_Market_Distribution/blob/main/docs/n8n-agent-workflows/gocertius-ead-system-prompt.md
```

## Operations

| Operation | Description |
|---|---|
| `generate_evidence` | Hashes a local file, registers it as certified evidence, uploads it to S3, and returns the completed evidence details. |
| `get_evidence` | Retrieves full details of an evidence record by its ID, including status, timestamps, and custody information. |
| `create_signature_request` | Creates a new signature request, optionally running the full flow to add participants and activate it automatically. |
| `add_document_to_signature_request` | Attaches a document to an existing signature request and uploads the file content via a secure presigned URL. |
| `add_signatory_to_document` | Adds a signatory to a document inside a draft signature request and returns the new signatory ID. |
| `add_observer_to_document` | Adds an observer to a document inside a draft signature request and returns the new observer ID. |
| `add_validator_to_signatory` | Assigns a validator to a signatory within a document and returns the created validator details. |
| `activate_signature_request` | Moves a signature request from draft to active, triggering notification emails to all signatories. |
| `get_signature_request` | Retrieves full details of a signature request by ID, including status, documents, and all participants. |

## Credentials

This node requires a "EAD Factory API" credential with the following fields:

| Field | Description | Secret? |
|---|---|---|
| `API Base URL` | Base URL of the EAD Factory REST API. Leave blank only if you know your environment uses a different endpoint. | no |
| `API_BASE_URL` | The base URL of your EAD Factory Evidence Manager API endpoint. | no |
| `FULL_FLOW_EMAIL_BASE` | The base email address used to generate participant addresses in full-flow signature requests. | no |
| `FULL_FLOW_FILE_PATH` | The default local file path used when running a full-flow signature request automatically. | no |
| `HTTP_PORT` | The port number the MCP server listens on when running in HTTP transport mode. | no |
| `OKTA_CLIENT_ID` | The client ID of your Okta application, obtained from your EAD Factory onboarding credentials. | no |
| `OKTA_CLIENT_SECRET` | The client secret of your Okta application, obtained from your EAD Factory onboarding credentials. | yes |
| `OKTA_SCOPE` | The OAuth scope string required by your Okta application for EAD Factory API access. | no |
| `OKTA_TOKEN_URL` | The Okta token endpoint URL used to obtain access tokens via the client credentials flow. | no |
| `POLL_INTERVAL_MS` | Milliseconds to wait between status checks when polling for evidence completion. | no |
| `POLL_MAX_ATTEMPTS` | Maximum number of polling attempts before giving up on an evidence status check. | no |
| `SIGNATURE_API_BASE_URL` | The base URL of your EAD Factory Signature Manager API endpoint. | no |
| `TRANSPORT` | Set to stdio for local use or http for remote deployment with bearer token authentication. | no |
> **Need credentials?** Sign up or log in at [https://eadtrust.example.com/onboarding](https://eadtrust.example.com/onboarding).

## Use as an AI Agent tool

This node is flagged `usableAsTool: true`, so any n8n AI Agent (n8n ≥ 1.79.0) can consume it dynamically: drag it into the workflow and wire its main output to an AI Agent's "Tool" input.

For best results pair with an AI Agent node running **V2** — V3 has a known empty-tool-response bug in some recent n8n versions (see [n8n issue #26202](https://github.com/n8n-io/n8n/issues/26202)).

## License

MIT. See [LICENSE](./LICENSE).
