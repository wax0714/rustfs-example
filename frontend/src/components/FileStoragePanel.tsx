import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  Folder,
  FileText,
  FolderPlus,
  FilePlus,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
} from 'lucide-react';
import { api } from '../api/client';
import { FileReadResult, FileTreeNode } from '../types/storage';

interface Props {
  onActivity?: () => void;
}

export const FileStoragePanel: React.FC<Props> = ({ onActivity }) => {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [rootDir, setRootDir] = useState('');
  const [selected, setSelected] = useState<FileReadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newDirPath, setNewDirPath] = useState('projects/2026');
  const [newFilePath, setNewFilePath] = useState('projects/2026/notes.txt');
  const [newFileContent, setNewFileContent] = useState('Initial POSIX file content.\n');

  const [appendLine, setAppendLine] = useState('[LOG] Appended line via POSIX O_APPEND');
  const [patchOffset, setPatchOffset] = useState(0);
  const [patchText, setPatchText] = useState('INPLACE');
  const [renameTarget, setRenameTarget] = useState('');

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFileTree();
      setRootDir(res.rootDir);
      setTree(res.tree);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const openFile = async (filePath: string) => {
    setError(null);
    try {
      const res = await api.readFile(filePath);
      setSelected(res);
      setRenameTarget(res.path);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMkdir = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.mkdir(newDirPath);
      setNotice(`Created directory /${res.path} (inode #${res.inode}, mode ${res.mode})`);
      await loadTree();
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleWriteFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.writeFile(newFilePath, newFileContent);
      setNotice(`Wrote /${res.path} (${res.size} B, inode #${res.inode}) in ${res.durationMs} ms`);
      await loadTree();
      await openFile(res.path);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAppend = async () => {
    if (!selected) return;
    setError(null);
    try {
      const res = await api.appendFile(selected.path, appendLine);
      setNotice(
        `Appended ${res.appendedBytes} B (inode #${res.inodeAfter} preserved: ${res.inodePreserved}) in ${res.durationMs} ms`,
      );
      await loadTree();
      await openFile(selected.path);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePatch = async () => {
    if (!selected) return;
    setError(null);
    try {
      const res = await api.patchFile(selected.path, patchOffset, patchText);
      setNotice(`${res.note} (${res.durationMs} ms)`);
      await loadTree();
      await openFile(selected.path);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRename = async () => {
    if (!selected || !renameTarget.trim() || renameTarget === selected.path) return;
    setError(null);
    try {
      const res = await api.renameFile(selected.path, renameTarget.trim());
      setNotice(
        `Moved /${res.from} → /${res.to} | Zero-copy move (same inode #${res.inodeAfter}): ${res.zeroCopyMove} (${res.durationMs} ms)`,
      );
      await loadTree();
      await openFile(res.to);
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (targetPath: string) => {
    setError(null);
    try {
      await api.deleteFile(targetPath);
      if (selected?.path === targetPath) setSelected(null);
      await loadTree();
      onActivity?.();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const renderTree = (nodes: FileTreeNode[], depth = 0) =>
    nodes.map((node) => (
      <div key={node.path}>
        <div
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => node.type === 'file' && openFile(node.path)}
          className={`flex items-center justify-between gap-2 py-1.5 pr-2 rounded text-xs transition ${
            node.type === 'file' ? 'cursor-pointer' : ''
          } ${
            selected?.path === node.path
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'hover:bg-slate-800/60 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {node.type === 'directory' ? (
              <Folder className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            )}
            <span className="truncate font-mono">{node.name}</span>
            <span className="text-[10px] text-slate-500">
              {node.type === 'file' ? `${node.size} B · ino:${node.inode}` : `ino:${node.inode}`}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(node.path);
            }}
            className="rounded p-1 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {node.children && node.children.length > 0 && renderTree(node.children, depth + 1)}
      </div>
    ));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 flex items-start gap-3">
        <FolderTree className="mt-0.5 h-5 w-5 text-emerald-400 shrink-0" />
        <div>
          <h2 className="font-semibold text-emerald-200">
            File Storage — POSIX Hierarchical Filesystem (<code className="text-emerald-400">{rootDir || '/storage/file'}</code>)
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Real directories, OS inodes, permissions, in-place <code>O_APPEND</code> /{' '}
            <code>pwrite()</code> updates, and zero-copy atomic <code>rename()</code>. Fixed OS
            metadata only — no native HTTP presigned URLs.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200">
          {notice}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Directory Hierarchy</h3>
              <button
                onClick={loadTree}
                className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/60 p-1.5">
              {tree.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">Empty directory.</p>
              ) : (
                renderTree(tree)
              )}
            </div>
          </div>

          <form
            onSubmit={handleMkdir}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Create Directory (mkdir -p)
            </h3>
            <div className="flex gap-2">
              <input
                value={newDirPath}
                onChange={(e) => setNewDirPath(e.target.value)}
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                <FolderPlus className="h-3.5 w-3.5" /> mkdir
              </button>
            </div>
          </form>

          <form
            onSubmit={handleWriteFile}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Create / Write File
            </h3>
            <input
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="path/to/file.txt"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
            />
            <textarea
              rows={2}
              value={newFileContent}
              onChange={(e) => setNewFileContent(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-white"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              <FilePlus className="h-3.5 w-3.5" /> Write File
            </button>
          </form>
        </div>

        <div className="lg:col-span-7">
          {selected ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div>
                <div className="font-mono text-sm font-semibold text-emerald-300">
                  /{selected.path}
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded bg-slate-950 p-2">
                    <div className="text-[10px] text-slate-500">INODE</div>
                    <div className="font-mono text-emerald-300">{selected.posixMetadata.inode}</div>
                  </div>
                  <div className="rounded bg-slate-950 p-2">
                    <div className="text-[10px] text-slate-500">PERMISSIONS</div>
                    <div className="font-mono text-slate-200">{selected.posixMetadata.mode}</div>
                  </div>
                  <div className="rounded bg-slate-950 p-2">
                    <div className="text-[10px] text-slate-500">SIZE</div>
                    <div className="font-mono text-slate-200">{selected.size} B</div>
                  </div>
                  <div className="rounded bg-slate-950 p-2">
                    <div className="text-[10px] text-slate-500">UID / GID</div>
                    <div className="font-mono text-slate-200">
                      {selected.posixMetadata.uid}:{selected.posixMetadata.gid}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  File Contents
                </h4>
                <pre className="max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                  {selected.content}
                </pre>
              </div>

              {/* POSIX Capabilities */}
              <div className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-950/10 p-3.5">
                <div className="text-xs font-semibold text-emerald-300">
                  POSIX In-Place &amp; Zero-Copy Operations
                </div>

                <div className="flex gap-2">
                  <input
                    value={appendLine}
                    onChange={(e) => setAppendLine(e.target.value)}
                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-white"
                  />
                  <button
                    onClick={handleAppend}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    Append Line
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
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
                  />
                  <button
                    onClick={handlePatch}
                    className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    In-Place pwrite()
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    value={renameTarget}
                    onChange={(e) => setRenameTarget(e.target.value)}
                    className="flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-white"
                    placeholder="new/folder/filename.txt"
                  />
                  <button
                    onClick={handleRename}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Atomic Rename
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-sm text-slate-500">
              Select a file from the directory tree to inspect its POSIX inode and run in-place
              mutations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
