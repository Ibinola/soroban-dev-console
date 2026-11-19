import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/**
 * Swagger UI is served at `/api/docs` (JSON spec at `/api/docs-json`) in
 * development. In production it stays off unless SWAGGER_ENABLED=true.
 */
export function isSwaggerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SWAGGER_ENABLED === "true") return true;
  if (env.SWAGGER_ENABLED === "false") return false;
  return env.NODE_ENV !== "production";
}

/** Build the OpenAPI document. `version` is explicit so generated artifacts do not depend on the environment. */
export function buildOpenApiDocument(app: INestApplication, version?: string) {
  const config = new DocumentBuilder()
    .setTitle("Soroban Dev Console API")
    .setDescription("REST API for workspaces, shares, RPC proxying and audit logs")
    .setVersion(version ?? process.env.npm_package_version ?? "0.1.0")
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): boolean {
  if (!isSwaggerEnabled()) return false;
  const document = buildOpenApiDocument(app);
  // The global prefix is "api", so these resolve to /api/docs and /api/docs-json.
  SwaggerModule.setup("docs", app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: "docs-json",
  });
  return true;
}
