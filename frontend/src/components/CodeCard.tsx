import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeCardProps {
  title: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'slate';
  code: string;
}

export const CodeCard: React.FC<CodeCardProps> = ({
  title,
  badge,
  badgeColor = 'slate',
  code,
}) => {
  const [copied, setCopied] = useState(false);

  const badgeClasses = {
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
  }[badgeColor];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-200">{title}</span>
          {badge && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClasses}`}>
              {badge}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};
