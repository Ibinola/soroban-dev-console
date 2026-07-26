import React from 'react';
import type { ApiErrorResponse } from '@qyou/shared';

interface ErrorDisplayProps {
  errorPayload: ApiErrorResponse;
}

export function ErrorDisplay({ errorPayload }: ErrorDisplayProps) {
  const { error } = errorPayload;

  const colorMap = {
    VALIDATION_ERROR: '#d97706', // amber
    UNAUTHORIZED: '#ea580c', // orange
    NOT_FOUND: '#475569', // slate
    RATE_LIMITED: '#eab308', // yellow
    INTERNAL_SERVER_ERROR: '#dc2626', // red
  };
  
  const accentColor = colorMap[error.code] || '#dc2626';

  return (
    <div style={{ padding: '20px', borderRadius: '8px', borderLeft: `6px solid ${accentColor}`, background: '#fef2f2', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, color: '#7f1d1d', fontSize: '16px' }}>{error.code.replace(/_/g, ' ')}</h4>
        <span style={{ fontSize: '12px', color: '#b91c1c', fontFamily: 'monospace' }}>ReqID: {error.requestId.split('-')[0]}</span>
      </div>
      <p style={{ margin: '0 0 12px 0', color: '#991b1b', fontSize: '14px' }}>
        {error.message}
      </p>
      {error.details && (
        <pre style={{ margin: 0, padding: '12px', background: '#ffffff', borderRadius: '4px', fontSize: '12px', color: '#7f1d1d', overflowX: 'auto', border: '1px solid #fecaca' }}>
          {JSON.stringify(error.details, null, 2)}
        </pre>
      )}
    </div>
  );
}
