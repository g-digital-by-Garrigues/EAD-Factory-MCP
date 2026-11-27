// Diagnostic meta-tool (Story 21-08, Codex usability item 2). Answers "is this server set up
// correctly?" without creating anything: it requests a fresh OAuth2 service-account token, makes
// one read-only GET per curated manager against the same base URL every other tool of that manager
// resolves, and reports tool coverage. Custom-only tool (no backing OpenAPI op), registered via
// product.config customOnlyTools and excluded from the n8n node — MCP-only, like ead_factory_help.
//
// Why `operatesOnServerSession: true` (Hugo, 2026-09-15): without it the server fetches the token
// BEFORE execute() runs and, when that fails, answers with its generic error ("Check MCP_AUTH_*
// credentials") — this tool would never get to diagnose the one failure it exists for. With it,
// the server injects no token and hands the tool ctx.reauthenticate(), which makes the shared
// AuthSession re-exchange the credential (a cached token would hide a revoked secret) and throws
// on failure; a failed exchange never discards a valid cached token. Over HTTP with a caller's own
// Bearer token there is no server credential to exchange: the tool reports `caller_bearer` and
// probes with that token. Accepted cost: the server does not register this tool when
// MCP_HTTP_PUBLIC=true (no server session exists to check in that mode), so it lists 64 tools
// there instead of 65.
//
// Why the token exchange has its own time limit: AuthSession's fetch to the token endpoint has
// none, so an endpoint that accepts the connection and never answers would hold this call open for
// minutes. The tool stops waiting after TOKEN_TIMEOUT_MS and reports it; the exchange itself keeps
// running inside AuthSession, exactly as it would for any other tool.
//
// Why nothing here echoes an error message, a response body or a header: every string in the
// result is a fixed string from this file, a manager name, a number, an error code matching
// CODE_PATTERN, or a base URL reduced to origin + path. The mcp-core logger's redaction is
// deliberately NOT reused: it is module-private, it matches field NAMES (not a secret inside a
// message) and its pattern does not cover "Authorization"; exporting it would change src/core in
// every product (Hugo, 2026-09-15).
//
// Why managers are not probed without a token: EAD Factory's gateway answers 404 "no Route
// matched" to unauthenticated requests on /digital-trust and /signature-manager, which reads like
// an outage and is not one (Hugo, 2026-09-10).
//
// Why the Evidence probe overrides the query serializer: that operation's only query field is an
// object (`filter`), which the default serializer sends as `filter[size]=1`, and EAD Factory's API
// ignores bracketed parameters. The probe sends `?size=1` instead.
// Paths are relative to the emitted location: dist-repos/ead-factory/src/tools/

import { z } from "zod";
import { createClient, createConfig } from "../api/client/index.js";
import {
  evidenceSearchCaseFiles,
  notificationSearch,
  signatureGetSignatureRequests,
} from "../api/sdk.gen.js";
import { defineTool } from "../core/index.js";

const TOKEN_TIMEOUT_MS = 10_000;
const PROBE_TIMEOUT_MS = 8000;
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,40}$/;

// Static on purpose: a custom tool cannot see the server's tool list. A unit test fails the build
// when these numbers drift from product.config.ts
// (packages/generator/src/__tests__/ead-factory-agent-experience.test.ts).
const COVERAGE = { evidence: 41, signature: 13, notification: 9, chat: 0, meta: 2, total: 65 };

const CHAT_REASON = "No Chat tools are curated in this server yet — do not attempt Chat flows.";

const TOKEN_REMEDIATION = {
  not_configured:
    "No upstream credentials are configured. Set MCP_SVC_TOKEN_URL, MCP_SVC_CLIENT_ID and MCP_SVC_CLIENT_SECRET, then restart the server.",
  token_endpoint_unreachable:
    "The token endpoint could not be reached. Check MCP_SVC_TOKEN_URL (scheme, host, port) and network access to it.",
  token_endpoint_timeout:
    "The token endpoint did not answer within 10 seconds. Check MCP_SVC_TOKEN_URL and network access to it.",
  token_rejected:
    "The token endpoint refused the credentials (HTTP 400, 401 or 403). Check MCP_SVC_CLIENT_ID, MCP_SVC_CLIENT_SECRET and, if set, MCP_SVC_SCOPE.",
  token_endpoint_error:
    "The token endpoint answered with an error status that is not a credential rejection (see httpStatus). Check that MCP_SVC_TOKEN_URL is the OAuth2 token endpoint; for 429 or 5xx, retry later.",
  token_response_invalid:
    "The token endpoint answered, but not with an OAuth2 token response. Check that MCP_SVC_TOKEN_URL is the token endpoint itself, not a login page or the identity provider's base URL.",
  token_request_failed:
    "The token request failed for an unrecognised reason. Check MCP_SVC_TOKEN_URL, MCP_SVC_CLIENT_ID and MCP_SVC_CLIENT_SECRET.",
} as const;

