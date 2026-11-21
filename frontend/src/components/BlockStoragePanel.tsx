import React, { useEffect, useState } from 'react';
import { HardDrive, RefreshCw, Eraser, Trash2, Layers } from 'lucide-react';
import { api } from '../api/client';
import { BlockDetail, BlockDiskInfo } from '../types/storage';

interface Props {
  onActivity?: () => void;
}

export const BlockStoragePanel: React.FC<Props> = ({ onActivity }) => {
  const [diskInfo, setDiskInfo] = useState<BlockDiskInfo | null>(null);
  const [selectedLba, setSelectedLba] = useState<number>(0);
  const [blockDetail, setBlockDetail] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Single block write / sub-block patch
  const [writeData, setWriteData] = useState('DB_PAGE_HEADER:tx=9042');
  const [offsetInBlock, setOffsetInBlock] = useState(0);
  const [overwriteBlock, setOverwriteBlock] = useState(false);

  // Multi-block write
  const [multiStartLba, setMultiStartLba] = useState(4);
  const [multiSizeKb, setMultiSizeKb] = useState(10);

  const loadDisk = async (lbaToInspect = selectedLba) => {
    setLoading(true);
    setError(null);
    try {
      const info = await api.getBlockDiskInfo();
      setDiskInfo(info);
      const detail = await api.readBlock(lbaToInspect, 0, 256);
      setBlockDetail(detail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisk(0);
  }, []);

  const selectBlock = async (lba: number) => {
    setSelectedLba(lba);
    setError(null);
    try {
      const detail = await api.readBlock(lba, 0, 256);
      setBlockDetail(detail);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleWriteBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.writeBlock(selectedLba, writeData, offsetInBlock, overwriteBlock);
      setNotice(`${res.note} (${res.durationMs} ms)`);
      await loadDisk(selectedLba);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMultiWrite = async () => {
    setError(null);
    try {
      const totalBytes = multiSizeKb * 1024;
      const chunk = `[MULTI-BLOCK-PAYLOAD LBA:${multiStartLba} SIZE:${totalBytes}B] `;
      const payload = chunk.repeat(Math.ceil(totalBytes / chunk.length)).slice(0, totalBytes);
      const res = await api.writeMultiBlock(multiStartLba, payload);
      setNotice(`${res.note} (Slack space: ${res.slackSpaceBytes} B, ${res.durationMs} ms)`);
      setSelectedLba(multiStartLba);
      await loadDisk(multiStartLba);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEraseBlock = async () => {
    setError(null);
    try {
      const res = await api.eraseBlock(selectedLba);
      setNotice(`Zeroed (TRIMmed) LBA ${res.erasedLba} (${res.zeroedBytes} B) in ${res.durationMs} ms`);
      await loadDisk(selectedLba);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFormatDisk = async () => {
    setError(null);
    try {
      const res = await api.formatDisk();
      setNotice(`Formatted virtual block device (${res.zeroedBytes.toLocaleString()} B zeroed)`);
      await loadDisk(0);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-4">
        <div className="flex items-start gap-3">
          <HardDrive className="mt-0.5 h-5 w-5 text-indigo-400 shrink-0" />
          <div>
            <h2 className="font-semibold text-indigo-200">
              Block Storage — Raw 4 KB Virtual Disk ({diskInfo ? `${diskInfo.blockCount} sectors × ${diskInfo.blockSize} B = ${(diskInfo.totalBytes / 1024).toFixed(0)} KB` : 'Loading...'})
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Zero filenames, zero directories, zero custom metadata. Data is addressed purely by{' '}
              <strong>Logical Block Address (LBA)</strong> and exact byte offset — ideal for
              databases and VM disks.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDisk(selectedLba)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleFormatDisk}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/60"
          >
            <Trash2 className="h-3.5 w-3.5" /> Zero-Fill Disk
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-indigo-500/40 bg-indigo-950/30 px-4 py-2.5 text-xs text-indigo-200">
          {notice}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Sector Map + Multi-block writer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">LBA Sector Map (Click a 4 KB Block)</span>
              {diskInfo && (
                <span className="text-slate-400">
                  <strong className="text-indigo-300">{diskInfo.allocatedBlocks}</strong> /{' '}
                  {diskInfo.blockCount} used
                </span>
              )}
            </div>

            <div className="grid grid-cols-8 gap-1.5">
              {diskInfo?.blocks.map((blk) => {
                const isSelected = blk.lba === selectedLba;
                return (
                  <button
                    key={blk.lba}
                    onClick={() => selectBlock(blk.lba)}
                    title={`LBA ${blk.lba} (${blk.nonZeroBytes}/${diskInfo.blockSize} B non-zero)`}
                    className={`rounded py-2 font-mono text-[11px] font-medium transition border ${
                      isSelected
                        ? 'border-white bg-indigo-500 text-white shadow'
                        : blk.allocated
                        ? 'border-indigo-500/50 bg-indigo-500/25 text-indigo-200 hover:bg-indigo-500/40'
                        : 'border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    {blk.lba}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-indigo-500/40 border border-indigo-500/60" />
                Contains Data
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-slate-950 border border-slate-700" />
                Empty (Zeroed)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-indigo-500 border border-white" />
                Selected
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Layers className="h-4 w-4 text-indigo-400" />
              Multi-Block Split Demo (See Fixed-Size Chunking &amp; Slack Space)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-400">
                Start LBA
                <input
                  type="number"
                  min={0}
                  max={55}
                  value={multiStartLba}
                  onChange={(e) => setMultiStartLba(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                Payload Size (KB)
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={multiSizeKb}
                  onChange={(e) => setMultiSizeKb(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                />
              </label>
            </div>
            <button
              onClick={handleMultiWrite}
              className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-400"
            >
              Write {multiSizeKb} KB Starting at LBA {multiStartLba}
            </button>
          </div>
        </div>

        {/* Right: Sector Inspector & Hex Dump */}
        <div className="lg:col-span-7 space-y-4">
          {blockDetail && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-semibold text-indigo-300">
                    LBA #{blockDetail.lba} · Bytes {blockDetail.byteStart.toLocaleString()} –{' '}
                    {blockDetail.byteEnd.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Non-zero bytes: <strong className="text-slate-200">{blockDetail.nonZeroBytes}</strong> /{' '}
                    {blockDetail.blockSize} B · Slack/Zero bytes:{' '}
                    <strong className="text-slate-200">{blockDetail.slackSpaceBytes}</strong> B
                  </div>
                </div>
                <button
                  onClick={handleEraseBlock}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                >
                  <Eraser className="h-3.5 w-3.5 text-indigo-400" /> TRIM / Zero LBA {blockDetail.lba}
                </button>
              </div>

              <form
                onSubmit={handleWriteBlock}
                className="rounded-lg border border-indigo-500/30 bg-indigo-950/15 p-3.5 space-y-2.5"
              >
                <div className="text-xs font-semibold text-indigo-300">
                  Direct Positional Write to LBA #{blockDetail.lba}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-[11px] text-slate-400">
                    Offset inside 4 KB sector
                    <input
                      type="number"
                      min={0}
                      max={4000}
                      value={offsetInBlock}
                      onChange={(e) => setOffsetInBlock(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-white"
                    />
                  </label>
                  <label className="sm:col-span-2 text-[11px] text-slate-400">
                    Raw Bytes (UTF-8)
                    <input
                      value={writeData}
                      onChange={(e) => setWriteData(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-white"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={overwriteBlock}
                      onChange={(e) => setOverwriteBlock(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950"
                    />
                    Zero-fill rest of 4 KB sector (uncheck for surgical sub-block patch)
                  </label>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
                  >
                    Write Raw Bytes
                  </button>
                </div>
              </form>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Raw Sector Hex + ASCII Dump (First 256 Bytes of LBA #{blockDetail.lba})
                </h4>
                <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-indigo-200">
                  {blockDetail.hexDump.join('\n')}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
