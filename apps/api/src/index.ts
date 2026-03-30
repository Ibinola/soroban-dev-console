import "reflect-metadata";
import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["log", "warn", "error"] });

  app.enableCors({
    origin: webOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  await app.listen(port);
  console.log(`API server listening on http://localhost:${port}`);
}

bootstrap().catch(async (err) => {
  console.error("Failed to start API server", err);
  await prisma.$disconnect();
  process.exit(1);
});
