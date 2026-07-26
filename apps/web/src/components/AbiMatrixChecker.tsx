import React from 'react';
import type { AbiCompatibilityResult } from '@qyou/shared';

interface AbiMatrixCheckerProps {
  result: AbiCompatibilityResult;
}

export function AbiMatrixChecker({ result }: AbiMatrixCheckerProps) {
  return (
    <div style={{ padding: '24px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>ABI Spec Compatibility</h3>
      <div style={{ marginBottom: '16px', fontSize: '14px', color: '#64748b' }}>
        Contract: <strong>{result.contractId}</strong> | Current Spec: <strong>{result.currentSpec}</strong>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {result.matrixChecks.map((check, idx) => (
          <div key={idx} style={{ padding: '12px 16px', borderLeft: `4px solid ${check.isSupported ? '#22c55e' : '#ef4444'}`, background: '#f8fafc', borderRadius: '0 8px 8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#1e293b' }}>Spec Version: {check.specVersion}</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '999px', background: check.isSupported ? '#dcfce3' : '#fee2e2', color: check.isSupported ? '#166534' : '#991b1b' }}>
                {check.isSupported ? 'Supported' : 'Unsupported'}
              </span>
            </div>
            {!check.isSupported && check.upgradePath && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: '#b91c1c' }}>
                ⚠️ {check.upgradePath}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
