import React from 'react';
import type { MigrationCheckResult } from '@qyou/shared';

interface MigrationStatusBadgeProps {
  result: MigrationCheckResult;
}

export function MigrationStatusBadge({ result }: MigrationStatusBadgeProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', border: `1px solid ${result.passed ? '#86efac' : '#fca5a5'}`, background: result.passed ? '#f0fdf4' : '#fef2f2' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: result.passed ? '#22c55e' : '#ef4444' }} />
      <span style={{ fontSize: '13px', fontWeight: '600', color: result.passed ? '#166534' : '#991b1b' }}>
        {result.passed ? 'Database Synced' : `${result.pendingCount} Pending Migrations`}
      </span>
    </div>
  );
}
