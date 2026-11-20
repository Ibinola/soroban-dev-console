/**
 * Issue #1102: client-side reading of dropped/selected XDR files.
 *
 * Reading happens entirely via the browser's FileReader API — the file
 * contents never leave the client / get sent to any backend.
 */

export const ACCEPTED_XDR_FILE_EXTENSIONS = [".xdr", ".base64", ".txt"] as const;

export function isAcceptedXdrFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_XDR_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Read a dropped/selected file as trimmed text via FileReader (client-side only). */
export function readXdrFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      resolve(text.trim());
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
