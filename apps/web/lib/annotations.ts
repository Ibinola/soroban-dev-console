export const MAX_ANNOTATION_LENGTH = 200;

export type AnnotationValidation = { ok: true; value: string } | { ok: false; error: string };

/** Trims and validates an annotation: non-empty, at most 200 characters. */
export function validateAnnotation(raw: string): AnnotationValidation {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, error: "Note cannot be empty." };
  if (value.length > MAX_ANNOTATION_LENGTH) {
    return { ok: false, error: `Note must be ${MAX_ANNOTATION_LENGTH} characters or fewer.` };
  }
  return { ok: true, value };
}

/** Stable annotation target id for a transaction result. */
export function transactionAnnotationId(hash: string | undefined, fallback: string): string {
  return hash && hash.length > 0 ? hash : fallback;
}
