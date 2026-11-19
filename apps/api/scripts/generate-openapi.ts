/**
 * Generate or check the committed OpenAPI artifact (#1380).
 *
 *   npm run openapi:generate   # writes apps/api/openapi.json
 *   npm run openapi:check      # exits 1 with a readable diff if it is out of date
 *
 * The Nest app is created (not started) against a throw-away SQLite file, so no
 * real database, port or credentials are involved, and the output is passed
 * through the canonicalizer so it does not depend on the environment.
 */
import "reflect-metadata";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { diffOpenApi, serializeOpenApi } from "../src/lib/openapi-artifact.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactPath = path.resolve(here, "../openapi.json");
const check = process.argv.includes("--check");

const tempDir = mkdtempSync(path.join(tmpdir(), "openapi-gen-"));
process.env.DATABASE_URL = `file:${path.join(tempDir, "openapi.db")}`;
process.env.NODE_ENV = "test";

async function main(): Promise<number> {
  const { AppModule } = await import("../src/app.module.js");
  const { buildOpenApiDocument } = await import("../src/lib/swagger.js");
  const version = (JSON.parse(readFileSync(path.resolve(here, "../package.json"), "utf8")) as { version: string }).version;

  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.init();
    const generated = serializeOpenApi(buildOpenApiDocument(app, version) as unknown as Record<string, unknown>);

    if (!check) {
      writeFileSync(artifactPath, generated);
      console.log(`Wrote ${path.relative(process.cwd(), artifactPath)}`);
      return 0;
    }

    if (!existsSync(artifactPath)) {
      console.error("openapi.json is missing. Run `npm run openapi:generate -w api` and commit the result.");
      return 1;
    }
    const diff = diffOpenApi(readFileSync(artifactPath, "utf8"), generated);
    if (diff.identical) {
      console.log("OpenAPI artifact is up to date.");
      return 0;
    }
    console.error("OpenAPI artifact is out of date:\n");
    for (const line of diff.lines) console.error(line);
    console.error("\nRun `npm run openapi:generate -w api` and commit the updated apps/api/openapi.json.");
    return 1;
  } finally {
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(2);
  },
);
