import { existsSync, readFileSync } from "fs";

const requiredPlaybooks = [
  { path: "docs/runbooks.md", sections: ["## "] },
  { path: "docs/backup-restore-drill.md", sections: ["## "] },
  { path: "docs/release-candidate.md", sections: ["## "] },
  { path: "CONTRIBUTING.md", sections: ["## "] },
];

export function validatePlaybooks(): boolean {
  let allValid = true;
  for (const { path, sections } of requiredPlaybooks) {
    if (!existsSync(path)) {
      console.error(`  [MISSING FILE] ${path}`);
      allValid = false;
      continue;
    }
    const content = readFileSync(path, "utf-8");
    let fileValid = true;
    for (const section of sections) {
      if (!content.includes(section)) {
        console.error(`  [MISSING SECTION "${section}"] ${path}`);
        fileValid = false;
        allValid = false;
      }
    }
    if (fileValid) console.log(`  [OK] ${path}`);
  }
  return allValid;
}

const valid = validatePlaybooks();
if (!valid) process.exit(1);
else console.log("All playbooks valid.");
