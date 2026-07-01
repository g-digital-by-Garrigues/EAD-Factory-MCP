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
  evidenceRegisterEvidence,
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
    .describe("TSP/DLT provider names required to testify this evidence. Defaults to none."),
});

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
    "Runs as an MCP Task (bounded-polling until the group reaches CLOSED — EAD Factory's upstream " +
    "emits no events for this transition). Requires: case_file_create -> caseFileId. " +
    "Provide `evidenceGroupId` to add to an existing OPEN group instead of creating one. " +
    "Each evidence's file uses the shared FileInput contract (local path, base64, https URL, or " +
    "n8n binary item) — never a bespoke file field. " +
    "On success returns the group id, its final CLOSED status, and each evidence's id + sha256. " +
    "Use the atomic evidence_group_create / evidence_group_evidence_register / evidence_group_close " +
    "tools instead when you need to inspect or react to each intermediate step.",
  inputSchema,
  pollable: true,
  taskSupport: "required",
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

    const token = ctx.auth?.token ?? "";
    const sdkClient = createClient(
      createConfig({
        baseUrl:
          process.env.MCP_API_BASE_URL_EVIDENCE ??
          process.env.MCP_API_BASE_URL ??
          "https://api.gcloudfactory.com/digital-trust",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(ctx.correlationId ? { "X-Correlation-Id": ctx.correlationId } : {}),
        },
      }),
    );

    let evidenceGroupId = existingGroupId;
    if (!evidenceGroupId) {
      const groupResponse = await evidenceCreateEvidenceGroup({
        client: sdkClient,
        path: { caseFileId },
        body: {
          id: randomUUID(),
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
      const created = groupResponse.data as { id?: string } | undefined;
      if (!created?.id) {
        throw new Error("evidence_create_sealed: create group did not return an id");
      }
      evidenceGroupId = created.id;
    }

    const registered: { evidenceId: string; sha256: string; title: string }[] = [];
    for (const item of evidences) {
      const resolved = await ctx.files.resolve(item.file);
      const evidenceId = randomUUID();
      const registerResponse = await evidenceRegisterEvidence({
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
          testimony: {},
          requiredTestimonyProviders: item.requiredTestimonyProviders ?? [],
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
    const { caseFileId, evidenceGroupId } = kickoffResult as {
      caseFileId: string;
      evidenceGroupId: string;
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
              process.env.MCP_API_BASE_URL ??
              "https://api.gcloudfactory.com/digital-trust",
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
              nextSteps: [
                {
                  suggestedTool: "evidence_case_file_report_generate",
                  why: "Generate a signed report now that the evidence group is CLOSED.",
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
