import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val, ctx) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PORT must be a valid integer between 1 and 65535',
      });
      return z.NEVER;
    }
    return parsed;
  }).default('3000' as any),
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid connection URL' }),
  JWT_SECRET: z.string().min(16, { message: 'JWT_SECRET must be at least 16 characters long' }),
  ENABLE_SWAGGER: z.string().optional().transform((val) => val === 'true'),
});

export type Environment = z.infer<typeof envSchema>;

/**
 * Validates process.env against the strict environment schema at startup. (#1232)
 * Fails fast with a detailed error listing all missing or malformed variables.
 */
export function validateEnvironment(config: Record<string, unknown> = process.env): Environment {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => {
      const path = err.path.join('.');
      return `  - [${path}]: ${err.message}`;
    }).join('\n');

    console.error('\n========================================');
    console.error('❌ FATAL: Invalid or Missing Environment Variables:');
    console.error(errorDetails);
    console.error('========================================\n');

    throw new Error('Environment variable validation failed. See log output above for details.');
  }

  return result.data;
}