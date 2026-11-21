import { Controller, Get, Post, Body } from '@nestjs/common';
import * as os from 'os';
import { ObjectStorageService } from './object/object-storage.service';
import { FileStorageService } from './file/file-storage.service';
import { BlockStorageService } from './block/block-storage.service';

@Controller('storage')
export class StorageController {
  constructor(
    private readonly objectStorage: ObjectStorageService,
    private readonly fileStorage: FileStorageService,
    private readonly blockStorage: BlockStorageService,
  ) {}

  @Get('status')
  async getStatus() {
    const [object, file, block] = await Promise.all([
      this.objectStorage.getStatus(),
      this.fileStorage.getStatus(),
      this.blockStorage.getStatus(),
    ]);
    return {
      timestamp: new Date().toISOString(),
      serverName: process.env.SERVER_NAME || 'Server A',
      containerId: os.hostname(),
      object,
      file,
      block,
    };
  }

  /**
   * Experiment 1: Store the exact same payload (e.g. 32 KB) in Object, File, and Block storage.
   */
  @Post('experiments/write-payload')
  async runWritePayloadExperiment(@Body() body?: { sizeKb?: number; label?: string }) {
    const sizeKb = Math.min(Math.max(Number(body?.sizeKb) || 32, 4), 128);
    const totalBytes = sizeKb * 1024;
    const label = (body?.label || 'experiment').replace(/[^a-zA-Z0-9-_]/g, '');

    const header = `[EXPERIMENT:${label}] Created at ${new Date().toISOString()} | Size: ${totalBytes} bytes\n`;
    const fillerLine = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_\n';
    const repeated = fillerLine.repeat(Math.ceil(totalBytes / fillerLine.length));
    const payload = Buffer.from((header + repeated).slice(0, totalBytes), 'utf-8');

    const objectKey = `experiments/${label}-payload.txt`;
    const filePath = `experiments/${label}-payload.txt`;
    const blockStartLba = 16;

    const [objectRes, fileRes, blockRes] = await Promise.all([
      this.objectStorage.putObject(objectKey, payload, 'text/plain; charset=utf-8', {
        experiment: label,
        sizekb: String(sizeKb),
        storageclass: 'object-rustfs',
      }),
      this.fileStorage.writeFile(filePath, payload),
      this.blockStorage.writeMultiBlock(blockStartLba, payload),
    ]);

    return {
      experiment: 'write-payload',
      payloadBytes: payload.byteLength,
      object: {
        address: `s3://${objectRes.bucket}/${objectRes.key}`,
        durationMs: objectRes.durationMs,
        bytesTransferred: objectRes.size,
        extra: {
          etag: objectRes.etag,
          customMetadata: objectRes.metadata,
          presignedUrl: objectRes.presignedUrl,
        },
        summary:
          'Uploaded over HTTP API (S3 PutObject) into a flat namespace with custom metadata and instant HTTP shareability.',
      },
      file: {
        address: `/${fileRes.path}`,
        durationMs: fileRes.durationMs,
        bytesTransferred: fileRes.size,
        extra: {
          inode: fileRes.inode,
          mode: fileRes.mode,
        },
        summary:
          'Written through the OS POSIX filesystem inside a real directory hierarchy with fixed inode attributes.',
      },
      block: {
        address: `LBA ${blockRes.startLba}..${blockRes.endLba} (bytes ${blockRes.startLba * this.blockStorage.blockSize}..${(blockRes.endLba + 1) * this.blockStorage.blockSize - 1})`,
        durationMs: blockRes.durationMs,
        bytesTransferred: blockRes.allocatedBytes,
        extra: {
          blocksUsed: blockRes.blocksUsed,
          slackSpaceBytes: blockRes.slackSpaceBytes,
        },
        summary: `Split raw bytes across ${blockRes.blocksUsed} fixed 4 KB sectors with zero filename or metadata awareness.`,
      },
    };
  }

