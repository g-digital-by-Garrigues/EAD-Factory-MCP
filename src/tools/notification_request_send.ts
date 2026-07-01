// Custom override of the auto-generated `notification_request_send` (Story 7.1, AC2, FR-24/
// FR-25): the plain auto-generated wrapper (see emit-tools.ts's per-name override mechanism —
// same one GoCertius's own products/gocertius/custom-tools/notification_request_send.ts uses,
// a DIFFERENT caseFileId-scoped operation) only calls the upstream trigger and returns its
// immediate 202 response. Activating a request can fan out to N receivers across N channels
// (bulk/fan-out send, AC2) with no SSE endpoint anywhere in EAD Factory's 3 curated specs
// (re-confirmed here, same conclusion as Story 5.3) — so this override adds
// `pollForCompletion` (Story 5.2's bounded-polling degraded mode), copying the shape already
// shipped in evidence_create_sealed.ts (Story 6.3).
//
// `taskSupport: "required"` (not "optional"): unlike a bounded, single-resource operation,
// activation fan-out duration scales with receiver count and is not verified against a live
// upstream this session (no test credentials — same caveat Story 6.3 documented for its
// composite tools) — Story 5.1's own guidance is to use "optional" ONLY for verified
// bounded-duration ops, so "required" is the conservative default here.
//
// checkStatus polls `Notifications_search` (`notification_request_status`'s own backing op)
// filtered by requestId — the only status mechanism this API exposes (there is no GET for
// `/notifications/requests/{requestId}` itself). Each returned notification's most recent
// `states[]` entry (last by registeredAt) is its current delivery state
// (`NotificationStateType_1`, verified in notifications-api-1.0.yml); the request is
// "completed" once every notification has left the in-flight states (DRAFT/ACTIVE/DISPATCHED/
// DELIVERING) — including per-recipient failures (DISPATCH_FAILED/ERROR/BOUNCED/etc.), which
// are surfaced in the result rather than failing the whole Task (a bulk send finishing with
// some recipients erroring is a normal outcome, not a process failure).
// Paths are relative to the emitted location: dist-repos/ead-factory/src/tools/

import { z } from "zod";
import { createClient, createConfig } from "../api/client/index.js";
import { notificationActivateNotificationRequest, notificationSearch } from "../api/sdk.gen.js";
import { zNotificationActivateNotificationRequestPath } from "../api/zod.gen.js";
import { applyFieldGlosses, defineTool } from "../core/index.js";

const inputSchema = applyFieldGlosses(
  z.object({ ...zNotificationActivateNotificationRequestPath.shape }),
  {
    requestId:
      "MANDATORY. UUID of the notification request. Obtain from notification_request_create.",
  },
);

// In-flight states (NotificationStateType_1) — the request is still being dispatched/delivered.
const PENDING_STATES = new Set(["DRAFT", "ACTIVE", "DISPATCHED", "DELIVERING"]);

export const notification_request_send = defineTool({
  name: "notification_request_send",
  description:
    "Activates a notification request, triggering delivery to every added receiver across their " +
    "configured channels (email/SMS/Noticeman/WhatsApp/RCS). Runs as an MCP Task (bounded-polling " +
    "until every receiver's notification leaves its in-flight state — EAD Factory's upstream emits " +
    "no events for this transition). Requires: notification_request_create -> requestId, at least " +
    "one receiver added via notification_receiver_add. On completion, returns each notification's " +
    "id and final delivery state (per-receiver failures are reported in the result, not treated as " +
    "a Task failure). Use notification_request_status to check progress without waiting.",
  inputSchema,
  annotations: {
    title: "Notification Request Send",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  pollable: true,
  taskSupport: "required",
  idempotencyWindowSeconds: 86400,
  async execute(input, ctx) {
    const { requestId } = input as { requestId: string };
    const token = ctx.auth?.token ?? "";
    const sdkClient = createClient(
      createConfig({
        baseUrl: process.env.MCP_API_BASE_URL ?? "https://api.gcloudfactory.com",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(ctx.correlationId ? { "X-Correlation-Id": ctx.correlationId } : {}),
        },
      }),
    );

    const response = await notificationActivateNotificationRequest({
      client: sdkClient,
      path: { requestId },
    });
    if (response.error !== undefined) {
      throw new Error(
        `notification_request_send: activation failed — ${JSON.stringify(response.error)}`,
      );
    }

    return { requestId };
  },
  pollForCompletion(_input, ctx, kickoffResult) {
    const { requestId } = kickoffResult as { requestId: string };
    return {
      intervalMs: 5000,
      maxAttempts: 60,
      async checkStatus() {
        const token = ctx.auth?.token ?? "";
        const sdkClient = createClient(
          createConfig({
            baseUrl: process.env.MCP_API_BASE_URL ?? "https://api.gcloudfactory.com",
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        const response = await notificationSearch({
          client: sdkClient,
          query: { requestId },
        });
        if (response.error !== undefined) {
          return { status: "failed", error: JSON.stringify(response.error) };
        }

        const records =
          (response.data as { records?: { id?: string; states?: { state?: string }[] }[] })
            .records ?? [];
        if (records.length === 0) {
          return { status: "pending" };
        }

        const notifications = records.map((record) => ({
          notificationId: record.id,
          state: record.states?.at(-1)?.state,
        }));
        const stillPending = notifications.some((n) => !n.state || PENDING_STATES.has(n.state));
        if (stillPending) {
          return { status: "pending" };
        }

        return {
          status: "completed",
          result: {
            requestId,
            notifications,
            nextSteps: [
              {
                suggestedTool: "notification_certificate_generate",
                why: "Generate a delivery certificate now that every notification has left its in-flight state.",
              },
            ],
          },
        };
      },
    };
  },
});
