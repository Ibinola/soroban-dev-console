import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL_SERVER_ERROR',
]);

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.any()).optional(),
    requestId: z.string().min(1),
    timestampIso: z.string().min(1),
  }),
});

export type ApiErrorResponseInput = z.infer<typeof apiErrorResponseSchema>;
