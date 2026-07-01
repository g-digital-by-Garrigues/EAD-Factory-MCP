# EAD Factory MCP Server

[![npm version](https://img.shields.io/npm/v/@g-digital/mcp-ead-factory)](https://www.npmjs.com/package/@g-digital/mcp-ead-factory)
[![npm downloads](https://img.shields.io/npm/dm/@g-digital/mcp-ead-factory)](https://www.npmjs.com/package/@g-digital/mcp-ead-factory)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![provenance](https://img.shields.io/badge/npm-provenance-green)](https://www.npmjs.com/package/@g-digital/mcp-ead-factory)
[![smithery badge](https://smithery.ai/badge/g-digital/ead-factory)](https://smithery.ai/servers/g-digital/ead-factory)

MCP server for EAD Factory: qualified evidence, signature, notifications and chat via AI agents.

## Quick start

```bash
npx -y @g-digital/mcp-ead-factory
```

Or see [ONBOARDING.md](ONBOARDING.md) for a step-by-step setup guide (≤ 5 minutes).

## Where to install

This MCP is published to every major MCP distribution channel by the [g-digital MCP distribution pipeline](https://github.com/g-digital-by-Garrigues/MCP_Market_Distribution). Pick whichever fits your stack:

| Channel | Install command / URL |
|---|---|
| **npm** | `npx -y @g-digital/mcp-ead-factory` — [npmjs.com/package/@g-digital/mcp-ead-factory](https://www.npmjs.com/package/@g-digital/mcp-ead-factory) |
| **Docker Hub** | `docker pull gdigital/ead-factory:latest` — [hub.docker.com/r/gdigital/ead-factory](https://hub.docker.com/r/gdigital/ead-factory) |
| **MCP Official Registry** | Auto-discovered as `io.github.g-digital-by-Garrigues/ead-factory` — [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/v0/servers/io.github.g-digital-by-Garrigues/ead-factory) |
| **n8n community node** | Install `@g-digital/n8n-nodes-ead-factory` in n8n Settings → Community Nodes — [npmjs.com/package/@g-digital/n8n-nodes-ead-factory](https://www.npmjs.com/package/@g-digital/n8n-nodes-ead-factory) |
| **Smithery** | `smithery mcp install g-digital/ead-factory` — [smithery.ai/servers/g-digital/ead-factory](https://smithery.ai/servers/g-digital/ead-factory) |

Every channel ships the same MCP server contract; the tools and environment configuration below apply regardless of which install path you choose.

> Need credentials? Visit: [https://digitaltrust.gcloudfactory.com](https://digitaltrust.gcloudfactory.com)

## Installation

<!-- INSTALL_BLOCKS -->

### Claude Desktop / Claude Code

Add to your `~/.claude.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ead-factory": {
      "command": "npx",
      "args": ["-y", "@g-digital/mcp-ead-factory"],
      "env": {
        "MCP_AUTH_EMAIL": "your-email@example.com",
        "MCP_AUTH_PASSWORD": "your-password"
      }
    }
  }
}
```

### Docker

```bash
docker run --rm -i \
  -e MCP_AUTH_EMAIL=your-email@example.com \
  -e MCP_AUTH_PASSWORD=your-password \
  gdigital/ead-factory:latest
```

## Environment Variables

<!-- ENV_VARS -->

| Variable | Required | Description |
|---|---|---|
| `MCP_AUTH_EMAIL` | One of flow 1 or 2 | Your account email |
| `MCP_AUTH_PASSWORD` | One of flow 1 or 2 | Your account password |
| `MCP_OPENID_ISSUER` | One of flow 1 or 2 | OpenID Connect issuer URL |
| `MCP_OPENID_CLIENT_ID` | One of flow 1 or 2 | OpenID Connect client ID |
| `MCP_OPENID_REFRESH_TOKEN` | One of flow 1 or 2 | OpenID Connect refresh token |
| `MCP_AUTH_JWT` | Optional | Pre-seeded JWT (skips interactive login) |
| `MCP_OTEL_ENABLED` | Optional | Set to `true` to enable OpenTelemetry tracing |
| `MCP_API_BASE_URL` | Optional | Override upstream API base URL |

## Bundled Skills

This package ships Claude Code slash-commands under `.claude/commands/`. After install, invoke them from Claude Code:

- `/create-internal-evidence` — step-by-step workflow guide
- `/create-signature-request` — step-by-step workflow guide
- `/create-notification-request` — step-by-step workflow guide

See [docs/agent-prompts.md](docs/agent-prompts.md) for end-to-end prompt examples and the tool sequences they trigger.

## Available Tools

This server exposes **63 tools**:

| Tool | Description |
|------|-------------|
| `evidence_case_file_delete_bulk` | Delete bulk case files |
| `evidence_case_file_search` | Search case file with filters |
| `evidence_case_file_create` | Creates a new case file — the top-level container for evidence groups, evidence, and reports. Use this first, before any other Evidence-manager tool. No prerequisites. Example: evidence_case_file_create({ name: 'Q1 2026 audit' }) returns { id, ... } — use the returned id as caseFileId in evidence_group_create. |
| `evidence_case_file_update_bulk` | Update a case files |
| `evidence_case_file_get` | Retrieves a case file's details by id. Use to confirm a case file exists, or to check its status before creating evidence groups or reports under it. Requires: evidence_case_file_create → caseFileId. |
| `evidence_case_file_update` | Update a case file |
| `evidence_case_file_relationship_assign` | Create a new relationship assigned to a case file in the system |
| `evidence_case_file_report_preview` | Generate Case File ReportPreview |
| `evidence_case_file_report_generate` | Generate Case File signed report |
| `evidence_case_file_report_update` | Update case file report |
| `evidence_case_file_report_pdf_url_get` | Get report PDF URL |
| `evidence_case_file_report_zip_url_get` | Get report ZIP URL |
| `evidence_case_file_status_update` | Update case file status |
| `evidence_report_delete` | Delete report |
| `evidence_group_evidence_register` | Register a new evidence in a group — the first step of a 2-step upload (register, then PUT the file bytes to the returned upload URL). Use for each file you want to add to an OPEN evidence group. Requires: evidence_group_create → evidenceGroupId, evidence_case_file_create → caseFileId, and the file's SHA-256 hash (compute it before calling, or use the evidence_create_sealed composite tool which does this for you). Do not call evidence_group_close until every registered evidence's bytes have been uploaded. Custody type: INTERNAL = EAD Factory stores and custodies the file itself. | EXTERNAL = The file lives outside EAD Factory — you attest to its hash only, EAD Factory never stores the bytes. Testimony (qualified proof) provider family: TSP = Trusted Service Provider — eIDAS-qualified electronic timestamp; the legally strongest proof tier. | DLT = Distributed Ledger Technology — blockchain-anchored proof; immutable and independently verifiable. |
| `evidence_group_evidence_get` | Get evidence in group details |
| `evidence_group_evidence_delete` | Delete evidence |
| `evidence_group_evidence_download_url_create` | Create download url |
| `evidence_group_evidence_upload_url_create` | Create upload url |
| `evidence_thumbnail_url_get` | Get the evidence image thumbnail URL |
| `evidence_search` | Search evidences |
| `generate_evidence` | Register a new evidence (legacy top-level name; not scoped to a specific evidence group at creation time, unlike evidence_group_evidence_register). Use for standalone evidence outside the group-based flow, or for continuity with the legacy EAD-Factory-MCP integration. Requires the file's SHA-256 hash. Prefer evidence_create_sealed for a new, complete evidence group + evidence + seal flow. Custody type: INTERNAL = EAD Factory stores and custodies the file itself. | EXTERNAL = The file lives outside EAD Factory — you attest to its hash only, EAD Factory never stores the bytes. Testimony (qualified proof) provider family: TSP = Trusted Service Provider — eIDAS-qualified electronic timestamp; the legally strongest proof tier. | DLT = Distributed Ledger Technology — blockchain-anchored proof; immutable and independently verifiable. |
| `evidence_update_bulk` | Update evidences |
| `get_evidence` | Retrieves an evidence record's details and status by id (legacy top-level name). Use to check an evidence's timestamping status (IN_PROCESS / COMPLETED / ERROR) after registration. Requires: generate_evidence or evidence_group_evidence_register → evidenceId. |
| `evidence_delete` | Delete evidence |
| `evidence_update` | Update evidence |
| `evidence_download_url_create` | Create download url |
| `evidence_upload_url_create` | Create upload url |
| `evidence_temp_file_upload_url_create` | Create upload url temporary file |
| `evidence_multipart_upload_start` | Create upload url temporary file |
| `evidence_group_delete_bulk` | Delete bulk evidence groups |
| `evidence_group_create` | Creates an evidence group inside a case file — evidence records are always registered inside a group, never standalone (except via the legacy generate_evidence tool). Use when starting a new batch of related evidence (e.g. all files for one incident). Requires: evidence_case_file_create → caseFileId. Example: evidence_group_create({ caseFileId, type: 'FILE' }) returns { id, status: 'OPEN' } — use the returned id as evidenceGroupId in evidence_group_evidence_register, then evidence_group_close once every evidence in the group has been uploaded. |
| `evidence_group_get` | Get evidence group details |
| `evidence_group_discard` | Discard an evidence group |
| `evidence_group_update` | Update evidence group |
| `evidence_group_close` | Seals (closes) an evidence group, triggering qualified timestamping — after this, no more evidence can be added. Use only after every evidence registered in the group has had its file bytes uploaded to the presigned URL from evidence_group_evidence_register. Requires: evidence_group_create → evidenceGroupId, evidence_case_file_create → caseFileId, and the current evidencesCount. ASYNC: the group transitions OPEN → CLOSING → CLOSED; poll evidence_group_get until status is CLOSED before generating a report. Prefer the evidence_create_sealed composite tool for a new group — it registers, uploads, closes, and waits for CLOSED in one call. |
| `evidence_group_search` | Search evidence group |
| `evidence_group_update_bulk` | Update evidence groups |
| `evidence_report_pdf_url_get` | Get the report PDF document |
| `evidence_report_zip_url_get` | Get the report ZIP package document |
| `create_signature_request` | Creates a new signature request — the top-level container for documents and signatories in a signing flow. Use this first, before add_document_to_signature_request. No prerequisites. Example: create_signature_request({ name: 'NDA — Acme Corp', createdBy: 'jane@company.com' }) returns { id, ... } — use the returned id as signatureRequestId in subsequent calls. |
| `add_document_to_signature_request` | Adds a document to a signature request — the first step of a 2-step upload (add, then PUT the file bytes to the returned upload URL). Use once per document that needs signing. Requires: create_signature_request → signatureRequestId, and the document's SHA-256 hash (compute it before calling, or use the signature_request_full composite tool). Add signatories with add_signatory_to_document before activating. Signature type: INTERPOSITION = EAD Factory mediates the signing act on the signatory's behalf (e.g. an OTP sent via WhatsApp/SMS) — the signatory needs no software or certificate. | ADVANCED = Advanced electronic signature — the signatory signs directly (signing pad or certificate); a stronger legal tier than INTERPOSITION. | OTHER = A signature type not covered by INTERPOSITION or ADVANCED. |
| `add_signatory_to_document` | Adds a signatory (by name + email) to a document within a signature request. Use once per person who needs to sign that specific document. Requires: create_signature_request → signatureRequestId, add_document_to_signature_request → documentId. Add all signatories before calling activate_signature_request — signatories cannot be added after activation. |
| `add_validator_to_signatory` | Add validator for a signatory |
| `add_observer_to_document` | Create observer |
| `activate_signature_request` | Activates a signature request, sending signing notifications to every added signatory — after this, no more documents or signatories can be added (use add_validator_to_signatory / add_observer_to_document before activating if you need those roles). Requires: create_signature_request → signatureRequestId, at least one document (add_document_to_signature_request) with its bytes uploaded, and at least one signatory per document (add_signatory_to_document). Prefer signature_request_full for a new request — it creates, adds documents+signatories, and activates in one call. |
| `get_signature_request` | Retrieves a signature request's details and status by id (legacy top-level name). Use to check signing progress after activation. Requires: create_signature_request → signatureRequestId. |
| `signature_request_list` | List signature requests, optionally filtered by close condition among other criteria. Use to find a request when you don't have its id (e.g. by name or status). Signature-request close condition: ALL_REQUIRED = The request only closes once EVERY signatory has signed. | PARTIAL_ALLOWED = The request can close once the minimum required signatories have signed, even if others haven't yet. |
| `signature_request_cancel` | Cancels an active signature request — no further signing can occur. Use when a request was activated in error or is no longer needed. Requires: create_signature_request → signatureRequestId. Cannot be undone. |
| `signature_certificate_generate` | Generates the well-signed appearance certificate document for a signature request. Use once every signatory has signed (check with get_signature_request). Requires: create_signature_request → signatureRequestId. Unlike EAD Enterprise's equivalent tool (a GET that polls an already-generated URL), this triggers generation and returns the result in the same call. |
| `signature_coordinate_set` | Sets the on-page (x, y, page) coordinates where a signatory's signature appears on a document. Use after add_signatory_to_document if the signature placement needs to be explicit rather than auto-positioned. Requires: create_signature_request → signatureRequestId, add_document_to_signature_request → documentId, add_signatory_to_document → signatoryId. |
| `notification_request_create` | Creates a new notification request (draft) — the top-level container for receivers and attachments in a certified-notification flow. Use this first, before any other Notification-manager tool. No prerequisites. Set `autosend: true` to also send immediately on activation of the first receiver batch, or leave it false to add receivers/documents over several calls before calling notification_request_send yourself. Returns requestId and one notificationId per receiver already on the request (if any were included inline). |
| `notification_request_send` | Activates a notification request, triggering delivery to every added receiver across their configured channels. Runs as an MCP Task (bounded-polling until every receiver's notification leaves its in-flight state — EAD Factory's upstream emits no events for this transition). Requires: notification_request_create → requestId, at least one receiver (notification_receiver_add). Use notification_request_status to check progress without waiting for the Task to complete. |
| `notification_request_status` | Searches notifications, optionally filtered by requestId and/or delivery state — the closest equivalent to "checking a request's status": a request fans out into one notification per receiver, each with its own state history, so this returns every notification matching the filter with its current state. Omit requestId to search across every request. Requires: notification_request_create → requestId (if filtering to one request). |
| `notification_receiver_add` | Adds one or more receivers to a draft notification request — each receiver becomes its own per-channel notification under the shared requestId (there is no separate receiverId; track receivers by the notificationIds this call returns). Use once per batch of receivers before calling notification_request_send. Requires: notification_request_create → requestId. Each receiver's shape depends on its `provider` (SMTP/SMS/NOTICEMAN/WFB) — see the schema for the fields each variant needs. Notification delivery provider: SMTP = Email delivery. | SMS = SMS text message delivery. | NOTICEMAN = EAD Factory's own certified notification channel (qualified electronic delivery). | NOTICEMAN_AND_WHATSAPP = Certified channel plus a WhatsApp copy. | NOTICEMAN_AND_WHATSAPP_AND_RCS = Certified channel plus WhatsApp and RCS copies. | NOTICEMAN_AND_RCS = Certified channel plus an RCS (Rich Communication Services) copy. | WFB = WhatsApp Business messaging, uncertified (no Noticeman qualified channel). | RCS = RCS (Rich Communication Services) messaging only, uncertified. |
| `notification_document_add` | Registers one or more document attachments (metadata only — fileName + SHA-256 hash) on a draft notification request. Use once per batch of documents before activating. Requires: notification_request_create → requestId. This only registers metadata; call notification_document_upload_url_create for each registered attachment to get a URL to PUT the actual file bytes to. |
| `notification_document_upload_url_create` | Creates a presigned upload URL for a document attachment already registered via notification_document_add — PUT the file bytes to the returned URL. Requires: notification_request_create → requestId, notification_document_add → attachmentId. |
| `notification_document_download_url_create` | Creates a presigned download URL for a document attachment on a notification request. Requires: notification_request_create → requestId, notification_document_add → attachmentId. |
| `notification_certificate_generate` | Generates a delivery-certificate report for one or more notifications on a request. Use once notification_request_status shows the relevant notifications have left their in-flight state. Requires: notification_request_create → requestId, notification_request_status → notificationIds. Returns a reportId — call notification_certificate_pdf_url_get with it to get the actual download URL (2-step, same shape as Evidence's report tools). |
| `notification_certificate_pdf_url_get` | Retrieves the download URL for a previously generated notification delivery certificate. Requires: notification_certificate_generate → reportId. |
| `evidence_create_sealed` | Evidence Create Sealed (custom tool). |
| `signature_request_full` | Signature Request Full (custom tool). |
| `ead_factory_help` | Ead Factory Help (custom tool). |

## Coexistence

This MCP server is the **current, actively maintained** interface for the EAD Factory (Digital Trust) platform.

It coexists safely with any other MCP servers in your setup — it exposes only EAD-Factory-namespaced tools and shares no local state with other servers.

## License

MIT — see [LICENSE](LICENSE).
