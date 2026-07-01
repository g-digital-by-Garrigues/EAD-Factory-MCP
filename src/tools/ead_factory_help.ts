// Help meta-tool (Story 6.7, FR-29, suite `<product>_help` pattern). Returns managers,
// common workflows, and tool-selection guidance for an agent unfamiliar with EAD Factory.
// Pure static content — no upstream call, no credentials needed (requiresAuth: false).
// Custom-only tool (no backing OpenAPI op); registered via product.config customOnlyTools
// (STR-E13-05). Content mirrors agent-assistance/help.ts (the source of truth, kept in sync
// manually) — inlined here because `agent-assistance/` is a generation-time-only directory,
// never copied into the emitted dist-repo, so this file can't import from it at runtime
// (same constraint documented in Story 6.4 for enum-glosses.ts).
// Discrepancy note: GoCertius/EAD Enterprise each have an agent-assistance/help.ts content
// module (STR-E5-06) but never wired it into an actual registered tool — this is the first
// suite MCP where the `<product>_help` pattern is actually implemented, not just planned.
// Not backported to GoCertius/EAD Enterprise (out of this epic's scope).
// Paths are relative to the emitted location: dist-repos/ead-factory/src/tools/

import { z } from "zod";
import { defineTool } from "../core/index.js";

const helpContent = {
  overview: `EAD Factory is a RPaaS "Digital Trust" platform for qualified evidence, digital
signatures, and certified notifications. Four managers, namespaced by tool-name prefix
(P-A2): evidence_*, signature_* (plus 9 legacy top-level names kept for continuity —
generate_evidence, get_evidence, create_signature_request, add_document_to_signature_request,
add_signatory_to_document, add_validator_to_signatory, add_observer_to_document,
activate_signature_request, get_signature_request), notification_*, and chat_* (curation
deferred, OQ-F).

Evidence and Signature each follow the same shape: create a container (case file / signature
request), add content to it, then seal/activate it. Notification follows a similar shape:
create a request (draft), add receivers and documents to it, then send it. Prefer the
composite tools (evidence_create_sealed, signature_request_full) for the common case of doing
all of that in one call for Evidence/Signature; Notification has no composite tool yet — use
the atomic tools in sequence. Use the atomic tools when you need to inspect or react to each
step, or need validators/observers before activating a signature request.`,

  capabilities: [
    {
      group: "Evidence (qualified, timestamped documents)",
      keyTools: [
        "evidence_case_file_create",
        "evidence_group_create",
        "evidence_group_evidence_register",
        "generate_evidence",
        "evidence_group_close",
        "evidence_create_sealed",
      ],
      startingPoint: "evidence_case_file_create",
      description:
        "Create a case file, group evidence inside it, register + upload files, then seal the " +
        "group to trigger qualified timestamping. evidence_create_sealed does the whole flow " +
        "(minus case file creation) in one call.",
    },
    {
      group: "Signature (qualified electronic signatures)",
      keyTools: [
        "create_signature_request",
        "add_document_to_signature_request",
        "add_signatory_to_document",
        "activate_signature_request",
        "signature_request_full",
      ],
      startingPoint: "create_signature_request",
      description:
        "Create a signature request, add documents and their signatories, then activate to " +
        "send signing notifications. signature_request_full does the whole flow in one call " +
        "(activate: false to stop before activation and add validators/observers first).",
    },
    {
      group: "Notification (certified notification delivery)",
      keyTools: [
        "notification_request_create",
        "notification_receiver_add",
        "notification_document_add",
        "notification_request_send",
        "notification_request_status",
        "notification_certificate_generate",
      ],
      startingPoint: "notification_request_create",
      description:
        "Create a notification request, add receivers and (optionally) document attachments to " +
        "it, then send it — delivery runs as an MCP Task since it can fan out to many receivers " +
        "across channels (email/SMS/Noticeman/WhatsApp/RCS). Check notification_request_status " +
        "for progress, then notification_certificate_generate for a delivery certificate once " +
        "notifications have left their in-flight state.",
    },
    {
      group: "Chat (deferred — OQ-F)",
      keyTools: [],
      startingPoint: "",
      description:
        "Certified chat is vendored in the multi-spec surface but curation is explicitly " +
        "deferred to a later increment.",
    },
  ],
};

export const ead_factory_help = defineTool({
  name: "ead_factory_help",
  description:
    "Returns an overview of EAD Factory's managers (Evidence, Signature, Notification, Chat), " +
    "their key tools and starting points, and guidance on when to use a composite workflow tool " +
    "(e.g. evidence_create_sealed) versus the atomic tools. Call this first if you're unsure " +
    "which tool to use — no credentials needed.",
  inputSchema: z.object({}),
  annotations: {
    title: "EAD Factory Help",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  requiresAuth: false,
  pollable: false,
  idempotencyWindowSeconds: 3600,
  async execute() {
    return helpContent;
  },
});
