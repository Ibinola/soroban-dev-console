/**
 * FE-065: Source verification status surfaces for contract and artifact detail views.
 */

export type VerificationStatus = "confirmed" | "inferred" | "pending" | "unknown";

export interface SourceVerification {
  status: VerificationStatus;
  sourceUrl?: string;
  buildReproducible?: boolean;
  verifiedAt?: string;
  provenance?: string;
}

export function getVerificationLabel(status: VerificationStatus): string {
  const labels: Record<VerificationStatus, string> = {
    confirmed: "Source Verified",
    inferred: "Likely Verified",
    pending: "Verification Pending",
    unknown: "Unverified",
  };
  return labels[status];
}

export function getVerificationColor(status: VerificationStatus): string {
  const colors: Record<VerificationStatus, string> = {
    confirmed: "text-green-600",
    inferred: "text-yellow-500",
    pending: "text-blue-500",
    unknown: "text-gray-400",
  };
  return colors[status];
}

export function resolveVerificationStatus(
  wasmHash?: string | null,
  sourceUrl?: string | null,
  verifiedAt?: string | null
): VerificationStatus {
  if (!wasmHash) return "unknown";
  if (verifiedAt && sourceUrl) return "confirmed";
  if (sourceUrl) return "inferred";
  return "pending";
}

export function formatVerificationMeta(v: SourceVerification): string {
  if (v.status === "unknown") return "No verification data available.";
  const parts: string[] = [`Status: ${getVerificationLabel(v.status)}`];
  if (v.sourceUrl) parts.push(`Source: ${v.sourceUrl}`);
  if (v.verifiedAt) parts.push(`Verified: ${new Date(v.verifiedAt).toLocaleDateString()}`);
  if (v.buildReproducible !== undefined)
    parts.push(`Reproducible build: ${v.buildReproducible ? "Yes" : "No"}`);
  return parts.join(" · ");
}
