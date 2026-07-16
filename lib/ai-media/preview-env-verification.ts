export type AiMediaPreviewEnvVerificationInput = {
  strict?: boolean;
  previewDeploymentUrl?: string | null;
  productionDeploymentUrl?: string | null;
  previewDbFingerprint?: string | null;
  productionDbFingerprint?: string | null;
  previewStorageFingerprint?: string | null;
  productionStorageFingerprint?: string | null;
  previewAiMediaServiceIdentity?: string | null;
  productionAiMediaServiceIdentity?: string | null;
  previewUsesServerOnlyRenderKey?: boolean | null;
  productionUsesServerOnlyRenderKey?: boolean | null;
  previewHasPublicRenderSecret?: boolean | null;
  productionHasPublicRenderSecret?: boolean | null;
  previewAiWriteFlowEnabled?: boolean | null;
  productionAiWriteFlowEnabled?: boolean | null;
  notes?: string[] | string | null;
};

export type AiMediaPreviewEnvVerificationEvidenceSummary = {
  strict: boolean;
  present: Record<Exclude<keyof AiMediaPreviewEnvVerificationInput, "strict" | "notes">, boolean>;
  missingEvidence: string[];
  comparisons: {
    deploymentUrlsDiffer: boolean | null;
    databaseFingerprintsDiffer: boolean | null;
    storageFingerprintsDiffer: boolean | null;
    aiMediaServiceIdentitiesDiffer: boolean | null;
  };
  safetyFlags: {
    previewUsesServerOnlyRenderKey: boolean | null;
    productionUsesServerOnlyRenderKey: boolean | null;
    previewHasPublicRenderSecret: boolean | null;
    productionHasPublicRenderSecret: boolean | null;
    previewAiWriteFlowEnabled: boolean | null;
    productionAiWriteFlowEnabled: boolean | null;
  };
  secretLikeEvidenceFields: string[];
  noteCount: number;
};

export type AiMediaPreviewEnvVerificationResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  evidenceSummary: AiMediaPreviewEnvVerificationEvidenceSummary;
};

const REQUIRED_EVIDENCE_FIELDS = [
  "previewDeploymentUrl",
  "productionDeploymentUrl",
  "previewDbFingerprint",
  "productionDbFingerprint",
  "previewStorageFingerprint",
  "productionStorageFingerprint",
  "previewAiMediaServiceIdentity",
  "productionAiMediaServiceIdentity",
  "previewUsesServerOnlyRenderKey",
  "productionUsesServerOnlyRenderKey",
  "previewHasPublicRenderSecret",
  "productionHasPublicRenderSecret",
  "previewAiWriteFlowEnabled",
  "productionAiWriteFlowEnabled",
] as const;

type EvidenceField = typeof REQUIRED_EVIDENCE_FIELDS[number];

const SECRET_LIKE_PATTERNS = [
  /postgres(?:ql)?:\/\/[^/\s:@]+:[^@\s]+@/i,
  /\bDATABASE_URL\s*=/i,
  /\bDIRECT_URL\s*=/i,
  /\bBLOB_READ_WRITE_TOKEN\s*=/i,
  /\bAI_MEDIA_SERVICE_INTERNAL_KEY\s*=/i,
  /\bRENDER[_-]?(?:SECRET|TOKEN|KEY)\s*=/i,
  /\bNEXTAUTH_SECRET\s*=/i,
  /\bSMS_IR_API_KEY\s*=/i,
  /\bVAPID_PRIVATE_KEY\s*=/i,
  /\b(?:secret|password|passwd|token)\b\s*[:=]/i,
  /\bvercel_blob_[A-Za-z0-9_-]{12,}/i,
  /\bsk-[A-Za-z0-9_-]{16,}/i,
];

function hasEvidence(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeComparable(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return trimmed.replace(/\/$/, "").toLowerCase();
  }
}

function compareDistinct(left: unknown, right: unknown): boolean | null {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);
  if (!normalizedLeft || !normalizedRight) return null;
  return normalizedLeft !== normalizedRight;
}

function isSecretLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeNotes(notes: AiMediaPreviewEnvVerificationInput["notes"]): string[] {
  if (Array.isArray(notes)) return notes.filter((note): note is string => typeof note === "string");
  if (typeof notes === "string" && notes.trim().length > 0) return [notes];
  return [];
}

function pushIf(condition: boolean, target: string[], message: string) {
  if (condition) target.push(message);
}

