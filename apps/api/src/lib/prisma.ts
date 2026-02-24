import "dotenv/config";

import { PrismaClient } from "@prisma/client";

declare global {
<<<<<<< Updated upstream
  // Reuse Prisma client during local reloads.
=======
  // Reuse Prisma client during dev reloads.
>>>>>>> Stashed changes
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
