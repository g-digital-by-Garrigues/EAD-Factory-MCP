# EAD Factory — n8n connector

> Connect to EAD Factory to generate certified digital evidence and manage signature request workflows.

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
| `generate_evidence` | Hash a local file, register it as certified evidence, upload it to S3, and wait until processing completes. |
| `get_evidence` | Retrieve full details of an evidence record by its ID, including status, timestamps, and custody info. |
| `create_signature_request` | Create a new signature request, optionally running the full setup flow with document, signatory, and activation. |
| `add_document_to_signature_request` | Attach a document to an existing signature request and upload its file content to secure storage. |
| `add_signatory_to_document` | Add a signatory to a document within a draft signature request and return the created signatory ID. |
| `add_observer_to_document` | Add an observer to a document within a draft signature request and return the created observer ID. |
| `add_validator_to_signatory` | Add a validator to a signatory on a document and return the created validator ID. |
| `activate_signature_request` | Activate a draft signature request, triggering status change to ACTIVE and notifying all signatories. |
| `get_signature_request` | Retrieve full details of a signature request by ID, including status, documents, and participants. |

## Credentials

This node requires a "EAD Factory API" credential with the following fields:

| Field | Description | Secret? |
|---|---|---|
| `API Base URL` | Base URL of the EAD Factory REST API. Leave blank only if you know your environment uses a different endpoint. | no |
| `API_BASE_URL` | The base URL for the Evidence Manager API provided by EAD Factory. | no |
| `FULL_FLOW_EMAIL_BASE` | Base email address used to generate participant addresses in the full signature flow. | no |
| `FULL_FLOW_FILE_PATH` | Default local file path used when running the full signature flow. | no |
| `HTTP_PORT` | Port number the MCP server listens on when running in HTTP transport mode. | no |
| `OKTA_CLIENT_ID` | Client ID for your Okta application, obtained from your EAD Factory onboarding credentials. | no |
| `OKTA_CLIENT_SECRET` | Client secret for your Okta application, obtained from your EAD Factory onboarding credentials. | yes |
| `OKTA_SCOPE` | OAuth scope(s) requested when authenticating with Okta for EAD Factory API access. | no |
| `OKTA_TOKEN_URL` | Okta token endpoint URL used to obtain access tokens via the client credentials flow. | no |
| `POLL_INTERVAL_MS` | Milliseconds to wait between status checks when polling for evidence completion. | no |
| `POLL_MAX_ATTEMPTS` | Maximum number of status polling attempts before the evidence operation times out. | no |
| `SIGNATURE_API_BASE_URL` | The base URL for the Signature Manager API provided by EAD Factory. | no |
| `TRANSPORT` | Set to stdio for local use or http for remote deployment with Bearer token authentication. | no |
> **Need credentials?** Sign up or log in at [https://eadtrust.example.com/onboarding](https://eadtrust.example.com/onboarding).

## Use as an AI Agent tool

This node is flagged `usableAsTool: true`, so any n8n AI Agent (n8n ≥ 1.79.0) can consume it dynamically: drag it into the workflow and wire its main output to an AI Agent's "Tool" input.

For best results pair with an AI Agent node running **V2** — V3 has a known empty-tool-response bug in some recent n8n versions (see [n8n issue #26202](https://github.com/n8n-io/n8n/issues/26202)).

## License

MIT. See [LICENSE](./LICENSE).
