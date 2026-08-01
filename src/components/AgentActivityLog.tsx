import React, { useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Cpu, Layers, Sparkles, Terminal } from 'lucide-react';
import { AgentLogEntry } from '../types';

interface Props {
  logs: AgentLogEntry[];
  onClearLogs?: () => void;
}

export const AgentActivityLog: React.FC<Props> = ({ logs, onClearLogs }) => {
  const [expandedId, setExpandedId] = useState<string | null>(logs[0]?.id || null);

  const getAgentBadge = (agent: string) => {
    switch (agent) {
      case 'detection':
        return { label: 'Detection Agent', color: 'bg-red-950/90 text-red-300 border-red-700' };
      case 'resource':
        return { label: 'Resource Agent', color: 'bg-emerald-950/90 text-emerald-300 border-emerald-700' };
      case 'communication':
        return { label: 'Communication Agent', color: 'bg-amber-950/90 text-amber-300 border-amber-700' };
      case 'citizen':
        return { label: 'Citizen Report Agent', color: 'bg-cyan-950/90 text-cyan-300 border-cyan-700' };
      default:
        return { label: 'AI Agent', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getProviderBadge = (provider: 'gemini' | 'groq' | 'fallback') => {
    if (provider === 'gemini') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-700">
          <Sparkles className="w-3 h-3 text-blue-400" />
          Gemini 3.6 Flash
        </span>
      );
    }
    if (provider === 'groq') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700">
          <Cpu className="w-3 h-3 text-amber-400" />
          Groq Fallback
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
        <Bot className="w-3 h-3 text-slate-400" />
        Deterministic Engine
      </span>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="bg-slate-950/80 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-red-950/60 border border-red-800 text-red-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Cooperative Agent Activity Log
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>
            <p className="text-xs text-slate-400">
              Live JSON handoff pipeline across 4 AI agents
            </p>
          </div>
        </div>

        {onClearLogs && logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear Activity
          </button>
        )}
      </div>

      {/* Log Feed */}
      <div className="p-4 space-y-3 overflow-y-auto max-h-[520px] font-mono text-xs">
        {logs.length === 0 ? (
          <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
            <Layers className="w-8 h-8 opacity-40" />
            <p className="text-xs font-sans">No agent executions logged yet. Trigger an emergency event or citizen report to run the pipeline.</p>
          </div>
        ) : (
          logs.map((log, idx) => {
            const agentBadge = getAgentBadge(log.agent);
            const isExpanded = expandedId === log.id;

            return (
              <div
                key={log.id}
                className="bg-slate-950/70 border border-slate-800/90 rounded-xl overflow-hidden transition-all duration-150"
              >
                {/* Log Item Summary Bar */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between text-left hover:bg-slate-800/40 transition-colors gap-2"
                >
                  <div className="flex items-center gap-2.5 flex-wrap overflow-hidden">
                    <span className="text-[10px] text-slate-500 font-bold shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0 ${agentBadge.color}`}>
                      {agentBadge.label}
                    </span>

                    {/* Offline Dual Timestamp Tag */}
                    {log.offlineSyncTag && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-700/80 shrink-0 font-bold">
                        {log.offlineSyncTag}
                      </span>
                    )}

                    {/* Amber Delayed Report Badge */}
                    {log.isDelayed && (
                      <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500 font-bold shrink-0 flex items-center gap-1">
                        ⚠️ Delayed Report ({log.delayMinutes || 7}m gap)
                      </span>
                    )}

                    <span className="text-slate-300 font-sans text-xs truncate">
                      {log.inputSummary}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {getProviderBadge(log.providerUsed)}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded JSON Output & Location Details Viewer */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-slate-950 font-mono space-y-2">
                    {log.resolvedLocationSummary && (
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs font-sans text-slate-200 flex items-center justify-between">
                        <span className="font-bold text-amber-400">📍 Resolved Location:</span>
                        <span className="font-mono text-emerald-300 text-[11px]">{log.resolvedLocationSummary}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-sans border-b border-slate-900 pb-1">
                      <span>Pipeline Output Payload (JSON)</span>
                      <span>Latency: {log.executionTimeMs || 120}ms</span>
                    </div>
                    <pre className="text-[11px] leading-relaxed text-emerald-400 bg-slate-900/90 p-3 rounded-lg overflow-x-auto border border-slate-800">
                      <code>{JSON.stringify(log.outputJson, null, 2)}</code>
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
