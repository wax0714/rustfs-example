import React, { useRef, useState } from 'react';
import {
  Music,
  FastForward,
  RefreshCw,
  Folder,
  HardDrive,
  Box,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { api } from '../../api/client';
import { CodeCard } from '../CodeCard';

const STREAMING_CODE = `// object-storage.controller.ts → stream()
@Get('stream')
async stream(@Query('key') key: string, @Req() req: Request, @Res() res: Response) {
  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
  const result = await this.objectService.streamObject(key, rangeHeader);

  res.status(result.statusCode); // 206 Partial Content when seeking!
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Accept-Ranges', result.acceptRanges);
  if (result.contentRange) res.setHeader('Content-Range', result.contentRange);

  result.stream.pipe(res); // Stream bytes straight from RustFS to the browser
}`;

export const Step5StreamingAndWrapUp: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [mediaSize, setMediaSize] = useState<number>(0);
  const [audioNonce, setAudioNonce] = useState<number>(0);
  const [creatingAudio, setCreatingAudio] = useState(false);
  const [jumpResult, setJumpResult] = useState<{
    downloadedKb: string;
    totalMb: string;
    skippedPct: string;
  } | null>(null);

  const [editResult, setEditResult] = useState<any>(null);
  const [runningEdit, setRunningEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAudio = async () => {
    setCreatingAudio(true);
    setError(null);
    setJumpResult(null);
    try {
      const res = await api.seedStreamMedia();
      setMediaKey(res.key);
      setMediaSize(res.size);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingAudio(false);
    }
  };

  const handleJumpMiddle = async () => {
    if (!mediaKey || !mediaSize) return;
    setError(null);
    try {
      const mid = Math.floor(mediaSize / 2);
      const end = Math.min(mediaSize - 1, mid + 65535);
      const res = await fetch(api.getObjectStreamUrl(mediaKey), {
        headers: { Range: `bytes=${mid}-${end}` },
      });
      if (!res.ok && res.status !== 206) {
        let msg = `Streaming failed (${res.status})`;
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      const buf = await res.arrayBuffer();
      const skipped = (((mediaSize - buf.byteLength) / mediaSize) * 100).toFixed(1);
      setJumpResult({
        downloadedKb: (buf.byteLength / 1024).toFixed(0),
        totalMb: (mediaSize / (1024 * 1024)).toFixed(2),
        skippedPct: skipped,
      });

      // Seek the actual HTML5 audio player to the middle (50%) and play it
      const audio = audioRef.current;
      if (audio) {
        const seekAndPlay = () => {
          const targetTime = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration / 2 : 7.5;
          audio.currentTime = targetTime;
          audio.play().catch(() => {
            // Ignore autoplay restriction if triggered without user gesture
          });
        };

        if (audio.error || audio.readyState < 1) {
          audio.addEventListener('loadedmetadata', seekAndPlay, { once: true });
          audio.load();
        } else {
          seekAndPlay();
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCompareEdit = async () => {
    setRunningEdit(true);
    setError(null);
    try {
      const res = await api.runPatchBytesExperiment(500, 'UPDATED_WORD!!!!', 'walkthrough');
      setEditResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningEdit(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          Step 5 of 5 · Code-Along #3 &amp; Summary
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Superpower #2: Media Streaming — And One Honest Trade-Off
        </h2>
        <p className="max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
          Object storage can stream large audio and video smoothly — even jumping right to the
          middle without downloading the beginning. Let&apos;s also look at the one thing File
          Storage still does better.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Part A: Media Streaming */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Try It: Stream Audio Directly From RustFS
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Create a 15-second audio track, hit play, and scrub the timeline anywhere.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateAudio}
            disabled={creatingAudio}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
          >
            <Music className="h-4 w-4" />
            {creatingAudio ? 'Creating Audio...' : 'Create Sample Audio (2.6 MB)'}
          </button>
        </div>

        <CodeCard
          title="Edit: backend/src/storage/object/object-storage.controller.ts → stream()"
          badge="Code-Along #3"
          badgeColor="amber"
          code={STREAMING_CODE}
        />

        {mediaKey && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-950/15 p-4 space-y-3">
            <audio
              ref={audioRef}
              key={`${mediaKey}-${audioNonce}`}
              controls
              preload="metadata"
              src={`${api.getObjectStreamUrl(mediaKey)}&v=${audioNonce}`}
              className="w-full h-10"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleJumpMiddle}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition"
                >
                  <FastForward className="h-3.5 w-3.5" /> Jump to Middle (Read Only 64 KB)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAudioNonce((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Reload Player
                </button>
              </div>
              {jumpResult && (
                <span className="inline-flex items-center gap-1.5 text-xs text-sky-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  Downloaded only <strong>{jumpResult.downloadedKb} KB</strong> out of{' '}
                  <strong>{jumpResult.totalMb} MB</strong> — skipped{' '}
                  <strong className="text-emerald-300">{jumpResult.skippedPct}%</strong> of the file!
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Part B: The Honest Trade-Off */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              The One Trade-Off: Editing Inside a File
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              What happens if we want to change just <strong>1 word</strong> inside a 32 KB file?
            </p>
          </div>
          <button
            type="button"
            onClick={handleCompareEdit}
            disabled={runningEdit}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${runningEdit ? 'animate-spin' : ''}`} />
            {runningEdit ? 'Testing...' : 'Test Editing 1 Word'}
          </button>
        </div>

        {editResult && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-1.5">
              <div className="text-sm font-semibold text-emerald-300">File Storage (Local Folder)</div>
              <div className="text-lg font-bold text-white">
                Changed only {editResult.file.bytesIoTotal} bytes
              </div>
              <p className="text-xs text-slate-300">
                Opens the file and updates just that single word right in place — super lightweight!
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-1.5">
              <div className="text-sm font-semibold text-amber-300">Object Storage (RustFS)</div>
              <div className="text-lg font-bold text-white">
                Transferred {(editResult.object.bytesIoTotal / 1024).toFixed(0)} KB total
              </div>
              <p className="text-xs text-slate-300">
                Objects can&apos;t be edited in the middle — RustFS has to replace the entire file
                with a new copy.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Simple Cheat Sheet */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Info className="h-4 w-4 text-sky-400" />
          Simple Rule of Thumb: When to Use Which?
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-1.5">
            <div className="inline-flex items-center gap-2 font-semibold text-emerald-300 text-sm">
              <Folder className="h-4 w-4" /> File Storage
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Best for <strong>configs, log files, and shared folders</strong> where you frequently
              append or edit files in place.
            </p>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-4 space-y-1.5">
            <div className="inline-flex items-center gap-2 font-semibold text-indigo-300 text-sm">
              <HardDrive className="h-4 w-4" /> Block Storage
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Best for <strong>databases (PostgreSQL, MySQL) and VMs</strong> that need a fast, raw
              hard drive underneath.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4 space-y-1.5">
            <div className="inline-flex items-center gap-2 font-semibold text-amber-300 text-sm">
              <Box className="h-4 w-4" /> Object Storage (RustFS)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Best for <strong>user uploads, photos, videos, backups, and multi-server apps</strong>{' '}
              that need tags, direct links, and streaming.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
