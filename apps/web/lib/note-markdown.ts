/**
 * Minimal, dependency-free markdown preview renderer for workspace notes.
 *
 * HTML is escaped up front so raw user input can never inject markup — the
 * only tags in the output are the ones this function emits itself. This keeps
 * the note preview XSS-safe without pulling in a full markdown/sanitizer stack.
 */

const MAX_NOTE_BYTES = 50 * 1024; // 50KB, matches the note size cap

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** True when the note is within the enforced size limit. */
export function isWithinNoteSizeLimit(body: string): boolean {
  return new Blob([body]).size <= MAX_NOTE_BYTES;
}

function renderInline(text: string): string {
  // Order matters: escape first, then apply inline markdown on the safe string.
  let out = escapeHtml(text);

  // `code`
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *italic*
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // [label](https://…) — only http(s) links are allowed
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  return out;
}

/**
 * Render a small subset of markdown (headings, bold, italic, inline code,
 * links, and line breaks) to a safe HTML string.
 */
export function renderMarkdownPreview(markdown: string): string {
  const lines = markdown.split(/\r?\n/);

  return lines
    .map((line) => {
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${renderInline(heading[2])}</h${level}>`;
      }
      if (line.trim() === "") return "";
      return `<p>${renderInline(line)}</p>`;
    })
    .join("\n");
}
