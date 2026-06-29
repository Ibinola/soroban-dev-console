/**
 * Issue #506 (DEVOPS-421): Automate the release candidate workflow
 *
 * Problem: The existing release-candidate.yml requires manual dispatch.
 * No automated trigger when devops checks pass on main, no changelog
 * generation, and no artifact promotion pipeline.
 *
 * Solution: Add a post-merge trigger to automatically create an RC when
 * devops checks pass. Integrate changelog generation and artifact
 * versioning.
 */

// ---- FIXED: release-candidate.yml additions ----

// 1. Add automated trigger after merge to main
name: Release Candidate

on:
  workflow_dispatch:
    inputs:
      wave_label:
        description: "Wave identifier (e.g. wave-5)"
        required: true
        default: "wave-next"
  push:
    branches:
      - "release/**"
  # NEW: Auto-trigger after devops gate passes on main
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

// 2. Add changelog generation step
jobs:
  generate-changelog:
    name: Generate Changelog
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_run'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Generate changelog
        id: changelog
        run: |
          npx tsx scripts/generate-changelog.ts \
            --from $(git rev-list --max-parents=0 HEAD) \
            --to HEAD \
            --output release-evidence/CHANGELOG.md
          echo "changelog=release-evidence/CHANGELOG.md" >> $GITHUB_OUTPUT

      - uses: actions/upload-artifact@v4
        with:
          name: changelog
          path: release-evidence/CHANGELOG.md
          retention-days: 90

// 3. Bump version automatically
  bump-version:
    name: Bump Version
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_run' && github.workflow_run.conclusion == 'success'
    outputs:
      new_version: ${{ steps.semver.outputs.new_version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Determine version bump
        id: semver
        run: |
          # Check conventional commits to determine bump type
          COMMITS=$(git log --format="%s" origin/main..HEAD)
          HAS_BREAKING=$(echo "$COMMITS" | grep -c "!")
          HAS_FEAT=$(echo "$COMMITS" | grep -c "^feat")
          if [ "$HAS_BREAKING" -gt 0 ]; then
            BUMP="major"
          elif [ "$HAS_FEAT" -gt 0 ]; then
            BUMP="minor"
          else
            BUMP="patch"
          fi
          CURRENT=$(node -p "require('./package.json').version")
          NEW=$(npx semver "$CURRENT" -i "$BUMP")
          echo "new_version=$NEW" >> $GITHUB_OUTPUT
          echo "bump=$BUMP" >> $GITHUB_OUTPUT

      - name: Write version
        run: |
          npm version --no-git-tag-version "${{ steps.semver.outputs.new_version }}"
          echo "Version bumped to ${{ steps.semver.outputs.new_version }}"

// 4. New: scripts/generate-changelog.ts
/**
 * DEVOPS-421: Generate a structured changelog from conventional commits
 * for the release candidate evidence bundle.
 */
import { execSync } from "child_process";
import fs from "fs";

interface ChangelogEntry {
  type: string;
  scope: string;
  description: string;
  sha: string;
}

function parseConventionalCommits(from: string, to: string): ChangelogEntry[] {
  const log = execSync(
    `git log --format="%s||%h" ${from}..${to}`, { encoding: "utf-8" }
  ).trim().split("\n").filter(Boolean);

  return log.map((line) => {
    const [message, sha] = line.split("||");
    const match = message.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)/);
    if (match) {
      return { type: match[1], scope: match[2] || "", description: match[3], sha };
    }
    return { type: "other", scope: "", description: message, sha };
  });
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);

const entries = parseConventionalCommits(args.from, args.to);
const grouped: Record<string, ChangelogEntry[]> = {};

for (const e of entries) {
  (grouped[e.type] ||= []).push(e);
}

const md = [
  "# Changelog",
  "",
  `Generated from \`${args.from}\` to \`${args.to}\``,
  "",
  ...Object.entries(grouped).flatMap(([type, items]) => [
    `## ${type}`,
    "",
    ...items.map((i) => `- **${i.scope}**: ${i.description} (\`${i.sha}\`)`),
    "",
  ]),
].join("\n");

fs.writeFileSync(args.output, md);
console.log(`Changelog written to ${args.output}`);
