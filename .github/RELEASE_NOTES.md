# EAD Factory MCP v1.4.0

## Your credential does not change

The service account (OAuth2 client credentials) is still the only supported flow, and
its variables are exactly what they were. Nothing to re-create, nothing to
re-configure.

| Variable | Secret | Notes |
|---|---|---|
| `MCP_SVC_TOKEN_URL` | no | Required. Unchanged. |
| `MCP_SVC_CLIENT_ID` | no | Required. Unchanged. |
| `MCP_SVC_CLIENT_SECRET` | yes | Required. Unchanged. |
| `MCP_SVC_SCOPE` | no | Optional. Unchanged. |

`MCP_SVC_INTROSPECT_URL` and the `MCP_API_BASE_URL*` set are unchanged too.

## The server now refuses to start on an incomplete auth config

It used to log the problem and carry on with no credential at all. The process
reported healthy while every upstream call went out unauthenticated, and the first
symptom was a 401 a long way from the cause. It now stops instead.

The case that changes in practice: `MCP_SVC_CLIENT_ID` and `MCP_SVC_CLIENT_SECRET`
set, `MCP_SVC_TOKEN_URL` missing. That deployment used to boot. It now refuses to
start, and says why.

`MCP_SVC_TOKEN_URL` was already declared required, so nothing that was configured
correctly is affected by this.

## `MCP_AUTH_JWT` is no longer recognised

It was never part of this server's declared configuration — it has never appeared in
`.env.example` — but earlier copies of this README listed it, and setting it did work.
It selected a pre-seeded-session path shared with the other products in this suite,
and it was evaluated **before** the service account, so it silently overrode one that
was correctly configured.

That path is gone. If you still set the variable, it is ignored: the server boots with
no credential and every tool that needs authentication returns an error. Remove it and
configure the service account.

## Tools

64 tools, unchanged. Same names, same inputs.

<!-- N8N_UPGRADE -->
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
