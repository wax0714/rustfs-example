import React, { useEffect, useState } from 'react';
import { Box, Upload, Plus, Trash2, Check, ExternalLink } from 'lucide-react';
import { api } from '../../api/client';
import { ObjectDetail, ObjectItemSummary } from '../../types/storage';
import { CodeCard } from '../CodeCard';

const BEFORE_CODE = `// file-storage.service.ts → writeFile()
await fs.mkdir(path.dirname(absPath), { recursive: true });
await fs.writeFile(absPath, buf);`;

const AFTER_CODE = `// object-storage.service.ts → putObject()
const res = await this.s3.send(
  new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }),
);`;

interface Props {
  consoleUrl?: string;
}

export const Step3MigrateToRustfs: React.FC<Props> = ({ consoleUrl }) => {
  const [objects, setObjects] = useState<ObjectItemSummary[]>([]);
  const [selected, setSelected] = useState<ObjectDetail | null>(null);
  const [keyInput, setKeyInput] = useState('notes/first-object.txt');
  const [bodyInput, setBodyInput] = useState(
    'Hello from RustFS! Any server in our cluster can read this object now.',
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadObjects = async () => {
    try {
      const res = await api.listObjects();
      setObjects(res.objects);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadObjects();
  }, []);

  const openObject = async (key: string) => {
    setError(null);
    try {
      const detail = await api.getObject(key);
      setSelected(detail);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.putObjectText(keyInput, bodyInput, {});
      setStatusMsg(`Saved "${res.key}" into the shared RustFS bucket!`);
      await loadObjects();
      await openObject(res.key);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const res = await api.uploadObjectFile(file, `uploads/${file.name}`, {});
      setStatusMsg(`Uploaded "${res.key}" straight to RustFS!`);
      await loadObjects();
      await openObject(res.key);
    } catch (err: any) {
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const handleDelete = async (key: string) => {
    setError(null);
    try {
      await api.deleteObject(key);
      if (selected?.key === key) setSelected(null);
      await loadObjects();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            Step 2 of 5 · Code-Along #1
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Swapping Local Folders for Object Storage (RustFS)
          </h2>
          <p className="max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Migrating is surprisingly small! Instead of writing to disk with{' '}
            <code className="text-emerald-300">fs.writeFile</code>, we send the file to a shared{' '}
            <strong className="text-amber-300">RustFS bucket</strong> using the standard S3 SDK.
            Notice there are no real folders anymore — just a bucket and a unique name (key).
          </p>
        </div>

        {consoleUrl && (
          <a
            href={consoleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition"
          >
            Open RustFS Console <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Before / After Code Diff */}
      <div className="grid gap-4 md:grid-cols-2">
        <CodeCard title="Before — Local Folder" badge="File Storage" badgeColor="emerald" code={BEFORE_CODE} />
        <CodeCard
          title="Edit: backend/src/storage/object/object-storage.service.ts → putObject()"
          badge="Code-Along #1"
          badgeColor="amber"
          code={AFTER_CODE}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-sm text-red-200">
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-2.5 text-sm text-amber-200">
          <Check className="h-4 w-4 shrink-0 text-amber-400" />
          {statusMsg}
        </div>
      )}

      {/* Live Demo */}
      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSave}
          className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Try It: Save to RustFS</h3>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition">
              <Upload className="h-3.5 w-3.5 text-amber-400" />
              Upload Any File
              <input type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Object Name (Key)
            </label>
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Contents</label>
            <textarea
              rows={3}
              value={bodyInput}
              onChange={(e) => setBodyInput(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition"
          >
            <Plus className="h-4 w-4" /> Save to RustFS Bucket
          </button>
        </form>

        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-white">
              <Box className="h-4 w-4 text-amber-400" />
              Inside RustFS Bucket ({objects.length} objects)
            </h3>
            <span className="text-xs text-slate-400">One flat list of keys</span>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/60">
            {objects.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                Bucket is empty — save your first object!
              </p>
            ) : (
              objects.map((obj) => (
                <div
                  key={obj.key}
                  onClick={() => openObject(obj.key)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 cursor-pointer transition ${
                    selected?.key === obj.key ? 'bg-amber-500/15' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <span className="truncate font-mono text-xs text-amber-200">{obj.key}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400">{obj.size.toLocaleString()} B</span>
                    <button
                      type="button"
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
                </div>
              ))
            )}
          </div>

          {selected && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="font-mono text-xs font-medium text-amber-300">{selected.key}</div>
              <pre className="max-h-32 overflow-auto rounded bg-slate-900 p-2.5 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                {selected.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
