# EAD Factory MCP v1.5.0

The evidence tools now work against the platform, signature and notification flows are
more reliable, and a new diagnostic tool checks your setup. Verified live on EAD Factory
INT; production has not been verified yet.

## Your credential does not change

The service account (OAuth2 client credentials) is still the only supported flow, with
the same variables as 1.4.0.

## Fixed

- **No more false errors on evidence.** `evidence_case_file_create`,
  `evidence_group_create`, `evidence_case_file_relationship_assign` and
  `generate_evidence` reported MCP error -32602 after a call that had worked. They now
  return `{ data: {} }`, plus `nextSteps` where the tool has them.
- **`evidence_create_sealed` works.** It failed at its first step in 1.4.0. It now
  creates the group id itself and sends it as the unique `code`, asks `EADTrust` for a
  timestamp by default, accepts an optional per-evidence `testimony` (`TSP` / `DLT`), and
  rejects an inconsistent testimony before creating anything.
- **`evidence_multipart_upload_start` works.** It returns the upload id as
  `{ data: "<id>" }` instead of a JSON parse error. Pass it a new evidence id: it
  registers the evidence itself, and an existing id answers 409.
- **`signature_request_full` waits until the documents are ready** before activating,
  instead of failing with "Network error".
- **Search filters apply.** Query objects are sent flat (`size=1`, not `filter[size]=1`);
  the API ignored the bracketed form, so searches came back unfiltered.
- **`notification_request_send` works from any MCP client** and completes through its own
  bounded polling (about 100 s).
- **`notification_receiver_add` accepts `SMTP` / `NOTICEMAN` / `SMS` / `WFB`** as
  providers, as its description always said.
- **Errors keep the platform's reason**, including field-by-field validation errors.
- **A blank `MCP_TRANSPORT=` starts in stdio** (1.4.0 refused to start).

## New

- **`ead_factory_health`**: a read-only check of your setup — a fresh token and one
  read-only call per manager (Evidence, Signature, Notification). Not registered when
  `MCP_HTTP_PUBLIC=true`.
- **Optional inputs:** `ignoreNotCompletedEvidences` on both report tools,
  `notificationProvider` on `create_signature_request`, and `provider` on
  `add_signatory_to_document`, `add_validator_to_signatory` and
  `add_observer_to_document`.
- **Timestamping:** only TSP (`EADTrust`) is available today. DLT (Hedera) is coming soon;
  until the platform enables it, asking for a DLT provider answers 400
  `PROVIDER_NOT_CONFIGURED`.

## May affect existing callers

- `evidence_case_file_relationship_assign` and `evidence_multipart_upload_start` now
  return `{ data: … }`; `evidence_create_sealed` returns `sealedEvidences` (id and
  sha256). In 1.4.0 these calls ended in an error anyway.
- `template` on `evidence_case_file_report_preview` / `_generate` must match
  `^[A-Z][A-Z0-9_]+$`.
- Known, unchanged: search filters that take arrays (`id`, `groupId`, `groupType`) fail
  before any request is sent.

## Tools

65 tools, up from 64 (64 when `MCP_HTTP_PUBLIC=true`).

## Configuration

Nothing to change. `.env.example` now also documents six optional variables the server
already read: `MCP_TRANSPORT`, `MCP_BRIDGE_STATE_FILE`, `MCP_FILE_MAX_BYTES`,
`MCP_FILE_ALLOWED_ROOTS`, `MCP_FILE_URL_ALLOWED_HOSTS` and `MCP_OTEL_ENABLED`. The Docker
image starts the HTTP transport; to use it from an MCP client over stdio, add
`-e MCP_TRANSPORT=stdio` to `docker run`.

## Upgrading the n8n connector

<!-- N8N_UPGRADE -->
### From 1.4.x

**The credential does not change.** A credential you create from now on has its API Base
URL pre-filled with the production gateway (`https://api.gcloudfactory.com`); change it
to reach another environment. Credentials you already have keep the URL you stored.

**One operation is gone: Notice Manager → NM Create Document Download Url.** It is now a
helper inside the MCP server that follows the platform's redirect, so it has no single
REST call behind it. If a saved workflow still contains it, that node no longer has a
valid operation: remove it.

**JSON fields you type into the node now reach the API as JSON** — the filter, order and
page of list operations and the other JSON fields. In 1.4.0 a typed value was sent as
plain text and refused; values written as expressions were not affected.

**Search filters now apply.** A list that used to come back unfiltered now respects its
filter, so a workflow may see fewer items than before.

**Evidence operations no longer fail after a call that worked**, and a few gained
optional fields: `provider` on the signatory / validator / observer operations,
`notificationProvider` on Create Signature Request, and `ignoreNotCompletedEvidences` on
the case-file report operations.

### From 1.3.x

**The credential does not change. Update the node and carry on.** Nothing to
re-create, nothing to re-select on your nodes.

**One thing is worth checking.** Two bulk Evidence operations described their
**Request ID** field incorrectly. If you built a workflow around what it said, that
workflow is wrong.

| Operation | The field used to say | What it actually is |
|---|---|---|
| **Evidence Case File Delete Bulk** | "UUID of the notification request. Obtain from `notification_request_create`." | A UUID **you** generate to identify this bulk request. It does not come from any other operation, and it is not a notification request id. Send a fresh one per batch. |
| **Evidence Group Delete Bulk** | the same | the same |

If either step is being fed an id produced by a Notification operation, replace it
with one you generate yourself.

**Notification Request Create said the same sentence about its own Request ID**, which
pointed the caller back at the very operation the field belongs to. That field is
optional: supply a UUID only if you want to choose the new request's id yourself, omit
it and the API assigns one, and either way the call returns the id that the other
Notification operations need.

Six other fields carry that same sentence and are correct: they really do take an id
that `notification_request_create` returns.
<!-- /N8N_UPGRADE -->
