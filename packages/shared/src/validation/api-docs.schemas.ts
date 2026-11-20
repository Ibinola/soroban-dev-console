import { z } from 'zod';

export const apiParameterSchema = z.object({
  name: z.string().min(1),
  in: z.enum(['query', 'path', 'header', 'body']),
  required: z.boolean(),
  type: z.string().min(1),
  description: z.string().min(1),
});

export const apiEndpointSchema = z.object({
  id: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string().min(1),
  summary: z.string().min(1),
  parameters: z.array(apiParameterSchema),
  responses: z.record(z.string()),
});

export const apiReferenceSpecSchema = z.object({
  version: z.string().min(1),
  endpoints: z.array(apiEndpointSchema),
  generatedAtIso: z.string().min(1),
});

export type ApiReferenceSpecInput = z.infer<typeof apiReferenceSpecSchema>;