export function verifyAiMediaPreviewEnvironmentEvidence(
  input: AiMediaPreviewEnvVerificationInput,
): AiMediaPreviewEnvVerificationResult {
  const strict = input.strict === true;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const missingEvidence = REQUIRED_EVIDENCE_FIELDS.filter((field) => !hasEvidence(input[field]));
  const notes = normalizeNotes(input.notes);
  const secretLikeEvidenceFields = [
    ...REQUIRED_EVIDENCE_FIELDS.filter((field) => isSecretLike(input[field])),
    ...(notes.some(isSecretLike) ? ["notes" as const] : []),
  ];

  if (missingEvidence.length > 0) {
    const message = `Missing Preview verification evidence: ${missingEvidence.join(", ")}.`;
    if (strict) blockers.push(message);
    else warnings.push(message);
  }

  if (secretLikeEvidenceFields.length > 0) {
    blockers.push(`Raw secret-like evidence was provided in: ${secretLikeEvidenceFields.join(", ")}. Replace it with a safe fingerprint or redacted summary.`);
  }

  const deploymentUrlsDiffer = compareDistinct(input.previewDeploymentUrl, input.productionDeploymentUrl);
  const databaseFingerprintsDiffer = compareDistinct(input.previewDbFingerprint, input.productionDbFingerprint);
  const storageFingerprintsDiffer = compareDistinct(input.previewStorageFingerprint, input.productionStorageFingerprint);
  const aiMediaServiceIdentitiesDiffer = compareDistinct(input.previewAiMediaServiceIdentity, input.productionAiMediaServiceIdentity);

  pushIf(deploymentUrlsDiffer === false, blockers, "Preview and Production deployment URLs must differ.");
  pushIf(databaseFingerprintsDiffer === false, blockers, "Preview and Production database fingerprints must differ.");
  pushIf(storageFingerprintsDiffer === false, blockers, "Preview and Production storage fingerprints must differ.");
  pushIf(aiMediaServiceIdentitiesDiffer === false, blockers, "Preview and Production AI media service identities must differ.");
  pushIf(input.previewUsesServerOnlyRenderKey === false, blockers, "Preview Render credential must remain server-only.");
  pushIf(input.productionUsesServerOnlyRenderKey === false, blockers, "Production Render credential must remain server-only.");
  pushIf(input.previewHasPublicRenderSecret === true, blockers, "Preview must not expose Render secrets through public environment variables.");
  pushIf(input.productionHasPublicRenderSecret === true, blockers, "Production must not expose Render secrets through public environment variables.");
  pushIf(input.previewAiWriteFlowEnabled === true, blockers, "Preview AI write flow must remain disabled until isolation is verified.");
  pushIf(input.productionAiWriteFlowEnabled === true, blockers, "Production AI write flow must remain disabled for this verification phase.");

  const present = REQUIRED_EVIDENCE_FIELDS.reduce((accumulator, field) => {
    accumulator[field] = hasEvidence(input[field]);
    return accumulator;
  }, {} as Record<EvidenceField, boolean>);

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    evidenceSummary: {
      strict,
      present,
      missingEvidence,
      comparisons: {
        deploymentUrlsDiffer,
        databaseFingerprintsDiffer,
        storageFingerprintsDiffer,
        aiMediaServiceIdentitiesDiffer,
      },
      safetyFlags: {
        previewUsesServerOnlyRenderKey: typeof input.previewUsesServerOnlyRenderKey === "boolean" ? input.previewUsesServerOnlyRenderKey : null,
        productionUsesServerOnlyRenderKey: typeof input.productionUsesServerOnlyRenderKey === "boolean" ? input.productionUsesServerOnlyRenderKey : null,
        previewHasPublicRenderSecret: typeof input.previewHasPublicRenderSecret === "boolean" ? input.previewHasPublicRenderSecret : null,
        productionHasPublicRenderSecret: typeof input.productionHasPublicRenderSecret === "boolean" ? input.productionHasPublicRenderSecret : null,
        previewAiWriteFlowEnabled: typeof input.previewAiWriteFlowEnabled === "boolean" ? input.previewAiWriteFlowEnabled : null,
        productionAiWriteFlowEnabled: typeof input.productionAiWriteFlowEnabled === "boolean" ? input.productionAiWriteFlowEnabled : null,
      },
      secretLikeEvidenceFields: Array.from(new Set(secretLikeEvidenceFields)),
      noteCount: notes.length,
    },
  };
}
