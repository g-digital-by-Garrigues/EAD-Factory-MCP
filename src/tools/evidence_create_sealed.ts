// Composite workflow tool (P-A4, ADR-A9, Story 6.3): orchestrates the flagship
// "create evidence group -> register + upload N evidences -> seal (close) the group"
// flow in one call, instead of the ~4+N atomic calls an agent would otherwise need
// (evidence_group_create, N x evidence_group_evidence_register + PUT, evidence_group_close,
// then poll evidence_group_get until CLOSED). Composes the SAME generated SDK functions the
// atomic tools use — no separate business logic path. Custom-only tool (no single backing
// OpenAPI op); registered via product.config customOnlyTools (STR-E13-05), same mechanism
// GoCertius's evidence_upload uses. Batch-capable (AC2): evidences[] are registered
// sequentially in ONE tool call — the API has no bulk-register endpoint, so this is the
// fewest calls possible; the agent doesn't need N separate tool invocations.
// Paths are relative to the emitted location: dist-repos/ead-factory/src/tools/

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient, createConfig } from "../api/client/index.js";
import {
  evidenceCloseEvidenceGroup,
  evidenceCreateEvidenceGroup,
  evidenceGetEvidenceGroup,
  evidenceRegisterEvidenceInGroup,
} from "../api/sdk.gen.js";
import { zEvidenceCustodyType, zEvidenceGroupType } from "../api/zod.gen.js";
import { defineTool, FileInput } from "../core/index.js";

const evidenceInput = z.object({
  file: FileInput,
  title: z
    .string()
    .max(128)
    .optional()
    .describe("Human-readable title. Defaults to the file name."),
  custodyType: zEvidenceCustodyType
    .default("INTERNAL")
    .describe("INTERNAL = EAD Factory stores the file. EXTERNAL = the file lives elsewhere."),
  capturedAt: z.iso
    .datetime()
    .optional()
    .describe("When the evidence was captured. Defaults to now."),
  requiredTestimonyProviders: z
    .array(z.string())
    .optional()
    .describe(
      "Provider NAMES that must testify this evidence (e.g. EADTrust), not families (not 'TSP'). Defaults to " +
        "the providers named in `testimony`, or EADTrust. TSP: EADTrust. DLT: Hedera, coming soon — until " +
        "the platform enables it, a DLT provider is refused (400 PROVIDER_NOT_CONFIGURED).",
    ),
  testimony: z
    .object({
      TSP: z
        .object({ required: z.boolean().optional(), providers: z.array(z.string()).optional() })
        .optional(),
      DLT: z
        .object({ required: z.boolean().optional(), providers: z.array(z.string()).optional() })
        .optional(),
    })
    .optional()
    .describe(
      "Which proof to request, by family: TSP (qualified timestamp, e.g. EADTrust) and/or DLT (ledger, Hedera; " +
        "coming soon). Every required provider must appear here. Defaults to { TSP: { required: true, providers: " +
        "['EADTrust'] } }, the platform's default provider.",
    ),
});

