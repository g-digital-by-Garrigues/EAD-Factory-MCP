// Composite workflow tool (P-A4, ADR-A9, Story 6.3): orchestrates the flagship
// "create signature request -> add N documents -> add signatories per document -> activate"
// flow in one call. Composes the SAME generated SDK functions the atomic tools
// (create_signature_request, add_document_to_signature_request, add_signatory_to_document,
// activate_signature_request) use — no separate business logic path. Custom-only tool (no
// single backing OpenAPI op); registered via product.config customOnlyTools (STR-E13-05).
// Batch-capable (AC2): documents[] (each with its own signatories[]) are added sequentially
// in ONE tool call — the API has no bulk-add endpoint, so this is the fewest calls possible.
// Paths are relative to the emitted location: dist-repos/ead-factory/src/tools/

import { z } from "zod";
import { createClient, createConfig } from "../api/client/index.js";
import {
  signatureActivate,
  signatureAddDocument,
  signatureAddSignatory,
  signatureCreateSignatureRequest,
} from "../api/sdk.gen.js";
import { zSignatureSigningObjectConfigurationSigningTypes } from "../api/zod.gen.js";
import { defineTool, FileInput } from "../core/index.js";

// Matches zSignatureAddSignatoryCoordinatesRequestModel exactly (dist-repos/ead-factory/
// src/api/zod.gen.ts): x/y/page are all REQUIRED within each coordinate entry, but the
// coordinates array itself is optional on the signatory (Story 10.3 — previously this
// tool had no way to set placement at all, forcing a separate signature_coordinate_set
// call after every add for any PDF requiring explicit placement).
const coordinateInput = z.object({
  x: z.number().describe("Horizontal position on the page, in points from the left edge."),
  y: z.number().describe("Vertical position on the page, in points from the bottom edge."),
  page: z.number().int().describe("1-indexed page number the signature appears on."),
});

const signatoryInput = z.object({
  name: z.string().min(1),
  surnames: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  coordinates: z
    .array(coordinateInput)
    .optional()
    .describe(
      "On-page signature placement(s). Omit to let EAD Factory auto-position the signature; " +
        "provide when the document requires explicit placement (matches signature_coordinate_set's " +
        "shape — setting this here avoids a separate follow-up call).",
    ),
  sequence: z
    .number()
    .int()
    .optional()
    .describe(
      "Signing order among this document's signatories, if sequential signing is required.",
    ),
  uniqueValidator: z.boolean().optional(),
});

const documentInput = z.object({
  file: FileInput,
  filename: z.string().min(1).describe("File name including extension, e.g. 'contract.pdf'."),
  title: z.string().min(1).describe("Human-readable document title."),
  signatureType: zSignatureSigningObjectConfigurationSigningTypes.describe(
    "INTERPOSITION (EAD Factory mediates, e.g. WhatsApp OTP), ADVANCED, or OTHER.",
  ),
  signatories: z.array(signatoryInput).min(1).describe("Signatories for THIS document."),
});

const inputSchema = z.object({
  name: z.string().min(1).describe("MANDATORY. Signature request name."),
  description: z.string().optional(),
  createdBy: z.string().min(1).describe("MANDATORY. Identifier of the requester."),
  documents: z
    .array(documentInput)
    .min(1)
    .describe("One or more documents, each with its own signatories, added to the request."),
  activate: z
    .boolean()
    .default(true)
    .describe("Activate the request immediately after adding all documents/signatories."),
});