  /**
   * Experiment 2: Update ONLY 16 bytes at offset 500 inside the 32 KB payload.
   * Demonstrates Object Storage immutability (full read+rewrite) vs File & Block in-place pwrite().
   */
  @Post('experiments/patch-bytes')
  async runPatchBytesExperiment(
    @Body() body?: { offset?: number; patchText?: string; label?: string },
  ) {
    const label = (body?.label || 'experiment').replace(/[^a-zA-Z0-9-_]/g, '');
    const offset = Math.min(Math.max(Number(body?.offset ?? 500), 0), 3000);
    const patchText = (body?.patchText || '<<PATCHED_16B!>>').slice(0, 128);

    const objectKey = `experiments/${label}-payload.txt`;
    const filePath = `experiments/${label}-payload.txt`;
    const blockStartLba = 16;

    // Ensure baseline 32 KB payload exists in all 3 backends before patching
    try {
      await this.fileStorage.readFile(filePath);
      await this.objectStorage.getObject(objectKey);
    } catch {
      await this.runWritePayloadExperiment({ sizeKb: 32, label });
    }

    const [objectPatch, filePatch, blockPatch] = await Promise.all([
      this.objectStorage.patchObjectByFullRewrite(objectKey, offset, patchText),
      this.fileStorage.patchFileInPlace(filePath, offset, patchText),
      this.blockStorage.writeBlock(blockStartLba, patchText, offset, false),
    ]);

    return {
      experiment: 'patch-bytes',
      offset,
      patchText,
      patchBytes: Buffer.byteLength(patchText, 'utf-8'),
      object: {
        supportedInPlace: false,
        operation: 'GET full object + PUT full object (copy-on-write replacement)',
        durationMs: objectPatch.durationMs,
        bytesIoTotal: objectPatch.totalBytesTransferred,
        extra: {
          oldEtag: objectPatch.oldEtag,
          newEtag: objectPatch.newEtag,
          bytesRead: objectPatch.bytesReadOverNetwork,
          bytesWritten: objectPatch.bytesWrittenOverNetwork,
        },
        takeaway: objectPatch.note,
      },
      file: {
        supportedInPlace: true,
        operation: 'POSIX open(r+) + pwrite() at byte offset',
        durationMs: filePatch.durationMs,
        bytesIoTotal: filePatch.bytesWritten,
        extra: {
          inodeBefore: filePatch.inodeBefore,
          inodeAfter: filePatch.inodeAfter,
          inodePreserved: filePatch.inodePreserved,
        },
        takeaway: filePatch.note,
      },
      block: {
        supportedInPlace: true,
        operation: 'Direct LBA sector seek + pwrite() of raw bytes',
        durationMs: blockPatch.durationMs,
        bytesIoTotal: blockPatch.bytesWrittenToDisk,
        extra: {
          lba: blockPatch.lba,
          absoluteByteOffset: blockPatch.absoluteByteOffset,
        },
        takeaway: blockPatch.note,
      },
    };
  }

  /**
   * Experiment 3: Store custom metadata and generate a direct web-shareable link.
   * Highlights why Object Storage (RustFS) shines for cloud apps, media, backups, and data lakes.
   */
  @Post('experiments/metadata-and-share')
  async runMetadataShareExperiment(
    @Body()
    body?: {
      owner?: string;
      department?: string;
      classification?: string;
    },
  ) {
    const owner = body?.owner || 'alice';
    const department = body?.department || 'platform-engineering';
    const classification = body?.classification || 'internal';
    const content = `Quarterly Architecture Report\nOwner: ${owner}\nDepartment: ${department}\nGenerated: ${new Date().toISOString()}\n`;

    const objectRes = await this.objectStorage.putObject(
      'reports/2026/architecture-report.txt',
      Buffer.from(content, 'utf-8'),
      'text/plain; charset=utf-8',
      { owner, department, classification },
    );

    const fileRes = await this.fileStorage.writeFile(
      'reports/2026/architecture-report.txt',
      content,
    );

    const blockRes = await this.blockStorage.writeBlock(48, content, 0, true);

    return {
      experiment: 'metadata-and-share',
      object: {
        customMetadataSupported: true,
        nativeHttpUrlSupported: true,
        storedMetadata: objectRes.metadata,
        presignedUrl: objectRes.presignedUrl,
        durationMs: objectRes.durationMs,
        takeaway:
          'RustFS natively indexes arbitrary x-amz-meta-* headers and issues time-limited HTTP Presigned URLs directly from the storage tier — no app server streaming required!',
      },
      file: {
        customMetadataSupported: false,
        nativeHttpUrlSupported: false,
        storedMetadata: {
          inode: fileRes.inode,
          mode: fileRes.mode,
          size: fileRes.size,
          modifiedAt: fileRes.modifiedAt,
        },
        presignedUrl: null,
        durationMs: fileRes.durationMs,
        takeaway:
          'POSIX files only store fixed OS metadata (inode, mode, timestamps). Sharing over HTTP requires an app or web server proxy.',
      },
      block: {
        customMetadataSupported: false,
        nativeHttpUrlSupported: false,
        storedMetadata: null,
        presignedUrl: null,
        durationMs: blockRes.durationMs,
        takeaway:
          `Raw block storage wrote bytes to LBA ${blockRes.lba} with ZERO metadata — not even a filename or content type exists without a filesystem or database layer.`,
      },
    };
  }
}