// E21 21-06 (live on INT, 2026-11-28; read in g-digital-trust-api): the platform resolves the required providers
// (an empty list means its default, EADTrust) and refuses any that is missing from `testimony[...].providers`
// with a misleading "Testimony providers X does not exist" — so an empty `testimony` can never pass. The
// providers in its configuration, by family: TSP = EADTrust, EADTrustCompanySeal; DLT = Hedera. Its public guide
// (digitaltrust.gcloudfactory.com) says only TSP is available today (DLT answers 400 PROVIDER_NOT_CONFIGURED);
// Hedera (DLT) is coming soon (Hugo, 2026-11-28), so it stays placed under DLT.
const DEFAULT_TSP_PROVIDER = "EADTrust";
const KNOWN_PROVIDER_FAMILY: Record<string, "TSP" | "DLT"> = {
  EADTrust: "TSP",
  EADTrustCompanySeal: "TSP",
  Hedera: "DLT",
};
type TestimonyInput = {
  TSP?: { required?: boolean; providers?: string[] };
  DLT?: { required?: boolean; providers?: string[] };
};
/** The testimony fields to register one evidence with; throws a clear error the platform would hide. */
function testimonyFor(item: {
  testimony?: TestimonyInput;
  requiredTestimonyProviders?: string[];
}): { testimony: TestimonyInput; requiredTestimonyProviders: string[] } {
  if (item.testimony && (item.testimony.TSP || item.testimony.DLT)) {
    const families = [item.testimony.TSP, item.testimony.DLT];
    const required =
      item.requiredTestimonyProviders ??
      families.filter((t) => t?.required !== false).flatMap((t) => t?.providers ?? []);
    const listed = new Set(families.flatMap((t) => t?.providers ?? []));
    const effective = required.length > 0 ? required : [DEFAULT_TSP_PROVIDER];
    const missing = effective.filter((p) => !listed.has(p));
    if (missing.length > 0) {
      throw new Error(
        `evidence_create_sealed: required testimony provider(s) ${missing.join(", ")} not listed in ` +
          "`testimony` — the platform refuses every required provider that `testimony` does not name " +
          `(no provider required means ${DEFAULT_TSP_PROVIDER}). Add it to testimony.TSP.providers or ` +
          "testimony.DLT.providers, or drop it from requiredTestimonyProviders.",
      );
    }
    return { testimony: item.testimony, requiredTestimonyProviders: required };
  }
  const providers = item.requiredTestimonyProviders?.length
    ? item.requiredTestimonyProviders
    : [DEFAULT_TSP_PROVIDER];
  const unknown = providers.filter((p) => !(p in KNOWN_PROVIDER_FAMILY));
  if (unknown.length > 0) {
    throw new Error(
      `evidence_create_sealed: cannot tell the family of testimony provider(s) ${unknown.join(", ")} — ` +
        "pass `testimony` saying which ones are TSP (qualified timestamp) and which DLT (ledger).",
    );
  }
  const testimony: TestimonyInput = {};
  for (const family of ["TSP", "DLT"] as const) {
    const named = providers.filter((p) => KNOWN_PROVIDER_FAMILY[p] === family);
    if (named.length > 0) testimony[family] = { required: true, providers: named };
  }
  return { testimony, requiredTestimonyProviders: providers };
}

const inputSchema = z.object({
  caseFileId: z.string().uuid().describe("MANDATORY. UUID of the parent case file."),
  evidenceGroupId: z
    .string()
    .uuid()
    .optional()
    .describe("Existing OPEN evidence group to add to. Omit to create a new one."),
  groupType: zEvidenceGroupType
    .default("FILE")
    .describe("Only used when creating a new group (evidenceGroupId omitted)."),
  groupName: z
    .string()
    .max(255)
    .optional()
    .describe("Only used when creating a new group (evidenceGroupId omitted)."),
  evidences: z
    .array(evidenceInput)
    .min(1)
    .describe("One or more files to register and upload into the group, then seal it."),
});

