const pinnedActions: Record<string, { version: string; sha: string }> = {
  "actions/checkout": {
    version: "v4",
    sha: "11bd71901bbe5b1630ceea73d27597364c9af683",
  },
  "actions/setup-node": {
    version: "v4",
    sha: "49933ea5288caeca8642d1e84afbd3f7d6820020",
  },
  "actions/cache": {
    version: "v4",
    sha: "5a3ec84abe1b8b5bbfa41e0b45c5df9fde3c9a17",
  },
  "actions/upload-artifact": {
    version: "v4",
    sha: "ea165f8d65b6e75b540449e92b4886f43607fa02",
  },
  "actions/github-script": {
    version: "v7",
    sha: "60a0d83039c74a4aee543508d2ffcb1c3799cdea",
  },
};

export function getPinnedRef(action: string): string {
  const entry = pinnedActions[action];
  if (!entry) throw new Error(`No pinned SHA for: ${action}`);
  return `${action}@${entry.sha} # ${entry.version}`;
}

export function printPinnedActions(): void {
  console.log("Pinned GitHub Actions references:\n");
  for (const [action, { version, sha }] of Object.entries(pinnedActions)) {
    console.log(`  uses: ${action}@${sha} # ${version}`);
  }
}

printPinnedActions();
