import React from 'react';
import type { ApiReferenceSpec } from '@qyou/shared';

interface ApiReferenceDocsProps {
  spec: ApiReferenceSpec;
}

export function ApiReferenceDocs({ spec }: ApiReferenceDocsProps) {
  return (
    <div style={{ padding: '24px', fontFamily: 'monospace', color: '#334155', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', color: '#0f172a', marginBottom: '8px' }}>API Reference v{spec.version}</h1>
      <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px' }}>Generated at {new Date(spec.generatedAtIso).toLocaleString()}</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {spec.endpoints.map((ep) => (
          <div key={ep.id} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: ep.method === 'GET' ? '#dbeafe' : ep.method === 'POST' ? '#dcfce3' : '#fef3c7', color: ep.method === 'GET' ? '#1d4ed8' : ep.method === 'POST' ? '#15803d' : '#b45309' }}>
                {ep.method}
              </span>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{ep.path}</span>
            </div>
            <div style={{ padding: '16px', background: '#ffffff' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>{ep.summary}</p>
              
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#475569' }}>Parameters:</h4>
              <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', fontSize: '13px' }}>
                {ep.parameters.map((p, i) => (
                  <li key={i}>
                    <strong>{p.name}</strong> ({p.in}, {p.type}){p.required && <span style={{ color: '#ef4444' }}>*</span>} - {p.description}
                  </li>
                ))}
              </ul>
              
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#475569' }}>Responses:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                {Object.entries(ep.responses).map(([code, desc]) => (
                  <li key={code}><strong>{code}</strong>: {desc}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
