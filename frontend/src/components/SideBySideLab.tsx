import React, { useState } from 'react';
import {
  Play,
  Box,
  FolderTree,
  HardDrive,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  onActivity?: () => void;
}

export const SideBySideLab: React.FC<Props> = ({ onActivity }) => {
  const [sizeKb, setSizeKb] = useState(32);
  const [patchOffset, setPatchOffset] = useState(500);
  const [patchText, setPatchText] = useState('<<PATCHED_16B!>>');
  const [owner, setOwner] = useState('alice');
  const [department, setDepartment] = useState('platform-engineering');

  const [loadingExp, setLoadingExp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [writeResult, setWriteResult] = useState<any>(null);
  const [patchResult, setPatchResult] = useState<any>(null);
  const [metaResult, setMetaResult] = useState<any>(null);

  const runExp1 = async () => {
    setError(null);
    setLoadingExp('write');
    try {
      const res = await api.runWritePayloadExperiment(sizeKb, 'lab');
      setWriteResult(res);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingExp(null);
    }
  };

  const runExp2 = async () => {
    setError(null);
    setLoadingExp('patch');
    try {
      const res = await api.runPatchBytesExperiment(patchOffset, patchText, 'lab');
      setPatchResult(res);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingExp(null);
    }
  };

  const runExp3 = async () => {
    setError(null);
    setLoadingExp('meta');
    try {
      const res = await api.runMetadataShareExperiment(owner, department, 'confidential');
      setMetaResult(res);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingExp(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              Same Operation, Three Storage Architectures
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Run real operations simultaneously against{' '}
              <span className="font-medium text-amber-400">RustFS (Object)</span>,{' '}
              <span className="font-medium text-emerald-400">POSIX Volume (File)</span>, and{' '}
              <span className="font-medium text-indigo-400">Raw 4 KB Disk (Block)</span> to observe
              live differences in I/O amplification, mutability, metadata, and sharing.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Experiment 1 */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Experiment 1 — Addressing &amp; Storage Layout
            </span>
            <h3 className="text-base font-semibold text-white">
              Write the Same Payload to All 3 Storage Backends
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              Payload size:
              <select
                value={sizeKb}
                onChange={(e) => setSizeKb(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
              >
                <option value={8}>8 KB (2 blocks)</option>
                <option value={32}>32 KB (8 blocks)</option>
                <option value={64}>64 KB (16 blocks)</option>
              </select>
            </label>
            <button
              onClick={runExp1}
              disabled={loadingExp !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
            >
              <Play className="h-4 w-4" />
              {loadingExp === 'write' ? 'Running...' : 'Run Experiment 1'}
            </button>
          </div>
        </div>

        {writeResult && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300">
                  <Box className="h-4 w-4" /> Object (RustFS)
                </span>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs text-amber-300">
                  {writeResult.object.durationMs} ms
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Address:{' '}
                <code className="text-slate-200 break-all">{writeResult.object.address}</code>
              </div>
              <div className="text-xs text-slate-400">
                ETag: <code className="text-slate-200">{writeResult.object.extra.etag}</code>
              </div>
              <p className="text-xs text-slate-300">{writeResult.object.summary}</p>
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  <FolderTree className="h-4 w-4" /> File (POSIX)
                </span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs text-emerald-300">
                  {writeResult.file.durationMs} ms
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Path: <code className="text-slate-200">{writeResult.file.address}</code>
              </div>
              <div className="text-xs text-slate-400">
                Inode: <code className="text-slate-200">{writeResult.file.extra.inode}</code> ·
                Mode: <code className="text-slate-200">{writeResult.file.extra.mode}</code>
              </div>
              <p className="text-xs text-slate-300">{writeResult.file.summary}</p>
            </div>

            <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/15 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300">
                  <HardDrive className="h-4 w-4" /> Block (Raw LBA)
                </span>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-xs text-indigo-300">
                  {writeResult.block.durationMs} ms
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Sectors: <code className="text-slate-200">{writeResult.block.address}</code>
              </div>
              <div className="text-xs text-slate-400">
                Blocks used:{' '}
                <code className="text-slate-200">{writeResult.block.extra.blocksUsed}</code> · Slack
                space:{' '}
                <code className="text-slate-200">{writeResult.block.extra.slackSpaceBytes} B</code>
              </div>
              <p className="text-xs text-slate-300">{writeResult.block.summary}</p>
            </div>
          </div>
        )}
      </section>

      {/* Experiment 2 */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Experiment 2 — Mutability &amp; Write Amplification
            </span>
            <h3 className="text-base font-semibold text-white">
              Patch Only {patchText.length} Bytes in the Middle (Byte Offset {patchOffset})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              Offset:
              <input
                type="number"
                min={0}
                max={3000}
                value={patchOffset}
                onChange={(e) => setPatchOffset(Number(e.target.value))}
                className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              Bytes:
              <input
                type="text"
                value={patchText}
                onChange={(e) => setPatchText(e.target.value)}
                className="w-40 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white"
              />
            </label>
            <button
              onClick={runExp2}
              disabled={loadingExp !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 transition"
            >
              <Play className="h-4 w-4" />
              {loadingExp === 'patch' ? 'Patching...' : 'Run Experiment 2'}
            </button>
          </div>
        </div>

        {patchResult && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300">
                  <AlertTriangle className="h-4 w-4" /> Object (Full Rewrite!)
                </span>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs text-amber-300">
                  {patchResult.object.durationMs} ms
                </span>
              </div>
              <div className="rounded bg-slate-950/80 px-2.5 py-2 font-mono text-xs text-amber-200">
                Total I/O: <strong>{patchResult.object.bytesIoTotal.toLocaleString()} bytes</strong>
                <div className="text-[11px] text-slate-400">
                  ({patchResult.object.extra.bytesRead.toLocaleString()} B read +{' '}
                  {patchResult.object.extra.bytesWritten.toLocaleString()} B uploaded)
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                ETag changed: <code className="text-slate-300">{patchResult.object.extra.oldEtag.slice(0, 10)}…</code>{' '}
                → <code className="text-amber-300">{patchResult.object.extra.newEtag.slice(0, 10)}…</code>
              </div>
              <p className="text-xs text-slate-300">{patchResult.object.takeaway}</p>
            </div>

            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> File (In-Place pwrite)
                </span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs text-emerald-300">
                  {patchResult.file.durationMs} ms
                </span>
              </div>
              <div className="rounded bg-slate-950/80 px-2.5 py-2 font-mono text-xs text-emerald-200">
                Total I/O: <strong>{patchResult.file.bytesIoTotal} bytes</strong>
                <div className="text-[11px] text-slate-400">
                  Inode preserved: {String(patchResult.file.extra.inodePreserved)} (#
                  {patchResult.file.extra.inodeAfter})
                </div>
              </div>
              <p className="text-xs text-slate-300">{patchResult.file.takeaway}</p>
            </div>

            <div className="rounded-lg border border-indigo-500/40 bg-indigo-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300">
                  <CheckCircle2 className="h-4 w-4" /> Block (Direct Sector I/O)
                </span>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-xs text-indigo-300">
                  {patchResult.block.durationMs} ms
                </span>
              </div>
              <div className="rounded bg-slate-950/80 px-2.5 py-2 font-mono text-xs text-indigo-200">
                Total I/O: <strong>{patchResult.block.bytesIoTotal} bytes</strong>
                <div className="text-[11px] text-slate-400">
                  Direct seek to LBA {patchResult.block.extra.lba} (byte{' '}
                  {patchResult.block.extra.absoluteByteOffset})
                </div>
              </div>
              <p className="text-xs text-slate-300">{patchResult.block.takeaway}</p>
            </div>
          </div>
        )}
      </section>

      {/* Experiment 3 */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Experiment 3 — Rich Metadata &amp; Direct HTTP Access
            </span>
            <h3 className="text-base font-semibold text-white">
              Attach Custom Business Metadata &amp; Generate a Shareable Link
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="owner"
              className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
            />
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="department"
              className="w-40 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
            />
            <button
              onClick={runExp3}
              disabled={loadingExp !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              <Play className="h-4 w-4" />
              {loadingExp === 'meta' ? 'Running...' : 'Run Experiment 3'}
            </button>
          </div>
        </div>

        {metaResult && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-300">Object (RustFS Wins!)</span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  Native Metadata + HTTP
                </span>
              </div>
              <pre className="overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-amber-200">
                {JSON.stringify(metaResult.object.storedMetadata, null, 2)}
              </pre>
              <a
                href={metaResult.object.presignedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Live Presigned URL (RustFS)
              </a>
              <p className="text-xs text-slate-300">{metaResult.object.takeaway}</p>
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-300">File (POSIX Fixed)</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                  OS Stats Only
                </span>
              </div>
              <pre className="overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-emerald-200">
                {JSON.stringify(metaResult.file.storedMetadata, null, 2)}
              </pre>
              <div className="text-xs text-slate-400 italic">No native HTTP URL</div>
              <p className="text-xs text-slate-300">{metaResult.file.takeaway}</p>
            </div>

            <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/15 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-indigo-300">Block (Raw Bytes)</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                  Zero Metadata
                </span>
              </div>
              <div className="rounded bg-slate-950 p-2 font-mono text-[11px] text-slate-400">
                metadata: null{'\n'}filename: null{'\n'}httpUrl: null
              </div>
              <p className="text-xs text-slate-300">{metaResult.block.takeaway}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
