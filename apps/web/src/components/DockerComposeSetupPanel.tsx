import React from 'react';
import type { DockerComposeConfig } from '@qyou/shared';

interface DockerComposeSetupPanelProps {
  config: DockerComposeConfig;
}

export function DockerComposeSetupPanel({ config }: DockerComposeSetupPanelProps) {
  return (
    <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '600px' }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '18px' }}>Local Dev Environment Setup</h3>
      <p style={{ color: '#475569', fontSize: '14px', marginBottom: '24px' }}>
        Download the `docker-compose.yml` to spin up the local development environment including Postgres and the hot-reloading API.
      </p>
      
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '14px', color: '#334155' }}>
          Configured Services
        </div>
        <ul style={{ margin: 0, padding: 0, listStyleType: 'none' }}>
          {config.services.map((svc) => (
            <li key={svc.name} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>{svc.name}</span>
              <span style={{ color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}>{svc.image}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <button style={{ marginTop: '24px', padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
        Download docker-compose.yml
      </button>
    </div>
  );
}