// Sentinel for the tool's own wait limit on the token exchange (see header).
const TOKEN_TIMEOUT = Symbol("token exchange timed out");

type Manager = "evidence" | "signature" | "notification";
type TokenCategory = Exclude<keyof typeof TOKEN_REMEDIATION, "not_configured">;
type ProbeCategory = "no_token" | "http_error" | "unexpected_response" | "timeout" | "unreachable";

interface TokenReport {
  status: "ok" | "failed" | "not_configured" | "caller_bearer";
  latencyMs?: number;
  category?: TokenCategory;
  httpStatus?: number;
  code?: string;
  remediation?: string;
}

interface ManagerReport {
  manager: Manager;
  available: true;
  baseUrl: string;
  ok: boolean;
  skipped?: true;
  httpStatus?: number;
  latencyMs?: number;
  category?: ProbeCategory;
  code?: string;
  remediation?: string;
}

function probeRemediation(manager: Manager, category: ProbeCategory, httpStatus?: number): string {
  const envVar = `MCP_API_BASE_URL_${manager.toUpperCase()}`;
  switch (category) {
    case "no_token":
      return "Not probed: no token was obtained (see token). The gateway answers unauthenticated requests with 404, which would be misleading.";
    case "timeout":
      return `No answer within ${PROBE_TIMEOUT_MS / 1000} seconds. Check network access to this base URL.`;
    case "unreachable":
      return `The base URL could not be reached. Check MCP_API_BASE_URL (the gateway root) or ${envVar}, and network access.`;
    case "unexpected_response":
      return `This base URL answered 2xx, but not with the API's JSON — it likely points at something other than the EAD Factory API gateway. Check MCP_API_BASE_URL (the gateway root) or ${envVar}.`;
    case "http_error":
      if (httpStatus === 401 || httpStatus === 403) {
        return "This manager did not accept the token. Check that the credentials are enabled for this manager in this environment.";
      }
      if (httpStatus === 404) {
        return `The gateway did not route this path. Check MCP_API_BASE_URL (the gateway root) or ${envVar}.`;
      }
      return "This manager answered with an error status. Retry; if it persists, report the status to the platform team.";
  }
}

/** Origin + path only: userinfo, query and fragment never reach the result. */
function displayUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "(not a valid URL)";
  }
}

/** An error code such as ECONNREFUSED, read from the error or its cause — never its message. */
function errorCode(err: unknown): string | undefined {
  for (const candidate of [
    (err as { code?: unknown } | null)?.code,
    (err as { cause?: { code?: unknown } } | null)?.cause?.code,
  ]) {
    if (typeof candidate === "string" && CODE_PATTERN.test(candidate)) return candidate;
  }
  return undefined;
}

