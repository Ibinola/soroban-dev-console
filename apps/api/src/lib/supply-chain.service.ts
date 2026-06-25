import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface BuildManifestEntry {
  path: string;
  hash: string;
}

@Injectable()
export class SupplyChainService {
  private readonly logger = new Logger(SupplyChainService.name);
  private readonly manifestPath: string;

  constructor() {
    this.manifestPath = process.env.BUILD_MANIFEST_PATH ?? join(process.cwd(), "build-manifest.json");
  }

  verifyBuildInput(filePaths: string[]): boolean {
    for (const filePath of filePaths) {
      try {
        const content = readFileSync(filePath, "utf8");
        const hash = createHash("sha256").update(content).digest("hex");
        this.logger.debug(`Verified build input ${filePath}: ${hash}`);
      } catch {
        this.logger.error(`Failed to verify build input: ${filePath}`);
        return false;
      }
    }
    return true;
  }

  generateManifest(filePaths: string[]): BuildManifestEntry[] {
    return filePaths.map((path) => {
      const content = readFileSync(path, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      return { path, hash };
    });
  }

  verifyManifestIntegrity(manifest: BuildManifestEntry[]): boolean {
    for (const entry of manifest) {
      try {
        const content = readFileSync(entry.path, "utf8");
        const hash = createHash("sha256").update(content).digest("hex");
        if (hash !== entry.hash) {
          this.logger.warn(`Hash mismatch for ${entry.path}: expected ${entry.hash}, got ${hash}`);
          return false;
        }
      } catch {
        this.logger.error(`Cannot read manifest entry: ${entry.path}`);
        return false;
      }
    }
    return true;
  }
}
