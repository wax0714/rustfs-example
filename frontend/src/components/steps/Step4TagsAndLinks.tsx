import React, { useState } from 'react';
import { Tag, Link2, ExternalLink, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { CodeCard } from '../CodeCard';

const TAGS_AND_LINKS_CODE = `// Code-Along #2a — inside putObject():
const res = await this.s3.send(
  new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: cleanMeta, // ← uncomment this line!
  }),
);

// Code-Along #2b — inside createPresignedUrl():
const command = new GetObjectCommand({
  Bucket: this.bucket,
  Key: key,
});
return getSignedUrl(this.presignS3, command, { expiresIn: expiresInSeconds });`;

export const Step4TagsAndLinks: React.FC = () => {
  const [keyName, setKeyName] = useState('reports/q4-summary.txt');
  const [owner, setOwner] = useState('alice');
  const [team, setTeam] = useState('design');
  const [content, setContent] = useState(
    'Q4 Product Summary\nShared directly from RustFS using a temporary link!',
  );
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.putObjectText(keyName, content, { owner, team });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          Step 4 of 5 · Code-Along #2
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Superpower #1: Custom Labels &amp; Direct Share Links
        </h2>
        <p className="max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
          With local folders, you only get a filename. With Object Storage, every file can carry its
          own <strong className="text-amber-300">custom labels</strong> and generate a{' '}
          <strong className="text-amber-300">temporary download link</strong> — so users download
          straight from RustFS while our NestJS API stays fast and free!
        </p>
      </div>

      <CodeCard
        title="Edit: backend/src/storage/object/object-storage.service.ts → putObject() & createPresignedUrl()"
        badge="Code-Along #2"
        badgeColor="amber"
        code={TAGS_AND_LINKS_CODE}
      />

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleRun}
          className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4"
        >
          <h3 className="text-base font-semibold text-white">Try It: Tag &amp; Share an Object</h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Object Name</label>
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Label: owner</label>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Label: team</label>
              <input
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">File Content</label>
            <textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Object & Create Share Link'}
          </button>
        </form>

        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-amber-300">
                Saved in RustFS: <code className="text-white">{result.key}</code>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Tag className="h-3.5 w-3.5 text-amber-400" />
                  Labels stored right on the object:
                </div>
                {Object.keys(result.metadata || {}).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.metadata).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200"
                      >
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                    No labels saved yet — uncomment <code>Metadata: cleanMeta</code> in{' '}
                    <code>putObject()</code> (Code-Along #2a), save, and click again!
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                  <Link2 className="h-4 w-4 text-amber-400" />
                  Direct Share Link (Expires in 5 minutes)
                </div>
                {result.presignedUrl ? (
                  <>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Click the button below — your browser downloads the file{' '}
                      <strong>directly from RustFS</strong> (port 9000) without touching our NestJS
                      backend!
                    </p>
                    <a
                      href={result.presignedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition"
                    >
                      Open Direct RustFS Link <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </>
                ) : (
                  <p className="text-xs text-amber-200 leading-relaxed">
                    Share link not active yet — uncomment <code>getSignedUrl(...)</code> in{' '}
                    <code>createPresignedUrl()</code> (Code-Along #2b), save, and click the button
                    again!
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
              Click &ldquo;Save Object &amp; Create Share Link&rdquo; on the left to see your custom
              labels and test a live temporary link.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
