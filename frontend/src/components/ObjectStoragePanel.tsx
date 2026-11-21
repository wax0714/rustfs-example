import React, { useEffect, useState } from 'react';
import {
  Box,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Tag,
  AlertTriangle,
  Radio,
  Music,
  Scissors,
} from 'lucide-react';
import { api } from '../api/client';
import { ObjectDetail, ObjectItemSummary } from '../types/storage';

interface StreamProgress {
  running: boolean;
  status: number | null;
  chunks: number;
  bytesLoaded: number;
  totalBytes: number;
  ttfbMs: number | null;
  totalMs: number | null;
  throughputMbPerSec: number | null;
}

interface RangeFetchResult {
  status: number;
  statusText: string;
  contentRange: string | null;
  acceptRanges: string | null;
  bytesDownloaded: number;
  totalObjectBytes: number;
  skippedPercent: string;
  durationMs: number;
  hexPreview: string;
}

interface Props {
  consoleUrl?: string;
  onActivity?: () => void;
}

export const ObjectStoragePanel: React.FC<Props> = ({ consoleUrl, onActivity }) => {
  const [objects, setObjects] = useState<ObjectItemSummary[]>([]);
  const [bucket, setBucket] = useState('storage-demo');
  const [prefix, setPrefix] = useState('');
  const [selected, setSelected] = useState<ObjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [seedingMedia, setSeedingMedia] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create text object form
  const [newKey, setNewKey] = useState('invoices/2026/inv-001.txt');
  const [newContent, setNewContent] = useState(
    'Invoice #001\nStored in RustFS Object Storage with custom metadata!',
  );
  const [metaAuthor, setMetaAuthor] = useState('finance-bot');
  const [metaTag, setMetaTag] = useState('q4-2026');

  // Patch demonstration
  const [patchOffset, setPatchOffset] = useState(0);
  const [patchText, setPatchText] = useState('REWRITTEN');
  const [lastPatchNote, setLastPatchNote] = useState<string | null>(null);

  // Streaming & HTTP Range demonstration
  const [mediaSourceMode, setMediaSourceMode] = useState<'proxy' | 'direct'>('proxy');
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(65535);
  const [rangeResult, setRangeResult] = useState<RangeFetchResult | null>(null);
  const [streamProgress, setStreamProgress] = useState<StreamProgress>({
    running: false,
    status: null,
    chunks: 0,
    bytesLoaded: 0,
    totalBytes: 0,
    ttfbMs: null,
    totalMs: null,
    throughputMbPerSec: null,
  });

  const loadList = async (p = prefix) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listObjects(p);
      setBucket(res.bucket);
      setObjects(res.objects);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const openObject = async (key: string) => {
    setError(null);
    setLastPatchNote(null);
    setRangeResult(null);
    setStreamProgress({
      running: false,
      status: null,
      chunks: 0,
      bytesLoaded: 0,
      totalBytes: 0,
      ttfbMs: null,
      totalMs: null,
      throughputMbPerSec: null,
    });
    try {
      const detail = await api.getObject(key);
      setSelected(detail);
      // Pre-fill a sensible mid-object byte range to demonstrate HTTP 206 seeking
      const midStart = detail.size > 131072 ? Math.floor(detail.size / 2) : 0;
      const windowSize = detail.size > 131072 ? 65535 : Math.max(0, Math.min(detail.size - 1, 63));
      setRangeStart(midStart);
      setRangeEnd(Math.min(Math.max(0, detail.size - 1), midStart + windowSize));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSeedStreamMedia = async () => {
    setError(null);
    setMessage(null);
    setSeedingMedia(true);
    try {
      const res = await api.seedStreamMedia();
      setMessage(
        `Generated 15s streamable audio "${res.key}" (${(res.size / (1024 * 1024)).toFixed(2)} MB) in RustFS! Press Play and drag the seek bar to trigger HTTP 206 Range streaming.`,
      );
      await loadList();
      await openObject(res.key);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSeedingMedia(false);
    }
  };

  const handleFetchByteRange = async () => {
    if (!selected) return;
    setError(null);
    const start = performance.now();
    try {
      const url = api.getObjectStreamUrl(selected.key);
      const res = await fetch(url, {
        headers: {
          Range: `bytes=${rangeStart}-${rangeEnd}`,
        },
      });
      if (!res.ok && res.status !== 206) {
        throw new Error(`Range request failed (${res.status} ${res.statusText})`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const durationMs = Number((performance.now() - start).toFixed(2));
      const previewBytes = buf.slice(0, 24);
      const hexPreview = Array.from(previewBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const skippedPct =
        selected.size > 0
          ? Math.max(0, ((selected.size - buf.byteLength) / selected.size) * 100).toFixed(1)
          : '0.0';

      setRangeResult({
        status: res.status,
        statusText: res.statusText || (res.status === 206 ? 'Partial Content' : 'OK'),
        contentRange: res.headers.get('Content-Range'),
        acceptRanges: res.headers.get('Accept-Ranges'),
        bytesDownloaded: buf.byteLength,
        totalObjectBytes: selected.size,
        skippedPercent: skippedPct,
        durationMs,
        hexPreview,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStreamFullObject = async () => {
    if (!selected) return;
    setError(null);
    const start = performance.now();
    setStreamProgress({
      running: true,
      status: null,
      chunks: 0,
      bytesLoaded: 0,
      totalBytes: selected.size,
      ttfbMs: null,
      totalMs: null,
      throughputMbPerSec: null,
    });

    try {
      const res = await fetch(api.getObjectStreamUrl(selected.key));
      if (!res.ok || !res.body) {
        throw new Error(`Stream request failed (${res.status})`);
      }
      const totalBytes = Number(res.headers.get('Content-Length')) || selected.size;
      const reader = res.body.getReader();
      let chunks = 0;
      let bytesLoaded = 0;
      let ttfbMs: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ttfbMs === null) {
          ttfbMs = Number((performance.now() - start).toFixed(2));
        }
        chunks++;
        bytesLoaded += value.byteLength;
        setStreamProgress((prev) => ({
          ...prev,
          status: res.status,
          chunks,
          bytesLoaded,
          totalBytes,
          ttfbMs,
        }));
      }

      const totalMs = Math.max(0.1, performance.now() - start);
      const mbPerSec = bytesLoaded / (1024 * 1024) / (totalMs / 1000);
      setStreamProgress({
        running: false,
        status: res.status,
        chunks,
        bytesLoaded,
        totalBytes,
        ttfbMs,
        totalMs: Number(totalMs.toFixed(2)),
        throughputMbPerSec: Number(mbPerSec.toFixed(2)),
      });
    } catch (err: any) {
      setStreamProgress((prev) => ({ ...prev, running: false }));
      setError(err.message);
    }
  };

  const handlePutText = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await api.putObjectText(newKey, newContent, {
        author: metaAuthor,
        category: metaTag,
      });
      setMessage(`Uploaded s3://${res.bucket}/${res.key} (${res.size} B) in ${res.durationMs} ms`);
      await loadList();
      await openObject(res.key);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      const res = await api.uploadObjectFile(file, `uploads/${file.name}`, {
        uploadedvia: 'web-ui',
        originalname: file.name,
      });
      setMessage(`Uploaded binary/file object ${res.key} (${res.size} B) in ${res.durationMs} ms`);
      await loadList();
      await openObject(res.key);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const handlePatch = async () => {
    if (!selected) return;
    setError(null);
    try {
      const res = await api.patchObject(selected.key, patchOffset, patchText);
      setLastPatchNote(
        `${res.note} (ETag changed: ${res.oldEtag.slice(0, 8)}… → ${res.newEtag.slice(0, 8)}…, ${res.durationMs} ms)`,
      );
      await loadList();
      await openObject(selected.key);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (key: string) => {
    setError(null);
    try {
      await api.deleteObject(key);
      if (selected?.key === key) setSelected(null);
      await loadList();
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/15 p-4">
        <div className="flex items-start gap-3">
          <Box className="mt-0.5 h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <h2 className="font-semibold text-amber-200">
              Object Storage — RustFS (Bucket: <code className="text-amber-400">{bucket}</code>)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Flat key-value namespace accessed via S3 HTTP API. Supports arbitrary{' '}
              <code>x-amz-meta-*</code> metadata and Presigned URLs, but objects are immutable (any
              edit replaces the full object).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSeedStreamMedia}
            disabled={seedingMedia}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
          >
            <Music className="h-3.5 w-3.5" />
            {seedingMedia ? 'Generating...' : 'Generate 2.6 MB Streamable Audio'}
          </button>
          {consoleUrl && (
            <a
              href={consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open RustFS Console
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-2.5 text-xs text-amber-200">
          {message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Create & List */}
        <div className="lg:col-span-5 space-y-5">
          <form
            onSubmit={handlePutText}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Put Object (HTTP PUT)</h3>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700">
                <Upload className="h-3.5 w-3.5 text-amber-400" />
                Upload File
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Flat Object Key (slashes are just prefix characters, not folders)
              </label>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Object Body</label>
              <textarea
                rows={3}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  x-amz-meta-author
                </label>
                <input
                  value={metaAuthor}
                  onChange={(e) => setMetaAuthor(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  x-amz-meta-category
                </label>
                <input
                  value={metaTag}
                  onChange={(e) => setMetaTag(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" /> Store Object in RustFS
            </button>
          </form>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Flat Key Index ({objects.length})</h3>
              <button
                onClick={() => loadList()}
                className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Filter by key prefix (e.g. invoices/)"
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white"
              />
              <button
                onClick={() => loadList(prefix)}
                className="rounded-md bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                Filter
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/80">
              {objects.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">No objects matching prefix.</p>
              ) : (
                objects.map((obj) => (
                  <div
                    key={obj.key}
                    onClick={() => openObject(obj.key)}
                    className={`flex items-center justify-between gap-2 py-2.5 px-2 rounded cursor-pointer transition ${
                      selected?.key === obj.key ? 'bg-amber-500/15' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-amber-200">{obj.key}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span>{obj.size.toLocaleString()} B</span>
                        <span>ETag: {obj.etag.slice(0, 8)}</span>
                        {Object.keys(obj.metadata).length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-400">
                            <Tag className="h-3 w-3" /> {Object.keys(obj.metadata).length} meta
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(obj.key);
                      }}
                      className="rounded p-1 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                      title="Delete object"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Inspector */}
        <div className="lg:col-span-7">
          {selected ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-semibold text-amber-300 break-all">
                    s3://{selected.bucket}/{selected.key}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>Size: {selected.size.toLocaleString()} B</span>
                    <span>Type: {selected.contentType}</span>
                    <span>ETag: {selected.etag}</span>
                    <span>Fetched in {selected.durationMs} ms</span>
                  </div>
                </div>
                <a
                  href={selected.presignedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Presigned URL
                </a>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Custom S3 Metadata (x-amz-meta-*)
                </h4>
                {Object.keys(selected.metadata).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selected.metadata).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-md border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 font-mono text-xs text-amber-200"
                      >
                        {k} = {v}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">No custom metadata attached.</span>
                )}
              </div>

              {/* Live Streaming & HTTP 206 Byte-Range Demo */}
              <div className="rounded-lg border border-sky-500/30 bg-sky-950/15 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                    <Radio className="h-4 w-4" />
                    Object Streaming &amp; HTTP Range (206 Partial Content)
                  </div>
                  {(selected.contentType.startsWith('audio/') ||
                    selected.contentType.startsWith('video/')) && (
                    <div className="inline-flex rounded-md border border-slate-700 bg-slate-950 p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setMediaSourceMode('proxy')}
                        className={`rounded px-2 py-0.5 ${
                          mediaSourceMode === 'proxy'
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        NestJS Pipe
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaSourceMode('direct')}
                        className={`rounded px-2 py-0.5 ${
                          mediaSourceMode === 'direct'
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Direct RustFS URL
                      </button>
                    </div>
                  )}
                </div>

                {selected.contentType.startsWith('audio/') && (
                  <div className="space-y-1.5">
                    <audio
                      key={`${selected.key}-${mediaSourceMode}`}
                      controls
                      preload="metadata"
                      src={
                        mediaSourceMode === 'proxy'
                          ? api.getObjectStreamUrl(selected.key)
                          : selected.presignedUrl
                      }
                      className="w-full h-10"
                    />
                    <p className="text-[11px] text-slate-400">
                      {mediaSourceMode === 'proxy'
                        ? 'Streaming via GET /api/storage/object/stream (zero-buffer S3 Readable -> HTTP pipe with HTTP 206 Range seeking).'
                        : 'Streaming directly from RustFS via Presigned URL — zero bytes flow through the NestJS backend!'}
                    </p>
                  </div>
                )}

                {selected.contentType.startsWith('video/') && (
                  <div className="space-y-1.5">
                    <video
                      key={`${selected.key}-${mediaSourceMode}`}
                      controls
                      preload="metadata"
                      src={
                        mediaSourceMode === 'proxy'
                          ? api.getObjectStreamUrl(selected.key)
                          : selected.presignedUrl
                      }
                      className="w-full max-h-64 rounded-md bg-black"
                    />
                    <p className="text-[11px] text-slate-400">
                      Drag the scrubber bar to jump anywhere — RustFS serves only the requested byte
                      range (HTTP 206).
                    </p>
                  </div>
                )}

                {/* Interactive Byte-Range Seek */}
                <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                      <Scissors className="h-3 w-3 text-sky-400" />
                      Range: bytes=
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, selected.size - 1)}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(Number(e.target.value))}
                      className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white"
                    />
                    <span className="text-xs text-slate-400">-</span>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, selected.size - 1)}
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(Number(e.target.value))}
                      className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={handleFetchByteRange}
                      className="rounded-md bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400"
                    >
                      Fetch Range (HTTP 206)
                    </button>
                    <button
                      type="button"
                      onClick={handleStreamFullObject}
                      disabled={streamProgress.running}
                      className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
                    >
                      {streamProgress.running ? 'Streaming...' : 'Stream All Chunks'}
                    </button>
                  </div>

                  {rangeResult && (
                    <div className="rounded bg-slate-950/90 p-2.5 font-mono text-[11px] space-y-1 text-sky-200">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          HTTP <strong>{rangeResult.status}</strong> {rangeResult.statusText}
                        </span>
                        <span>
                          Content-Range: <strong>{rangeResult.contentRange || '—'}</strong>
                        </span>
                        <span>{rangeResult.durationMs} ms</span>
                      </div>
                      <div className="text-slate-300">
                        Downloaded <strong>{rangeResult.bytesDownloaded.toLocaleString()} B</strong>{' '}
                        of {rangeResult.totalObjectBytes.toLocaleString()} B (skipped{' '}
                        <strong className="text-emerald-300">{rangeResult.skippedPercent}%</strong>{' '}
                        of the object without transferring it!)
                      </div>
                      <div className="text-slate-400 truncate">
                        First bytes (hex): {rangeResult.hexPreview}
                      </div>
                    </div>
                  )}

                  {(streamProgress.running || streamProgress.chunks > 0) && (
                    <div className="rounded bg-slate-950/90 p-2.5 space-y-1.5 text-[11px]">
                      <div className="flex flex-wrap justify-between gap-2 font-mono text-sky-200">
                        <span>
                          Streamed {streamProgress.bytesLoaded.toLocaleString()} /{' '}
                          {streamProgress.totalBytes.toLocaleString()} B ({streamProgress.chunks}{' '}
                          chunks)
                        </span>
                        <span>
                          TTFB: {streamProgress.ttfbMs ?? '…'} ms
                          {streamProgress.totalMs !== null &&
                            ` · Total: ${streamProgress.totalMs} ms (${streamProgress.throughputMbPerSec} MB/s)`}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full bg-sky-400 transition-all duration-150"
                          style={{
                            width: `${
                              streamProgress.totalBytes > 0
                                ? Math.min(
                                    100,
                                    (streamProgress.bytesLoaded / streamProgress.totalBytes) * 100,
                                  )
                                : 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Object Payload
                </h4>
                <pre className="max-h-60 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                  {selected.content}
                </pre>
              </div>

              {!selected.isBinary && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    Demonstrate Immutability (Patch = Full Download + Full Re-Upload)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={patchOffset}
                      onChange={(e) => setPatchOffset(Number(e.target.value))}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      placeholder="Offset"
                    />
                    <input
                      value={patchText}
                      onChange={(e) => setPatchText(e.target.value)}
                      className="flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-white"
                      placeholder="Replacement text"
                    />
                    <button
                      onClick={handlePatch}
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                    >
                      Patch via Rewrite
                    </button>
                  </div>
                  {lastPatchNote && (
                    <p className="text-xs text-amber-200 bg-slate-950/70 rounded p-2">
                      {lastPatchNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
              Select an object on the left to inspect its S3 metadata, ETag, and Presigned URL.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
