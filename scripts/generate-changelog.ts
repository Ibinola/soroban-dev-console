import { execSync } from "child_process";

interface ChangelogEntry {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

function getCommits(since: string): ChangelogEntry[] {
  try {
    const out = execSync(
      `git log ${since}..HEAD --pretty=format:"%H|%s|%an|%ad" --date=short`
    ).toString().trim();
    if (!out) return [];
    return out.split("\n").map((line) => {
      const [hash, subject, author, date] = line.split("|");
      return { hash: hash.slice(0, 7), subject, author, date };
    });
  } catch {
    return [];
  }
}

export function generateChangelog(since = "HEAD~20"): string {
  const entries = getCommits(since);
  if (!entries.length) return "No changes since " + since;
  const lines = ["# Changelog", ""];
  for (const e of entries) {
    lines.push(`- ${e.subject} (${e.author}, ${e.date}) [${e.hash}]`);
  }
  return lines.join("\n");
}

console.log(generateChangelog(process.argv[2] ?? "HEAD~20"));
