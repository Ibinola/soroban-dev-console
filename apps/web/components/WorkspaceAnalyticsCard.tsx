// src/components/WorkspaceAnalyticsCard.tsx
import React from 'react';

interface WorkspaceMetrics {
  totalContracts: number;
  totalInvocations: number;
  successRatio: number; // percentage, e.g., 98.5
  trendData: number[];
}

interface WorkspaceAnalyticsCardProps {
  metrics: WorkspaceMetrics;
}

export const WorkspaceAnalyticsCard: React.FC<WorkspaceAnalyticsCardProps> = ({ metrics }) => {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-200 shadow-lg">
      <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Workspace Overview</h3>
          <p className="text-xs text-slate-400">Real-time activity and execution performance metrics</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Sync
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Total Contracts</div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-400">{metrics.totalContracts.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Total Invocations</div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400">{metrics.totalInvocations.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Success Ratio</div>
          <div className="mt-2 text-2xl font-extrabold text-amber-400">{metrics.successRatio.toFixed(1)}%</div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-400">
          <span>Invocation Trend (Last 7 Epochs)</span>
          <span className="text-slate-500">Auto-updating</span>
        </div>
        <div className="flex h-24 items-end gap-2 pt-4">
          {metrics.trendData.map((val, idx) => {
            const maxVal = Math.max(...metrics.trendData, 1);
            const heightPercent = Math.max(15, (val / maxVal) * 100);
            return (
              <div key={idx} className="group relative flex-1 flex flex-col items-center h-full justify-end">
                <div 
                  className="w-full rounded-t bg-indigo-600 transition-all duration-300 group-hover:bg-indigo-500" 
                  style={{ height: `${heightPercent}%` }}
                ></div>
                <span className="absolute -top-6 hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 group-hover:block">
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};