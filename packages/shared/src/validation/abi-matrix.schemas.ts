import { z } from 'zod';

export const abiMatrixCheckSchema = z.object({
  specVersion: z.string().min(1),
  isSupported: z.boolean(),
  deprecationDateIso: z.string().optional(),
  upgradePath: z.string().optional(),
});

export const abiCompatibilityResultSchema = z.object({
  contractId: z.string().min(1),
  currentSpec: z.string().min(1),
  matrixChecks: z.array(abiMatrixCheckSchema),
  isValid: z.boolean(),
});

export type AbiCompatibilityResultInput = z.infer<typeof abiCompatibilityResultSchema>;
