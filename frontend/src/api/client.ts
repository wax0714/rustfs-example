import {
  StorageStatusResponse,
  ObjectItemSummary,
  ObjectDetail,
  FileTreeNode,
  FileReadResult,
  BlockDiskInfo,
  BlockDetail,
} from '../types/storage';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return data as T;
}

export const api = {
  getStatus: () => request<StorageStatusResponse>('/api/storage/status'),

  // Experiments
  runWritePayloadExperiment: (sizeKb = 32, label = 'experiment') =>
    request<any>('/api/storage/experiments/write-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sizeKb, label }),
    }),

  runPatchBytesExperiment: (offset = 500, patchText = '<<PATCHED_16B!>>', label = 'experiment') =>
    request<any>('/api/storage/experiments/patch-bytes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset, patchText, label }),
    }),

  runMetadataShareExperiment: (owner: string, department: string, classification: string) =>
    request<any>('/api/storage/experiments/metadata-and-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, department, classification }),
    }),

  // Object Storage (RustFS)
  listObjects: (prefix = '') =>
    request<{ bucket: string; prefix: string; objects: ObjectItemSummary[]; durationMs: number }>(
      `/api/storage/object/list?prefix=${encodeURIComponent(prefix)}`,
    ),

  getObject: (key: string) =>
    request<ObjectDetail>(`/api/storage/object/item?key=${encodeURIComponent(key)}`),

  putObjectText: (key: string, content: string, metadata: Record<string, string>) =>
    request<any>('/api/storage/object/put', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, content, metadata }),
    }),

  uploadObjectFile: (file: File, key: string, metadata: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    if (key.trim()) form.append('key', key.trim());
    form.append('metadata', JSON.stringify(metadata));
    return request<any>('/api/storage/object/upload', {
      method: 'POST',
      body: form,
    });
  },

  patchObject: (key: string, offset: number, text: string) =>
    request<any>('/api/storage/object/patch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, offset, text }),
    }),

  deleteObject: (key: string) =>
    request<any>(`/api/storage/object/item?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),

  seedStreamMedia: () =>
    request<any>('/api/storage/object/seed-stream-media', {
      method: 'POST',
    }),

  getObjectStreamUrl: (key: string) =>
    `/api/storage/object/stream?key=${encodeURIComponent(key)}`,

  // File Storage (POSIX)
  getFileTree: () =>
    request<{ rootDir: string; tree: FileTreeNode[]; durationMs: number }>(
      '/api/storage/file/tree',
    ),

  readFile: (path: string) =>
    request<FileReadResult>(`/api/storage/file/read?path=${encodeURIComponent(path)}`),

  mkdir: (path: string) =>
    request<any>('/api/storage/file/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }),

  writeFile: (path: string, content: string) =>
    request<any>('/api/storage/file/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    }),

  uploadFileToFolder: (file: File, folder = 'uploads') => {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    return request<any>('/api/storage/file/upload', {
      method: 'POST',
      body: form,
    });
  },

  getFileDownloadUrl: (path: string) =>
    `/api/storage/file/download?path=${encodeURIComponent(path)}`,

  appendFile: (path: string, line: string) =>
    request<any>('/api/storage/file/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, line }),
    }),

  patchFile: (path: string, offset: number, text: string) =>
    request<any>('/api/storage/file/patch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, offset, text }),
    }),

  renameFile: (from: string, to: string) =>
    request<any>('/api/storage/file/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to }),
    }),

  deleteFile: (path: string) =>
    request<any>(`/api/storage/file/item?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),

  // Block Storage (Raw LBA)
  getBlockDiskInfo: () => request<BlockDiskInfo>('/api/storage/block/info'),

  readBlock: (lba: number, offset = 0, length = 256) =>
    request<BlockDetail>(
      `/api/storage/block/${lba}?offset=${offset}&length=${length}`,
    ),

  writeBlock: (lba: number, data: string, offsetInBlock: number, overwriteBlock: boolean) =>
    request<any>(`/api/storage/block/${lba}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, offsetInBlock, overwriteBlock }),
    }),

  writeMultiBlock: (startLba: number, data: string) =>
    request<any>('/api/storage/block/write-multi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startLba, data }),
    }),

  eraseBlock: (lba: number) =>
    request<any>(`/api/storage/block/${lba}`, { method: 'DELETE' }),

  formatDisk: () =>
    request<any>('/api/storage/block/format', { method: 'POST' }),
};
