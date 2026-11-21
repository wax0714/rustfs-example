import React, { useEffect, useState } from 'react';
import {
  Folder,
  FileText,
  Upload,
  Plus,
  Trash2,
  Pencil,
  Check,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../api/client';
import { FileTreeNode } from '../../types/storage';
import { CodeCard } from '../CodeCard';

const FILE_STORAGE_CODE = `// backend/src/storage/file/file-storage.service.ts
async writeFile(relativePath: string, content: string | Buffer) {
  const { absPath, relPath } = this.resolveSafePath(relativePath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content ?? '', 'utf-8');
  await fs.writeFile(absPath, buf);
  return { path: relPath, size: buf.byteLength };
}

// backend/src/storage/file/file-storage.controller.ts
@Post('write')
writeFile(@Body() body: { path: string; content: string }) {
  return this.fileService.writeFile(body.path, body.content ?? '');
}`;

function flattenFiles(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const n of nodes) {
    if (n.type === 'file') result.push(n);
    if (n.children) result.push(...flattenFiles(n.children));
  }
  return result;
}

export const Step1FileStorage: React.FC = () => {
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string>('');
  const [fileName, setFileName] = useState('welcome-note.txt');
  const [fileContent, setFileContent] = useState('Hello! This file lives in a folder on our server.');
  const [appendText, setAppendText] = useState('Added another line easily!');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    try {
      const res = await api.getFileTree();
      setFiles(flattenFiles(res.tree));
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const openFile = async (path: string) => {
    setError(null);
    setSelectedPath(path);
    try {
      const res = await api.readFile(path);
      setSelectedContent(res.content);
    } catch {
      setSelectedContent('(Binary file — click "Open File" to view)');
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = fileName.trim().replace(/^\/+/, '');
    const target = clean.includes('/') ? clean : `uploads/${clean}`;
    try {
      await api.writeFile(target, fileContent);
      setStatusMsg(`Saved to folder: ${target}`);
      await loadFiles();
      await openFile(target);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const res = await api.uploadFileToFolder(file, 'uploads');
      setStatusMsg(`Uploaded to folder: ${res.path}`);
      await loadFiles();
      await openFile(res.path);
    } catch (err: any) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const handleAppend = async () => {
    if (!selectedPath || !appendText.trim()) return;
    setError(null);
    try {
      await api.appendFile(selectedPath, appendText);
      setStatusMsg(`Appended a new line directly to ${selectedPath}`);
      await loadFiles();
      await openFile(selectedPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (path: string) => {
    setError(null);
    try {
      await api.deleteFile(path);
      if (selectedPath === path) {
        setSelectedPath(null);
        setSelectedContent('');
      }
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Step 1 of 5 · Starting Simple
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Where Every App Starts: A Local Folder (File Storage)
        </h2>
        <p className="max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
          When we build our first NestJS backend, storing user files is super straightforward — we
          just save them into a folder like <code className="text-emerald-300">uploads/</code> on
          the server, just like folders on your laptop.
        </p>
      </div>

      {/* Code-Along */}
      <CodeCard
        title="backend/src/storage/file/file-storage.service.ts → writeFile()"
        badge="File Storage"
        badgeColor="emerald"
        code={FILE_STORAGE_CODE}
      />

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-sm text-red-200">
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-2.5 text-sm text-emerald-200">
          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          {statusMsg}
        </div>
      )}

      {/* Interactive Demo */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Save form */}
        <form
          onSubmit={handleSaveNote}
          className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Try It: Save a File</h3>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition">
              <Upload className="h-3.5 w-3.5 text-emerald-400" />
              Upload Any File
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">File name</label>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Contents</label>
            <textarea
              rows={3}
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
          >
            <Plus className="h-4 w-4" /> Save to Server Folder
          </button>
        </form>

        {/* Folder Browser */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-white">
              <Folder className="h-4 w-4 text-emerald-400" />
              Server Folder ({files.length} files)
            </h3>
            <span className="text-xs text-slate-400">Click any file to view or edit</span>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/60">
            {files.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                Folder is empty — save a file on the left!
              </p>
            ) : (
              files.map((f) => (
                <div
                  key={f.path}
                  onClick={() => openFile(f.path)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer transition ${
                    selectedPath === f.path ? 'bg-emerald-500/15' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="truncate font-mono text-xs text-slate-200">{f.path}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400">{f.size} B</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(f.path);
                      }}
                      className="rounded p-1 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                      title="Delete file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedPath && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-emerald-300">
                  {selectedPath}
                </span>
                <a
                  href={api.getFileDownloadUrl(selectedPath)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  Open File <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <pre className="max-h-32 overflow-auto rounded bg-slate-900 p-2.5 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                {selectedContent}
              </pre>
              <div className="flex gap-2">
                <input
                  value={appendText}
                  onChange={(e) => setAppendText(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  placeholder="Type a line to add..."
                />
                <button
                  type="button"
                  onClick={handleAppend}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30"
                >
                  <Pencil className="h-3.5 w-3.5" /> Add Line to File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
