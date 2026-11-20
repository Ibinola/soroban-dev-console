import { z } from 'zod';

export const HealthContractSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptime: z.number(),
});

export const WorkspaceContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
});

export const ShareLinkContractSchema = z.object({
  token: z.string(),
  workspaceId: z.string(),
  accessLevel: z.enum(['viewer', 'editor']),
  expiresAt: z.string().nullable(),
});

export const AuditLogContractSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorIp: z.string(),
  timestamp: z.string(),
});

export type HealthContract = z.infer<typeof HealthContractSchema>;
export type WorkspaceContract = z.infer<typeof WorkspaceContractSchema>;
export type ShareLinkContract = z.infer<typeof ShareLinkContractSchema>;
export type AuditLogContract = z.infer<typeof AuditLogContractSchema>;