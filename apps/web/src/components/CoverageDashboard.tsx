import React from 'react';
import type { CoverageThresholds } from '@qyou/shared';

interface CoverageDashboardProps {
  actual: CoverageThresholds;
  required: CoverageThresholds;
}

export function CoverageDashboard({ actual, required }: CoverageDashboardProps) {
  const isPassing = (metric: keyof CoverageThresholds) => actual[metric] >= required[metric];

  const MetricCard = ({ label, metric }: { label: string; metric: keyof CoverageThresholds }) => (
    <div style={{ padding: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: isPassing(metric) ? '#f0fdf4' : '#fef2f2' }}>
      <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: isPassing(metric) ? '#15803d' : '#b91c1c' }}>
        {actual[metric].toFixed(2)}%
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Target: {required[metric]}%</div>
    </div>
  );

  return (
    <div style={{ padding: '24px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Vitest Coverage Report</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <MetricCard label="Statements" metric="statements" />
        <MetricCard label="Branches" metric="branches" />
        <MetricCard label="Functions" metric="functions" />
        <MetricCard label="Lines" metric="lines" />
      </div>
    </div>
  );
}
