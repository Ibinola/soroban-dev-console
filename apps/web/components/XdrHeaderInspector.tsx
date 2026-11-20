// src/components/XdrHeaderInspector.tsx
import React from 'react';

interface XdrMetadata {
  totalBytes: number;
  xdrType: string;
  frameFormat: string;
}

interface XdrHeaderInspectorProps {
  metadata: XdrMetadata;
  headerBytes: string;
  payloadBytes: string;
}

export const XdrHeaderInspector: React.FC<XdrHeaderInspectorProps> = ({
  metadata,
  headerBytes,
  payloadBytes,
}) => {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-200">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="text-sm font-semibold text-slate-100">XDR Payload Inspector</h3>
        <div className="flex gap-4 text-xs">
          <span className="rounded bg-slate-800 px-2 py-1">Total Bytes: <strong className="text-indigo-400">{metadata.totalBytes}</strong></span>
          <span className="rounded bg-slate-800 px-2 py-1">XDR Type: <strong className="text-emerald-400">{metadata.xdrType}</strong></span>
          <span className="rounded bg-slate-800 px-2 py-1">Format: <strong className="text-amber-400">{metadata.frameFormat}</strong></span>
        </div>
      </div>
      <div className="font-mono text-xs">
        <div className="mb-2 text-slate-400">Byte Stream Breakdown:</div>
        <div className="flex flex-wrap gap-1 rounded bg-slate-950 p-3">
          <span className="rounded bg-blue-950 px-2 py-1 text-blue-300 border border-blue-800" title="Framing Header">
            {headerBytes}
          </span>
          <span className="rounded bg-emerald-950 px-2 py-1 text-emerald-300 border border-emerald-800" title="Data Payload">
            {payloadBytes}
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Framing Header</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Data Payload Bytes</span>
        </div>
      </div>
    </div>
  );
};