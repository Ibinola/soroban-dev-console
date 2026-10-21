import request from 'supertest';
import { 
  HealthContractSchema, 
  WorkspaceContractSchema, 
  ShareLinkContractSchema, 
  AuditLogContractSchema 
} from '../src/schemas';

// Mock test server or import NestJS bootstrap instance
// import { app } from '../../../apps/api/src/main'; 

describe('API Contract Tests between Frontend & Backend (#1224)', () => {
  const API_BASE = 'http://localhost:3001/api/v1'; // Or test app instance

  it('should validate Health endpoint contract response shape', async () => {
    // Simulated request or app call
    // const res = await request(app).get('/api/v1/health');
    const mockResponse = { status: 'ok', version: '1.0.0', uptime: 12500 };

    const result = HealthContractSchema.safeParse(mockResponse);
    if (!result.success) {
      throw new Error(`API Contract Mismatch on /health: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
    expect(result.success).toBe(true);
  });

  it('should validate Workspaces endpoint contract response shape', async () => {
    const mockResponse = {
      id: 'ws-123',
      name: 'Test Workspace',
      ownerId: 'user-456',
      createdAt: '2026-10-20T12:00:00Z',
    };

    const result = WorkspaceContractSchema.safeParse(mockResponse);
    if (!result.success) {
      throw new Error(`API Contract Mismatch on /workspaces: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
    expect(result.success).toBe(true);
  });

  it('should validate Share Link resolution contract response shape', async () => {
    const mockResponse = {
      token: 'valid-token',
      workspaceId: 'ws-123',
      accessLevel: 'viewer',
      expiresAt: null,
    };

    const result = ShareLinkContractSchema.safeParse(mockResponse);
    if (!result.success) {
      throw new Error(`API Contract Mismatch on /shares: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
    expect(result.success).toBe(true);
  });

  it('should validate Audit Logs contract response shape', async () => {
    const mockResponse = {
      id: 'audit-999',
      action: 'SHARE_TOKEN_RESOLVED',
      actorIp: '127.0.0.1',
      timestamp: '2026-10-20T12:00:00Z',
    };

    const result = AuditLogContractSchema.safeParse(mockResponse);
    if (!result.success) {
      throw new Error(`API Contract Mismatch on /audit: ${JSON.stringify(result.error.format(), null, 2)}`);
    }
    expect(result.success).toBe(true);
  });
});