export const evidence_create_sealed = defineTool({
  name: "evidence_create_sealed",
  kind: "workflow",
  description:
    "Creates (or reuses) an evidence group, registers and uploads one or more files as evidence, " +
    "then seals (closes) the group — the full flagship evidence flow in one call instead of " +
    "evidence_group_create + N x (evidence_group_evidence_register + upload) + evidence_group_close. " +
    "Bounded-polls until the group reaches CLOSED (EAD Factory's upstream emits no events for " +
    "this transition): task-aware MCP clients get an asynchronous Task; any other client simply " +
    "receives the final result synchronously. Requires: evidence_case_file_create -> caseFileId. " +
    "Provide `evidenceGroupId` to add to an existing OPEN group instead of creating one. " +
    "Each evidence's file uses the shared FileInput contract (local path, base64, https URL, or " +
    "n8n binary item) — never a bespoke file field. " +
    "On success returns the group id, its final CLOSED status, and each evidence's id + sha256. " +
    "Use the atomic evidence_group_create / evidence_group_evidence_register / evidence_group_close " +
    "tools instead when you need to inspect or react to each intermediate step. " +
    // Story 21-08 (Codex usability item 5): one minimal payload that passes inputSchema, kept as
    // the LAST sentence so story 20-05 can keep or replace it in one place.
    "Example: evidence_create_sealed({ caseFileId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', " +
    "evidences: [{ file: { source: 'path', path: '/absolute/path/invoice.pdf' } }] }) — use your " +
    "own case file's id; on a remote (HTTP) server send the file as { source: 'base64', filename: " +
    "'invoice.pdf', contentBase64: '<base64 bytes>' } instead.",
  inputSchema,
  pollable: true,
  // Story 1.3 (audit U1): "optional", NOT "required" — Story 5.1's guidance allows
  // "optional" for bounded-duration ops, and this composite bounds its own
  // completion via pollForCompletion (runBoundedPolling: 60 attempts x 5s, the task
  // fails on timeout — the SDK's automatic polling loop for task-unaware clients
  // therefore always terminates). Contrast notification_request_send, which keeps
  // "required": its fan-out duration scales with receiver count and is unbounded.
  taskSupport: "optional",
  idempotencyWindowSeconds: 86400,
  async execute(input, ctx) {
    const {
      caseFileId,
      evidenceGroupId: existingGroupId,
      groupType,
      groupName,
      evidences,
    } = input as {
      caseFileId: string;
      evidenceGroupId?: string;
      groupType: z.infer<typeof zEvidenceGroupType>;
      groupName?: string;
      evidences: z.infer<typeof evidenceInput>[];
    };

    // Check every evidence's testimony before creating anything: a refusal after the group exists
    // would leave an empty open group behind.
    const testimonies = evidences.map((item) => testimonyFor(item));

    const token = ctx.auth?.token ?? "";
    const sdkClient = createClient(
      createConfig({
        baseUrl:
          process.env.MCP_API_BASE_URL_EVIDENCE ??
          // Story 1.2 (audit G1): global var = gateway ROOT, manager prefix appended
          (process.env.MCP_API_BASE_URL
            ? `${process.env.MCP_API_BASE_URL.replace(/\/+$/, "")}/digital-trust`
            : "https://api.gcloudfactory.com/digital-trust"),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(ctx.correlationId ? { "X-Correlation-Id": ctx.correlationId } : {}),
        },
      }),
    );

    let evidenceGroupId = existingGroupId;
    if (!evidenceGroupId) {
      // E21 21-06: `code` is optional in the contract but the platform answers 500 without it (its uniqueness
      // check takes a non-nullable argument); it must be unique in the tenant, so the group's own id is used.
      // The 201 has an empty body, so the id we mint is the group id — never read it back from the response.
      const newGroupId = randomUUID();
      const groupResponse = await evidenceCreateEvidenceGroup({
        client: sdkClient,
        path: { caseFileId },
        body: {
          id: newGroupId,
          code: newGroupId,
          type: groupType,
          ...(groupName ? { name: groupName } : {}),
          // biome-ignore lint/suspicious/noExplicitAny: generated SDK body type — shape validated by zod at generation time
        } as any,
      });
      if (groupResponse.error !== undefined) {
        throw new Error(
          `evidence_create_sealed: create group failed — ${JSON.stringify(groupResponse.error)}`,
        );
      }
      evidenceGroupId = newGroupId;
    }

    const registered: { evidenceId: string; sha256: string; title: string }[] = [];
    for (const [index, item] of evidences.entries()) {
      const resolved = await ctx.files.resolve(item.file);
      const evidenceId = randomUUID();
      const registerResponse = await evidenceRegisterEvidenceInGroup({
        client: sdkClient,
        path: { caseFileId, evidenceGroupId },
        body: {
          evidenceId,
          hash: resolved.sha256,
          title: item.title ?? resolved.filename,
          fileName: resolved.filename,
          fileSize: resolved.size,
          custodyType: item.custodyType,
          capturedAt: item.capturedAt ?? new Date().toISOString(),
          ...testimonies[index],
          // biome-ignore lint/suspicious/noExplicitAny: generated SDK body type — shape validated by zod at generation time
        } as any,
      });
      if (registerResponse.error !== undefined) {
        throw new Error(
          `evidence_create_sealed: register evidence failed — ${JSON.stringify(registerResponse.error)}`,
        );
      }
      const uploadInfo = registerResponse.data as { url?: string } | undefined;
      if (!uploadInfo?.url) {
        throw new Error("evidence_create_sealed: register evidence did not return an upload url");
      }
      const uploadResponse = await fetch(uploadInfo.url, {
        method: "PUT",
        headers: {
          "Content-Type": resolved.contentType,
          "x-amz-checksum-sha256": resolved.sha256Base64,
        },
        body: new Uint8Array(resolved.bytes),
        signal: AbortSignal.timeout(120_000),
      });
      if (!uploadResponse.ok) {
        throw new Error(
          `evidence_create_sealed: upload failed for ${resolved.filename} (HTTP ${uploadResponse.status})`,
        );
      }
      registered.push({
        evidenceId,
        sha256: resolved.sha256,
        title: item.title ?? resolved.filename,
      });
    }

    const closeResponse = await evidenceCloseEvidenceGroup({
      client: sdkClient,
      path: { caseFileId, evidenceGroupId },
      body: { evidencesCount: registered.length },
    });
    if (closeResponse.error !== undefined) {
      throw new Error(
        `evidence_create_sealed: close group failed — ${JSON.stringify(closeResponse.error)}`,
      );
    }

    // Degraded-polling (Story 5.2): EAD Factory has no SSE for this transition — poll
    // evidence_group_get until status leaves CLOSING.
    return {
      evidenceGroupId,
      caseFileId,
      evidences: registered,
    };
  },
  pollForCompletion(_input, ctx, kickoffResult) {
    // Read caseFileId/evidenceGroupId from execute()'s own return value, not the original
    // input — evidenceGroupId is only present in the input when the caller passed an
    // existing group; when execute() created a new one, this is the only place its id is
    // known (Story 6.3 addition to pollForCompletion's signature).
    const {
      caseFileId,
      evidenceGroupId,
      evidences: sealedEvidences,
    } = kickoffResult as {
      caseFileId: string;
      evidenceGroupId: string;
      evidences: { evidenceId: string; sha256: string; title: string }[];
    };
    return {
      intervalMs: 5000,
      maxAttempts: 60,
      async checkStatus() {
        const token = ctx.auth?.token ?? "";
        const sdkClient = createClient(
          createConfig({
            baseUrl:
              process.env.MCP_API_BASE_URL_EVIDENCE ??
              // Story 1.2 (audit G1): global var = gateway ROOT, manager prefix appended
              (process.env.MCP_API_BASE_URL
                ? `${process.env.MCP_API_BASE_URL.replace(/\/+$/, "")}/digital-trust`
                : "https://api.gcloudfactory.com/digital-trust"),
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        const response = await evidenceGetEvidenceGroup({
          client: sdkClient,
          path: { caseFileId, evidenceGroupId },
        });
        if (response.error !== undefined) {
          return { status: "failed", error: JSON.stringify(response.error) };
        }
        const group = response.data as { status?: string } | undefined;
        if (group?.status === "CLOSED") {
          // Story 6.6 (FR-30/§5.4): tells the agent what to call next.
          return {
            status: "completed",
            result: {
              ...group,
              // Story 21-11: mcp-core serves `final.result` and discards execute()'s return
              // value (server.ts, `final.result ?? kickoff`), so the ids and hashes this call
              // generated had to be carried across explicitly. Without them the agent has no
              // way back to what it just sealed: the group read-back returns counts only, and
              // the evidence searches cannot filter by group. `sealedEvidences`, not
              // `evidences`, because the group's own `evidences` field is a counts object.
              caseFileId,
              evidenceGroupId,
              sealedEvidences,
              nextSteps: [
                {
                  suggestedTool: "evidence_case_file_report_generate",
                  why: "The evidence group is CLOSED: pass the `caseFileId` you sent to this call as `caseFileId`, with a fresh UUID v4 as `reportId`, an uppercase `template` and a `languageCode`, to generate its signed report.",
                },
              ],
            },
          };
        }
        if (group?.status === "OPEN") {
          return {
            status: "failed",
            error: "Evidence group reverted to OPEN — seal failed upstream.",
          };
        }
        return { status: "pending" };
      },
    };
  },
});
