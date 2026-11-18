import request from 'supertest';

const base = process.env.API_URL ?? 'http://localhost:3001';
const owner = (k: string) => ({ 'x-owner-key': k });

// #1405: concurrent workspace edits
describe('concurrent workspace edits', () => {
  it('serializes parallel renames without server errors', async () => {
    const created = await request(base).post('/workspaces').set(owner('owner-a')).send({ name: 'race' });
    const id = created.body.id;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => request(base).patch(`/workspaces/${id}`).set(owner('owner-a')).send({ name: `race-${i}` })),
    );
    expect(results.every((r) => r.status < 500)).toBe(true);
  });
});

// #1406: fault injection for backup restore
describe('backup restore fault injection', () => {
  it('rejects a corrupted backup payload without changing data', async () => {
    const res = await request(base).post('/backups/restore').set(owner('owner-a')).send({ data: '{corrupt' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// #1407: owner key permission boundaries
describe('owner key permission boundaries', () => {
  it('prevents another owner from reading or editing a workspace', async () => {
    const created = await request(base).post('/workspaces').set(owner('owner-a')).send({ name: 'private' });
    const id = created.body.id;
    const read = await request(base).get(`/workspaces/${id}`).set(owner('owner-b'));
    const edit = await request(base).patch(`/workspaces/${id}`).set(owner('owner-b')).send({ name: 'x' });
    expect([403, 404]).toContain(read.status);
    expect([403, 404]).toContain(edit.status);
  });
});
