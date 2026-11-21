export interface StorageStatusResponse {
  timestamp: string;
  object: {
    healthy: boolean;
    engine: string;
    bucket: string;
    endpoint: string;
    consoleUrl: string;
    objectCount?: number;
    error?: string;
  };
  file: {
    healthy: boolean;
    engine: string;
    rootDir: string;
    fileCount: number;
    directoryCount: number;
  };
  block: {
    healthy: boolean;
    engine: string;
    diskPath: string;
    blockSize: number;
    blockCount: number;
    totalBytes: number;
    allocatedBlocks: number;
  };
}

export interface ObjectItemSummary {
  key: string;
  size: number;
  etag: string;
  lastModified: string | null;
  contentType: string;
  metadata: Record<string, string>;
}

export interface ObjectDetail extends ObjectItemSummary {
  bucket: string;
  content: string;
  isBinary: boolean;
  presignedUrl: string;
  durationMs: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  inode: number;
  mode: string;
  modifiedAt: string;
  children?: FileTreeNode[];
}

export interface FileReadResult {
  path: string;
  content: string;
  size: number;
  posixMetadata: {
    inode: number;
    mode: string;
    uid: number;
    gid: number;
    links: number;
    blocksAllocated: number;
    createdAt: string;
    modifiedAt: string;
  };
  durationMs: number;
}

export interface BlockSummary {
  lba: number;
  byteStart: number;
  byteEnd: number;
  allocated: boolean;
  nonZeroBytes: number;
  preview: string;
}

export interface BlockDiskInfo {
  diskPath: string;
  blockSize: number;
  blockCount: number;
  totalBytes: number;
  allocatedBlocks: number;
  freeBlocks: number;
  blocks: BlockSummary[];
  durationMs: number;
}

export interface BlockDetail {
  lba: number;
  byteStart: number;
  byteEnd: number;
  blockSize: number;
  nonZeroBytes: number;
  slackSpaceBytes: number;
  textPreview: string;
  hexDump: string[];
  dumpOffset: number;
  dumpLength: number;
  durationMs: number;
}
