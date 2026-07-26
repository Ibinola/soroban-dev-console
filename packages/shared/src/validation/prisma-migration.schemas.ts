import { z } from 'zod';

export const migrationStatusSchema = z.object({
  migrationName: z.string().min(1),
  appliedAtIso: z.string().optional(),
  isPending: z.boolean(),
});

export const migrationCheckResultSchema = z.object({
  checkId: z.string().min(1),
  timestampIso: z.string().min(1),
  pendingCount: z.number().int().min(0),
  migrations: z.array(migrationStatusSchema),
  passed: z.boolean(),
});

export type MigrationCheckResultInput = z.infer<typeof migrationCheckResultSchema>;
