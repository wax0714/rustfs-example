import React, { useEffect, useState } from 'react';
import {
  Server,
  AlertCircle,
  CheckCircle2,
  Box,
  HardDrive,
  Tags,
  Gauge,
  Users,
  RotateCcw,
} from 'lucide-react';

interface ServerIdentity {
  online: boolean;
  serverName: string;
  containerId?: string;
}

interface HttpResult {
  status: number;
  ok: boolean;
  message: string;
  content?: string;
}

const DEMO_FILE_PATH = 'uploads/avatar-demo.txt';

export const Step2WhySwitch: React.FC = () => {
  const [mode, setMode] = useState<'local' | 'object'>('local');
  const [serverA, setServerA] = useState<ServerIdentity>({ online: false, serverName: 'Server A' });
  const [serverB, setServerB] = useState<ServerIdentity>({ online: false, serverName: 'Server B' });

  const [stepAResult, setStepAResult] = useState<HttpResult | null>(null);
  const [stepBResult, setStepBResult] = useState<HttpResult | null>(null);
  const [busy, setBusy] = useState<'a' | 'b' | null>(null);

  const checkServers = async () => {
    try {
      const resA = await fetch('/api/storage/status');
      if (resA.ok) {
        const data = await resA.json();
        setServerA({
          online: true,
          serverName: data.serverName || 'Server A',
          containerId: data.containerId,
        });
      }
    } catch {
      setServerA({ online: false, serverName: 'Server A' });
    }

    try {
      const resB = await fetch('/api-b/storage/status');
      if (resB.ok) {
        const data = await resB.json();
        setServerB({
          online: true,
          serverName: data.serverName || 'Server B',
          containerId: data.containerId,
        });
      }
    } catch {
      setServerB({ online: false, serverName: 'Server B' });
    }
  };

  useEffect(() => {
    checkServers();
  }, []);

  const switchMode = (nextMode: 'local' | 'object') => {
    setMode(nextMode);
    setStepAResult(null);
    setStepBResult(null);
  };

  const handleSaveOnServerA = async () => {
    setBusy('a');
    setStepBResult(null);
    const payload = `Uploaded to ${serverA.serverName} at ${new Date().toLocaleTimeString()}`;

    try {
      const res =
        mode === 'local'
          ? await fetch('/api/storage/file/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: DEMO_FILE_PATH, content: payload }),
            })
          : await fetch('/api/storage/object/put', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: DEMO_FILE_PATH, content: payload, metadata: {} }),
            });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStepAResult({
          status: res.status,
          ok: true,
          message:
            mode === 'local'
              ? `Saved "${DEMO_FILE_PATH}" to Server A's local folder.`
              : `Uploaded "${DEMO_FILE_PATH}" to the shared RustFS bucket!`,
          content: payload,
        });
      } else {
        setStepAResult({
          status: res.status,
          ok: false,
          message:
            res.status === 501
              ? 'Server A returned 501 — RustFS upload is not coded yet! Finish Code-Along #1 in Step 2 first, then test here.'
              : data?.message || `Request failed (HTTP ${res.status})`,
        });
      }
    } catch (err: any) {
      setStepAResult({
        status: 0,
        ok: false,
        message: `Could not reach Server A (:3000): ${err.message}`,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReadFromServerB = async () => {
    setBusy('b');
    try {
      const url =
        mode === 'local'
          ? `/api-b/storage/file/read?path=${encodeURIComponent(DEMO_FILE_PATH)}`
          : `/api-b/storage/object/item?key=${encodeURIComponent(DEMO_FILE_PATH)}`;

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStepBResult({
          status: res.status,
          ok: true,
          message: `Server B read "${DEMO_FILE_PATH}" straight from the shared RustFS bucket!`,
          content: data?.content,
        });
      } else {
        setStepBResult({
          status: res.status,
          ok: false,
          message:
            res.status === 404
              ? `Real HTTP 404 from Server B! "${DEMO_FILE_PATH}" only exists in Server A's local folder.`
              : data?.message || `Server B returned HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setStepBResult({
        status: 0,
        ok: false,
        message: `Could not reach Server B (:3001). Make sure docker compose up is running! (${err.message})`,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    setStepAResult(null);
    setStepBResult(null);
    // Clean up test file on both servers (best effort)
    await Promise.allSettled([
      fetch(`/api/storage/file/item?path=${encodeURIComponent(DEMO_FILE_PATH)}`, {
        method: 'DELETE',
      }),
      fetch(`/api-b/storage/file/item?path=${encodeURIComponent(DEMO_FILE_PATH)}`, {
        method: 'DELETE',
      }),
      fetch(`/api/storage/object/item?key=${encodeURIComponent(DEMO_FILE_PATH)}`, {
        method: 'DELETE',
      }),
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
          Step 3 of 5 · Live Two-Server Proof
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Why We Switched: The Live Two-Server Test
        </h2>
        <p className="max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
          Docker is running <strong>two real NestJS servers</strong> right now —{' '}
          <code className="text-sky-300">Server A (:3000)</code> and{' '}
          <code className="text-sky-300">Server B (:3001)</code> — each with its own local folder.
          Try saving a file on Server A and opening it from Server B!
        </p>
      </div>

      {/* Real Two-Server Interactive Demo */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Live Two-Container Test</h3>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
              title="Reset test file"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1 text-xs">
            <button
              type="button"
              onClick={() => switchMode('local')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                mode === 'local'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Local Folders (File Storage)
            </button>
            <button
              type="button"
              onClick={() => switchMode('object')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                mode === 'object'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Shared Bucket (RustFS)
            </button>
          </div>
        </div>

        {/* Real HTTP Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleSaveOnServerA}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition"
          >
            {busy === 'a'
              ? 'Sending to Server A...'
              : '1. Save avatar-demo.txt on Server A (:3000)'}
          </button>
          <button
            type="button"
            disabled={busy !== null || !stepAResult?.ok}
            onClick={handleReadFromServerB}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 transition"
          >
            {busy === 'b'
              ? 'Asking Server B...'
              : '2. Read avatar-demo.txt from Server B (:3001)'}
          </button>
        </div>

        {/* Live Containers Display */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Server A */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Server className="h-4 w-4 text-sky-400" />
                {serverA.serverName} <span className="font-mono text-xs text-slate-400">(:3000)</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  serverA.online
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-red-500/15 text-red-300'
                }`}
              >
                {serverA.online ? `online · ${serverA.containerId?.slice(0, 8) || 'local'}` : 'offline'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs space-y-1.5">
              <div className="text-slate-400">
                {mode === 'local' ? 'Own local folder: file_storage_a' : 'Connected to shared RustFS'}
              </div>
              {stepAResult ? (
                <div className="space-y-1">
                  <span
                    className={`inline-flex items-center gap-1.5 font-medium ${
                      stepAResult.ok ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {stepAResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    HTTP {stepAResult.status || 'ERR'} — {stepAResult.message}
                  </span>
                  {stepAResult.content && (
                    <div className="font-mono text-[11px] text-slate-400 bg-slate-950 rounded px-2 py-1">
                      {stepAResult.content}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-slate-500">Waiting for Step 1 click...</span>
              )}
            </div>
          </div>

          {/* Server B */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Server className="h-4 w-4 text-sky-400" />
                {serverB.serverName} <span className="font-mono text-xs text-slate-400">(:3001)</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  serverB.online
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-red-500/15 text-red-300'
                }`}
              >
                {serverB.online ? `online · ${serverB.containerId?.slice(0, 8) || 'local'}` : 'offline'}
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs space-y-1.5">
              <div className="text-slate-400">
                {mode === 'local'
                  ? 'Own separate folder: file_storage_b'
                  : 'Connected to the SAME shared RustFS'}
              </div>
              {stepBResult ? (
                <div className="space-y-1">
                  <span
                    className={`inline-flex items-center gap-1.5 font-medium ${
                      stepBResult.ok ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {stepBResult.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    HTTP {stepBResult.status || 'ERR'} — {stepBResult.message}
                  </span>
                  {stepBResult.content && (
                    <div className="font-mono text-[11px] text-emerald-200 bg-slate-950 rounded px-2 py-1">
                      {stepBResult.content}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-slate-500">
                  {mode === 'local'
                    ? 'Empty — does not share Server A\'s local disk'
                    : 'Ready to read from the shared RustFS bucket'}
                </span>
              )}
            </div>
          </div>
        </div>

        {mode === 'object' && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Box className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-amber-200">
                  Shared RustFS Object Storage Bucket (:9000)
                </div>
                <div className="text-xs text-slate-300">
                  Both Server A and Server B connect to this single bucket over HTTP.
                </div>
              </div>
            </div>
            {stepAResult?.ok && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1 font-mono text-xs text-amber-300">
                {DEMO_FILE_PATH}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3 Everyday Pain Points */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1.5">
          <Users className="h-5 w-5 text-amber-400" />
          <h4 className="font-semibold text-white text-sm">1. Hard to Scale Servers</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Containers restart and scale up/down all the time. Keeping user uploads inside one
            server&apos;s folder causes broken links and 404s.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1.5">
          <Tags className="h-5 w-5 text-amber-400" />
          <h4 className="font-semibold text-white text-sm">2. No Custom Labels</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Folders only remember a filename and date. Want to tag an author or team? You have to
            cram it into the filename or build an extra database table.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-1.5">
          <Gauge className="h-5 w-5 text-amber-400" />
          <h4 className="font-semibold text-white text-sm">3. Heavy Load on Your API</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every large image or video download has to pass through your NestJS server instead of
            being delivered directly from storage.
          </p>
        </div>
      </div>

      {/* Brief, plain-English mention of Block Storage */}
      <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/15 p-4 flex items-start gap-3">
        <HardDrive className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          <strong className="text-indigo-200">Quick note — what about Block Storage?</strong> Think
          of Block Storage like a raw, blank hard drive attached to one machine. It&apos;s super
          fast for <em>databases</em> (like PostgreSQL or MySQL), but it doesn&apos;t even know what
          a filename or URL is. For sharing user uploads &amp; media across servers, we want{' '}
          <strong className="text-amber-300">Object Storage (RustFS)</strong>!
        </p>
      </div>
    </div>
  );
};