export const signature_request_full = defineTool({
  name: "signature_request_full",
  kind: "workflow",
  description:
    "Creates a signature request, adds one or more documents (each with its own signatories), " +
    "and activates it — the full flagship signature flow in one call instead of " +
    "create_signature_request + N x (add_document_to_signature_request + " +
    "add_signatory_to_document) + activate_signature_request. " +
    "Each document's file uses the shared FileInput contract (local path, base64, https URL, or " +
    "n8n binary item) — never a bespoke file field. Set `activate: false` to leave the request in " +
    "draft so you can add validators/observers (add_validator_to_signatory, " +
    "add_observer_to_document) before activating it yourself. " +
    "On success returns the request id, each document's id, and each signatory's id. " +
    "Use the atomic tools instead when you need to inspect or react to each intermediate step, " +
    "or need validators/observers before activation.",
  inputSchema,
  pollable: false,
  idempotencyWindowSeconds: 60,
  async execute(input, ctx) {
    const { name, description, createdBy, documents, activate } = input as {
      name: string;
      description?: string;
      createdBy: string;
      documents: z.infer<typeof documentInput>[];
      activate: boolean;
    };

    const token = ctx.auth?.token ?? "";
    const sdkClient = createClient(
      createConfig({
        baseUrl:
          process.env.MCP_API_BASE_URL_SIGNATURE ??
          process.env.MCP_API_BASE_URL ??
          "https://api.gcloudfactory.com/signature-manager",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(ctx.correlationId ? { "X-Correlation-Id": ctx.correlationId } : {}),
        },
      }),
    );

    const createResponse = await signatureCreateSignatureRequest({
      client: sdkClient,
      // biome-ignore lint/suspicious/noExplicitAny: generated SDK body type — shape validated by zod at generation time
      body: { name, createdBy, ...(description ? { description } : {}) } as any,
    });
    if (createResponse.error !== undefined) {
      throw new Error(
        `signature_request_full: create request failed — ${JSON.stringify(createResponse.error)}`,
      );
    }
    const created = createResponse.data as { id?: string } | undefined;
    if (!created?.id) {
      throw new Error("signature_request_full: create request did not return an id");
    }
    const signatureRequestId = created.id;

    const documentResults: {
      documentId: string;
      filename: string;
      signatories: { signatoryId: string; email: string }[];
    }[] = [];

    for (const doc of documents) {
      const resolved = await ctx.files.resolve(doc.file);
      const addDocResponse = await signatureAddDocument({
        client: sdkClient,
        path: { signatureRequestId },
        body: {
          filename: doc.filename,
          title: doc.title,
          hash: resolved.sha256,
          signatureType: doc.signatureType,
          fileSize: resolved.size,
          // biome-ignore lint/suspicious/noExplicitAny: generated SDK body type — shape validated by zod at generation time
        } as any,
      });
      if (addDocResponse.error !== undefined) {
        throw new Error(
          `signature_request_full: add document '${doc.filename}' failed — ${JSON.stringify(addDocResponse.error)}`,
        );
      }
      const addedDoc = addDocResponse.data as { id?: string; url?: string } | undefined;
      if (!addedDoc?.id || !addedDoc.url) {
        throw new Error(
          `signature_request_full: add document '${doc.filename}' did not return an id/upload url`,
        );
      }
      const documentId = addedDoc.id;

      const uploadResponse = await fetch(addedDoc.url, {
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
          `signature_request_full: upload failed for '${doc.filename}' (HTTP ${uploadResponse.status})`,
        );
      }

      const signatoryResults: { signatoryId: string; email: string }[] = [];
      for (const signatory of doc.signatories) {
        const addSignatoryResponse = await signatureAddSignatory({
          client: sdkClient,
          path: { signatureRequestId, documentId },
          body: {
            name: signatory.name,
            email: signatory.email,
            ...(signatory.surnames ? { surnames: signatory.surnames } : {}),
            ...(signatory.phone ? { phone: signatory.phone } : {}),
            ...(signatory.coordinates ? { coordinates: signatory.coordinates } : {}),
            ...(signatory.sequence !== undefined ? { sequence: signatory.sequence } : {}),
            ...(signatory.uniqueValidator !== undefined
              ? { uniqueValidator: signatory.uniqueValidator }
              : {}),
            // biome-ignore lint/suspicious/noExplicitAny: generated SDK body type — shape validated by zod at generation time
          } as any,
        });
        if (addSignatoryResponse.error !== undefined) {
          throw new Error(
            `signature_request_full: add signatory '${signatory.email}' to '${doc.filename}' failed — ${JSON.stringify(addSignatoryResponse.error)}`,
          );
        }
        const addedSignatory = addSignatoryResponse.data as { id?: string } | undefined;
        if (!addedSignatory?.id) {
          throw new Error(
            `signature_request_full: add signatory '${signatory.email}' did not return an id`,
          );
        }
        signatoryResults.push({ signatoryId: addedSignatory.id, email: signatory.email });
      }

      documentResults.push({ documentId, filename: doc.filename, signatories: signatoryResults });
    }

    if (activate) {
      const activateResponse = await signatureActivate({
        client: sdkClient,
        path: { signatureRequestId },
      });
      if (activateResponse.error !== undefined) {
        // Story 10.3: include the already-created resource ids — documents/signatories
        // (and the signature request itself) were successfully created before this
        // failure; without these ids the caller has to re-discover them via
        // signature_request_list to resume or clean up.
        throw new Error(
          `signature_request_full: activate failed for signatureRequestId '${signatureRequestId}' ` +
            `(documents already created: ${JSON.stringify(documentResults)}) — ${JSON.stringify(activateResponse.error)}`,
        );
      }
    }

    // Story 6.6 (FR-30/§5.4): tells the agent what to call next.
    const nextSteps = activate
      ? [
          {
            suggestedTool: "get_signature_request",
            why: "Check signing progress now that the request has been activated.",
          },
        ]
      : [
          {
            suggestedTool: "activate_signature_request",
            why: "The request is still in draft (activate: false) — add validators/observers if needed, then activate to send signing notifications.",
          },
        ];

    return {
      signatureRequestId,
      activated: activate,
      documents: documentResults,
      nextSteps,
    };
  },
});
