import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  TrendingUp,
  Box,
  Link2,
  Radio,
  ExternalLink,
  SlidersHorizontal,
  BookOpen,
} from 'lucide-react';
import { api } from './api/client';
import { StorageStatusResponse } from './types/storage';
import { Step1FileStorage } from './components/steps/Step1FileStorage';
import { Step2WhySwitch } from './components/steps/Step2WhySwitch';
import { Step3MigrateToRustfs } from './components/steps/Step3MigrateToRustfs';
import { Step4TagsAndLinks } from './components/steps/Step4TagsAndLinks';
import { Step5StreamingAndWrapUp } from './components/steps/Step5StreamingAndWrapUp';
import { SideBySideLab } from './components/SideBySideLab';
import { ObjectStoragePanel } from './components/ObjectStoragePanel';
import { FileStoragePanel } from './components/FileStoragePanel';
import { BlockStoragePanel } from './components/BlockStoragePanel';
import { ComparisonMatrix } from './components/ComparisonMatrix';

const STEPS = [
  { id: 1, shortLabel: '1. File Storage', icon: Folder },
  { id: 2, shortLabel: '2. Move to RustFS', icon: Box },
  { id: 3, shortLabel: '3. Two-Server Proof', icon: TrendingUp },
  { id: 4, shortLabel: '4. Labels & Links', icon: Link2 },
  { id: 5, shortLabel: '5. Streaming & Wrap-Up', icon: Radio },
] as const;

type ExplorerTab = 'lab' | 'object' | 'file' | 'block' | 'matrix';

export default function App() {
  const [step, setStep] = useState<number>(1);
  const [mode, setMode] = useState<'story' | 'explorer'>('story');
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>('lab');
  const [status, setStatus] = useState<StorageStatusResponse | null>(null);

  const refreshStatus = async () => {
    try {
      const s = await api.getStatus();
      setStatus(s);
    } catch {
      // ignore transient startup errors
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  // Keyboard arrow navigation for smooth presenting (ignored when typing in inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'story') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        setStep((s) => Math.min(STEPS.length, s + 1));
      } else if (e.key === 'ArrowLeft') {
        setStep((s) => Math.max(1, s - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Clean Presentation Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-amber-400 flex items-center justify-center text-slate-950 font-bold text-sm">
                FS
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-white leading-tight">
                  From Local Folders to Object Storage
                </h1>
                <p className="text-[11px] text-slate-400">
                  Interactive NestJS + RustFS Code-Along
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mode === 'story' && step >= 2 && status?.object.consoleUrl && (
                <a
                  href={status.object.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition"
                >
                  RustFS UI <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setMode(mode === 'story' ? 'explorer' : 'story')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                {mode === 'story' ? (
                  <>
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Deep-Dive Q&amp;A
                  </>
                ) : (
                  <>
                    <BookOpen className="h-3.5 w-3.5" /> Back to Code-Along
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stepper Bar (Story Mode) */}
          {mode === 'story' && (
            <nav className="mt-3.5 flex gap-1.5 overflow-x-auto pb-1">
              {STEPS.map((s) => {
                const Icon = s.icon;
                const active = step === s.id;
                const completed = step > s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition border ${
                      active
                        ? s.id === 1
                          ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                          : s.id === 3
                          ? 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                          : 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                        : completed
                        ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.shortLabel}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* Body */}
      {mode === 'story' ? (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          {step === 1 && <Step1FileStorage />}
          {step === 2 && <Step3MigrateToRustfs consoleUrl={status?.object.consoleUrl} />}
          {step === 3 && <Step2WhySwitch />}
          {step === 4 && <Step4TagsAndLinks />}
          {step === 5 && <Step5StreamingAndWrapUp />}

          {/* Bottom Presentation Step Controls */}
          <div className="mt-10 flex items-center justify-between border-t border-slate-800/80 pt-6">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => {
                setStep((s) => Math.max(1, s - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition"
            >
              <ChevronLeft className="h-4 w-4" /> Previous Step
            </button>

            <span className="hidden sm:inline text-xs text-slate-500">
              Tip: Use ← and → arrow keys to present
            </span>

            {step < STEPS.length ? (
              <button
                type="button"
                onClick={() => {
                  setStep((s) => Math.min(STEPS.length, s + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 transition"
              >
                Next: {STEPS[step].shortLabel} <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/25 transition"
              >
                Restart Walkthrough
              </button>
            )}
          </div>
        </main>
      ) : (
        /* Optional Deep-Dive Q&A Mode */
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 space-y-5">
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
            {(
              [
                ['lab', 'Side-by-Side Lab'],
                ['object', 'Object (RustFS)'],
                ['file', 'File (POSIX)'],
                ['block', 'Block (Raw LBA)'],
                ['matrix', 'Comparison Matrix'],
              ] as [ExplorerTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setExplorerTab(id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  explorerTab === id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {explorerTab === 'lab' && <SideBySideLab onActivity={refreshStatus} />}
          {explorerTab === 'object' && (
            <ObjectStoragePanel
              consoleUrl={status?.object.consoleUrl}
              onActivity={refreshStatus}
            />
          )}
          {explorerTab === 'file' && <FileStoragePanel onActivity={refreshStatus} />}
          {explorerTab === 'block' && <BlockStoragePanel onActivity={refreshStatus} />}
          {explorerTab === 'matrix' && <ComparisonMatrix />}
        </main>
      )}
    </div>
  );
}