function isTimeout(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

// One site per manager, in the same shape every other EAD Factory tool uses (enforced by
// custom-tools-base-url.test.ts): MCP_API_BASE_URL_<MANAGER> wins; otherwise MCP_API_BASE_URL is
// the gateway ROOT and the manager prefix is appended.
function managerBaseUrls(): Record<Manager, string> {
  return {
    evidence:
      process.env.MCP_API_BASE_URL_EVIDENCE ??
      (process.env.MCP_API_BASE_URL
        ? `${process.env.MCP_API_BASE_URL.replace(/\/+$/, "")}/digital-trust`
        : "https://api.gcloudfactory.com/digital-trust"),
    signature:
      process.env.MCP_API_BASE_URL_SIGNATURE ??
      (process.env.MCP_API_BASE_URL
        ? `${process.env.MCP_API_BASE_URL.replace(/\/+$/, "")}/signature-manager`
        : "https://api.gcloudfactory.com/signature-manager"),
    notification:
      process.env.MCP_API_BASE_URL_NOTIFICATION ??
      (process.env.MCP_API_BASE_URL
        ? `${process.env.MCP_API_BASE_URL.replace(/\/+$/, "")}/notifications`
        : "https://api.gcloudfactory.com/notifications"),
  };
}

async function checkToken(ctx: {
  auth: { token: string } | null;
  reauthenticate?: () => Promise<{ token: string }>;
}): Promise<{ report: TokenReport; token?: string }> {
  // HTTP mode with a per-request Bearer: the token is the caller's; there is no server credential
  // to exchange, so it is used as-is for the probes.
  if (ctx.auth?.token) return { report: { status: "caller_bearer" }, token: ctx.auth.token };
  if (!ctx.reauthenticate) {
    return {
      report: { status: "not_configured", remediation: TOKEN_REMEDIATION.not_configured },
    };
  }
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(TOKEN_TIMEOUT), TOKEN_TIMEOUT_MS);
    });
    const { token } = await Promise.race([ctx.reauthenticate(), timeout]);
    return { report: { status: "ok", latencyMs: Date.now() - started }, token };
  } catch (err) {
    // The message is read only to pick a category; it is never copied into the result. The
    // patterns follow what mcp-core's ServiceAccountAdapter and AuthSession throw today
    // ("Service account token request failed: HTTP 401", "…missing access_token field", a JSON
    // parse error on a non-JSON 200, "fetch failed" on a network error).
    const message = err instanceof Error ? err.message : "";
    const http = /HTTP (\d{3})/.exec(message);
    let category: TokenCategory;
    let httpStatus: number | undefined;
    if (err === TOKEN_TIMEOUT) {
      category = "token_endpoint_timeout";
    } else if (http) {
      httpStatus = Number(http[1]);
      category = [400, 401, 403].includes(httpStatus) ? "token_rejected" : "token_endpoint_error";
    } else if (/access_token|JSON/i.test(message)) {
      category = "token_response_invalid";
    } else if (
      /fetch failed|Invalid URL|ECONN|ENOTFOUND|EAI_AGAIN|certificate|socket/i.test(message)
    ) {
      category = "token_endpoint_unreachable";
    } else {
      category = "token_request_failed";
    }
    const code = errorCode(err);
    return {
      report: {
        status: "failed",
        latencyMs: Date.now() - started,
        category,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
        ...(code ? { code } : {}),
        remediation: TOKEN_REMEDIATION[category],
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

type SdkClient = ReturnType<typeof createClient>;
type SdkEnvelope =
  | {
      error?: unknown;
      response?: { status?: number; headers?: { get(name: string): string | null } };
    }
  | undefined;

async function probe(
  manager: Manager,
  baseUrl: string,
  token: string,
  call: (client: SdkClient, signal: AbortSignal) => Promise<SdkEnvelope>,
): Promise<ManagerReport> {
  const base = { manager, available: true as const, baseUrl: displayUrl(baseUrl) };
  const failed = (category: ProbeCategory, extra: Partial<ManagerReport> = {}): ManagerReport => ({
    ...base,
    ok: false,
    ...extra,
    category,
    remediation: probeRemediation(manager, category, extra.httpStatus),
  });
  const started = Date.now();
  try {
    const client = createClient(
      createConfig({
        baseUrl,
        headers: { Authorization: `Bearer ${token}` },
        ...(manager === "evidence"
          ? { querySerializer: { object: { style: "form", explode: true } } }
          : {}),
      }),
    );
    const envelope = await call(client, AbortSignal.timeout(PROBE_TIMEOUT_MS));
    const latencyMs = Date.now() - started;
    const httpStatus = envelope?.response?.status;
    if (httpStatus !== undefined) {
      if (httpStatus < 200 || httpStatus >= 300)
        return failed("http_error", { httpStatus, latencyMs });
      // A 2xx only proves the route when it is the API answering: a portal page or a proxy
      // splash screen also answers 200. The SDK sets `error` when a JSON body does not parse.
      const contentType = envelope?.response?.headers?.get("content-type") ?? "";
      if (envelope?.error !== undefined || !/json/i.test(contentType)) {
        return failed("unexpected_response", { httpStatus, latencyMs });
      }
      return { ...base, ok: true, httpStatus, latencyMs };
    }
    // No HTTP response at all: the Hey API client returns { error } on a network failure.
    const code = errorCode(envelope?.error);
    return isTimeout(envelope?.error)
      ? failed("timeout", { latencyMs })
      : failed("unreachable", { latencyMs, ...(code ? { code } : {}) });
  } catch (err) {
    const latencyMs = Date.now() - started;
    const code = errorCode(err);
    return isTimeout(err)
      ? failed("timeout", { latencyMs })
      : failed("unreachable", { latencyMs, ...(code ? { code } : {}) });
  }
}

const tokenSchema = z.object({
  status: z.enum(["ok", "failed", "not_configured", "caller_bearer"]),
  latencyMs: z.number().optional(),
  category: z
    .enum([
      "token_endpoint_unreachable",
      "token_endpoint_timeout",
      "token_rejected",
      "token_endpoint_error",
      "token_response_invalid",
      "token_request_failed",
    ])
    .optional(),
  httpStatus: z.number().optional(),
  code: z.string().optional(),
  remediation: z.string().optional(),
});

const managerSchema = z.object({
  manager: z.enum(["evidence", "signature", "notification", "chat"]),
  available: z.boolean(),
  reason: z.string().optional(),
  baseUrl: z.string().optional(),
  ok: z.boolean().optional(),
  skipped: z.boolean().optional(),
  httpStatus: z.number().optional(),
  latencyMs: z.number().optional(),
  category: z
    .enum(["no_token", "http_error", "unexpected_response", "timeout", "unreachable"])
    .optional(),
  code: z.string().optional(),
  remediation: z.string().optional(),
});

const outputSchema = z.object({
  ok: z
    .boolean()
    .describe("True when a token was obtained and every curated manager answered 2xx with JSON."),
  checkedAt: z.string().describe("When the checks ran (ISO 8601)."),
  token: tokenSchema,
  managers: z.array(managerSchema),
  coverage: z.object({
    evidence: z.number(),
    signature: z.number(),
    notification: z.number(),
    chat: z.number(),
    meta: z.number(),
    total: z.number(),
  }),
});

export const ead_factory_health = defineTool({
  name: "ead_factory_health",
  description:
    "Checks this server's EAD Factory setup without creating anything: requests a fresh OAuth2 " +
    "service-account token (over HTTP with a caller's own Bearer token, uses that token instead), " +
    "makes one read-only GET per curated manager (Evidence, Signature, " +
    "Notification) against its resolved base URL, and reports each manager's HTTP status and " +
    "latency plus the number of tools per manager. Chat is reported as unavailable. Always " +
    "returns a structured report, even when a check fails, and never echoes credentials. Use it " +
    "right after configuring MCP_SVC_* credentials, or when other tools fail with 401 or 404.",
  inputSchema: z.object({}),
  outputSchema,
  annotations: {
    title: "EAD Factory Health",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  // See the header: the token exchange is this tool's subject, not a precondition.
  operatesOnServerSession: true,
  pollable: false,
  // A health check must never be answered from the idempotency cache.
  idempotencyWindowSeconds: 0,
  async execute(_input, ctx) {
    const checkedAt = new Date().toISOString();
    const { report: token, token: bearer } = await checkToken(ctx);
    const urls = managerBaseUrls();

    const managers: ManagerReport[] = bearer
      ? await Promise.all([
          probe("evidence", urls.evidence, bearer, (client, signal) =>
            evidenceSearchCaseFiles({ client, query: { filter: { size: 1 } }, signal }),
          ),
          probe("signature", urls.signature, bearer, (client, signal) =>
            signatureGetSignatureRequests({ client, query: { size: 1 }, signal }),
          ),
          probe("notification", urls.notification, bearer, (client, signal) =>
            notificationSearch({ client, query: { size: 1 }, signal }),
          ),
        ])
      : (["evidence", "signature", "notification"] as const).map((manager) => ({
          manager,
          available: true as const,
          baseUrl: displayUrl(urls[manager]),
          ok: false,
          skipped: true as const,
          category: "no_token" as const,
          remediation: probeRemediation(manager, "no_token"),
        }));

    const tokenOk = token.status === "ok" || token.status === "caller_bearer";
    return {
      ok: tokenOk && managers.every((m) => m.ok),
      checkedAt,
      token,
      managers: [...managers, { manager: "chat" as const, available: false, reason: CHAT_REASON }],
      coverage: COVERAGE,
    };
  },
});
