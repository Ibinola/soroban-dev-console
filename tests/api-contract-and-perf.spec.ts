import request from 'supertest';

const base = process.env.API_URL ?? 'http://localhost:3001';

// #1408: contract coverage for backup and runtime config endpoints
describe('API contract: backup and runtime config', () => {
  it('GET /runtime-config returns a JSON object', async () => {
    const res = await request(base).get('/runtime-config');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  it('GET /backups rejects unauthenticated access', async () => {
    const res = await request(base).get('/backups');
    expect([401, 403]).toContain(res.status);
  });
});

// #1410: large workspace performance fixture
function makeLargeWorkspace(contracts = 2000) {
  return {
    name: 'perf-fixture',
    contracts: Array.from({ length: contracts }, (_, i) => ({ id: `c${i}`, name: `Contract ${i}`, address: `C${String(i).padStart(55, 'A')}` })),
  };
}

describe('large workspace fixture', () => {
  it('serializes and parses 2000 contracts under 500ms', () => {
    const t = Date.now();
    const parsed = JSON.parse(JSON.stringify(makeLargeWorkspace()));
    expect(parsed.contracts).toHaveLength(2000);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
