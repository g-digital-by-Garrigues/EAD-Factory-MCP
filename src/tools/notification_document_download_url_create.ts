// Custom override of the auto-generated `notification_document_download_url_create`
// (Story 21-12). The upstream answers this POST with a **307**, not a 200
// (notifications-api-1.0.yml: `"307": Get a file document download url`). @hey-api's fetch
// client is created with `redirect: "follow"`, and the fetch standard keeps the METHOD on a
// 307 — so the generated tool re-POSTed to the storage URL in the `Location` header, with our
// Authorization header dropped by the cross-origin redirect, and returned whatever object
// storage answered. The download URL the operation exists to produce never reached the agent.
//
// This override does the request itself with `redirect: "manual"`, so the redirect is data:
// the `Location` is returned as `url`. It also handles a direct 2xx body, because the contract
// declares one (`NotificationAttachmentDownloadUrlViewModel`, a Java `HashSet` serialization
// artefact of `{empty: boolean}` — worthless as a shape, so the body is returned as received).
// Which of the two the real gateway sends, and whether the 307 carries a JSON body as well as
// a Location, is on story 21-06's live-run checklist.
//
// The description is kept word-for-word identical to the `descriptions-overrides.ts` entry:
// that one feeds `.distribution.yaml`, this one the MCP client, and they must not tell two
// different stories (the 20-05 divergence).
//
// Paths are relative to the emitted location: dist-repos/ead-factory/src/tools/

import { z } from "zod";
import { zNotificationGetDownloadUrlPath } from "../api/zod.gen.js";
import { applyFieldGlosses, defineTool, UpstreamHttpError } from "../core/index.js";

const inputSchema = applyFieldGlosses(z.object({ ...zNotificationGetDownloadUrlPath.shape }), {
  requestId: "UUID of the notification request. Obtain from notification_request_create.",
  attachmentId: "MANDATORY. UUID of the attachment. Obtain from notification_document_add.",
});

const REQUEST_TIMEOUT_MS = 30_000;

export const notification_document_download_url_create = defineTool({
  name: "notification_document_download_url_create",
  description:
    "Creates a presigned download URL for a document attachment on a notification request. " +
    "Requires: notification_request_create → requestId, notification_document_add → attachmentId.",
  inputSchema,
  annotations: {
    title: "Notification Document Download Url Create",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  pollable: false,
  idempotencyWindowSeconds: 60,
  async execute(input, ctx) {
    const { requestId, attachmentId } = zNotificationGetDownloadUrlPath.parse(input);
    const token = ctx.auth?.token ?? "";
    const baseUrl =
      process.env.MCP_API_BASE_URL_NOTIFICATION ??
      // Story 1.2 (audit G1): global var = gateway ROOT, manager prefix appended
      (process.env.MCP_API_BASE_URL
        ? `${process.env.MCP_API_BASE_URL.replace(/\/+$/, "")}/notifications`
        : "https://api.gcloudfactory.com/notifications");

    const requestUrl = `${baseUrl.replace(/\/+$/, "")}/api/v1/private/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`;
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(ctx.correlationId ? { "X-Correlation-Id": ctx.correlationId } : {}),
      },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const bodyText = await response.text().catch(() => "");
    let body: unknown;
    try {
      body = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      body = bodyText || undefined;
    }

    // The documented success path: a redirect whose Location IS the download URL.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          `notification_document_download_url_create: upstream answered ${response.status} with no Location header`,
        );
      }
      // RFC 9110 allows a relative Location; an absolute one is passed through untouched,
      // because re-serialising a presigned URL could re-encode its query and void the signature.
      const url = /^[a-z][a-z0-9+.-]*:/i.test(location)
        ? location
        : new URL(location, requestUrl).toString();
      return { url, status: response.status, ...(body !== undefined ? { body } : {}) };
    }

    if (!response.ok) {
      throw UpstreamHttpError.fromParsedError(
        response.status,
        body ?? {},
        "notification_document_download_url_create",
      );
    }

    return body ?? {};
  },
});
