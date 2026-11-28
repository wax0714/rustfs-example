import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface ObjectItemSummary {
  key: string;
  size: number;
  etag: string;
  lastModified: string | null;
  contentType: string;
  metadata: Record<string, string>;
}

export interface ObjectDetail extends ObjectItemSummary {
  content: string;
  isBinary: boolean;
  presignedUrl: string;
  bucket: string;
}

export interface PutObjectResult {
  bucket: string;
  key: string;
  size: number;
  etag: string;
  contentType: string;
  metadata: Record<string, string>;
  presignedUrl: string | null;
  durationMs: number;
  mechanism: string;
}

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly s3: S3Client;
  private readonly presignS3: S3Client;
  readonly bucket: string;
  readonly endpoint: string;
  readonly publicEndpoint: string;
  readonly consoleUrl: string;
  private bucketReady = false;

  constructor() {
    this.endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    this.publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || this.endpoint;
    this.consoleUrl = process.env.RUSTFS_CONSOLE_URL || 'http://localhost:9001';
    this.bucket = process.env.S3_BUCKET || 'storage-demo';

    const region = process.env.S3_REGION || 'us-east-1';
    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY || 'rustfsadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'rustfsadmin',
    };

    this.s3 = new S3Client({
      region,
      endpoint: this.endpoint,
      credentials,
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    // Separate client pointing to the browser-reachable URL so SigV4 Host headers
    // match when the user clicks a presigned URL from their browser.
    this.presignS3 = new S3Client({
      region,
      endpoint: this.publicEndpoint,
      credentials,
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async onModuleInit() {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.ensureBucket();
        await this.seedWelcomeObject();
        return;
      } catch (err) {
        this.bucketReady = false;
        if (attempt === 5) {
          this.logger.warn(
            `RustFS not ready after ${attempt} startup attempts (${(err as Error).message}). Will retry automatically on first request.`,
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
    } catch (err: any) {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.bucketReady = true;
        this.logger.log(`Created RustFS bucket "${this.bucket}"`);
      } catch (createErr: any) {
        const createStatus = createErr?.$metadata?.httpStatusCode;
        if (
          createStatus === 409 ||
          createErr?.name === 'BucketAlreadyOwnedByYou' ||
          createErr?.name === 'BucketAlreadyExists'
        ) {
          this.bucketReady = true;
          return;
        }
        throw new ServiceUnavailableException(
          `Cannot connect to RustFS at ${this.endpoint}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async seedWelcomeObject(): Promise<void> {
    const existing = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 }),
    );
    if ((existing.Contents?.length || 0) === 0) {
      // Seed directly via S3Client so the bucket has a starter object on fresh Docker boot
      // even before participants complete Code-Along #1 inside putObject().
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: 'welcome/hello-rustfs.txt',
          Body: Buffer.from(
            'Welcome to RustFS Object Storage!\n\n' +
            'Notice that "welcome/" is NOT a real directory — it is just part of a flat key string.\n' +
            'This object also carries custom metadata labels and can be shared via a presigned HTTP URL.',
            'utf-8',
          ),
          ContentType: 'text/plain; charset=utf-8',
          Metadata: {
            author: 'storage-demo',
            architecture: 'object-storage',
            engine: 'rustfs',
          },
        }),
      );
      this.logger.log(`Seeded starter object "welcome/hello-rustfs.txt" in "${this.bucket}"`);
    }
  }

  async getStatus() {
    try {
      await this.ensureBucket();
      const res = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket }));
      return {
        healthy: true,
        engine: 'RustFS (S3-Compatible Object Storage)',
        bucket: this.bucket,
        endpoint: this.publicEndpoint,
        consoleUrl: this.consoleUrl,
        objectCount: res.Contents?.length ?? 0,
      };
    } catch (err) {
      this.bucketReady = false;
      return {
        healthy: false,
        engine: 'RustFS (S3-Compatible Object Storage)',
        bucket: this.bucket,
        endpoint: this.publicEndpoint,
        consoleUrl: this.consoleUrl,
        error: (err as Error).message,
      };
    }
  }

  private sanitizeKey(rawKey: string): string {
    const cleaned = (rawKey || '').trim().replace(/^\/+/, '');
    if (!cleaned) {
      throw new BadRequestException('Object key is required');
    }
    return cleaned;
  }

  private sanitizeMetadata(raw?: Record<string, string>): Record<string, string> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const cleanKey = k
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '');
      if (cleanKey && v !== undefined && v !== null) {
        out[cleanKey] = String(v).trim();
      }
    }
    return out;
  }

  async listObjects(prefix?: string): Promise<{
    bucket: string;
    prefix: string;
    objects: ObjectItemSummary[];
    durationMs: number;
  }> {
    await this.ensureBucket();
    const start = performance.now();
    const normalizedPrefix = (prefix || '').trim().replace(/^\/+/, '');

    const listRes = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: normalizedPrefix || undefined,
      }),
    );

    const contents = listRes.Contents || [];
    const objects: ObjectItemSummary[] = await Promise.all(
      contents.map(async (item) => {
        const key = item.Key || '';
        let metadata: Record<string, string> = {};
        let contentType = 'application/octet-stream';
        try {
          const head = await this.s3.send(
            new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
          );
          metadata = head.Metadata || {};
          contentType = head.ContentType || contentType;
        } catch {
          // Best-effort metadata fetch
        }
        return {
          key,
          size: item.Size ?? 0,
          etag: (item.ETag || '').replace(/"/g, ''),
          lastModified: item.LastModified ? item.LastModified.toISOString() : null,
          contentType,
          metadata,
        };
      }),
    );

    return {
      bucket: this.bucket,
      prefix: normalizedPrefix,
      objects,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  async putObject(
    rawKey: string,
    body: Buffer,
    contentType = 'text/plain; charset=utf-8',
    metadata?: Record<string, string>,
  ): Promise<PutObjectResult> {
    await this.ensureBucket();
    const key = this.sanitizeKey(rawKey);
    const cleanMeta = this.sanitizeMetadata(metadata);
    const start = performance.now();

    // =========================================================================
    // CODE-ALONG #1 (Step 2): Upload an object to RustFS using PutObjectCommand
    // Uncomment or type this block, save the file, and try Step 2 in the UI!
    // =========================================================================
    /*
    const res = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,

        // =====================================================================
        // CODE-ALONG #2a (Step 4): Attach custom labels (metadata) to the object
        // Uncomment the line below, save the file, and try Step 4 in the UI!
        // =====================================================================
        // Metadata: cleanMeta,
      }),
    );

    const durationMs = Number((performance.now() - start).toFixed(2));

    let presignedUrl: string | null = null;
    try {
      presignedUrl = await this.createPresignedUrl(key, 300);
    } catch {
      // Completed in Code-Along #2b (Step 4)
    }

    // Read back metadata from RustFS so Step 4 shows whether Code-Along #2a is active
    let storedMetadata: Record<string, string> = {};
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      storedMetadata = head.Metadata || {};
    } catch {
      // ignore
    }

    return {
      bucket: this.bucket,
      key,
      size: body.byteLength,
      etag: (res.ETag || '').replace(/"/g, ''),
      contentType,
      metadata: storedMetadata,
      presignedUrl,
      durationMs,
      mechanism: 'HTTP PUT (S3 PutObject) — immutable whole-object upload with custom headers',
    };
    */

    throw new NotImplementedException(
      'Code-Along #1 not completed yet! Open backend/src/storage/object/object-storage.service.ts and implement PutObjectCommand inside putObject().',
    );
  }

  async getObject(rawKey: string): Promise<ObjectDetail & { durationMs: number }> {
    await this.ensureBucket();
    const key = this.sanitizeKey(rawKey);
    const start = performance.now();

    try {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const buffer = await this.streamToBuffer(res.Body);
      const isBinary = this.looksBinary(buffer, res.ContentType);
      let presignedUrl = '';
      try {
        presignedUrl = await this.createPresignedUrl(key, 300);
      } catch {
        // Completed in Code-Along #2b (Step 4)
      }

      return {
        bucket: this.bucket,
        key,
        size: buffer.byteLength,
        etag: (res.ETag || '').replace(/"/g, ''),
        lastModified: res.LastModified ? res.LastModified.toISOString() : null,
        contentType: res.ContentType || 'application/octet-stream',
        metadata: res.Metadata || {},
        content: isBinary
          ? `[Binary object: ${buffer.byteLength} bytes — use the Presigned URL to download/view]`
          : buffer.toString('utf-8'),
        isBinary,
        presignedUrl,
        durationMs: Number((performance.now() - start).toFixed(2)),
      };
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
        throw new NotFoundException(`Object "${key}" not found in bucket "${this.bucket}"`);
      }
      throw err;
    }
  }

  /**
   * Demonstrates Object Storage immutability:
   * To change even a few bytes at an offset, S3/RustFS requires reading the ENTIRE object,
   * modifying it in memory, and uploading the ENTIRE object again (new ETag).
   */
  async patchObjectByFullRewrite(rawKey: string, offset: number, patchText: string) {
    await this.ensureBucket();
    const key = this.sanitizeKey(rawKey);
    const patchBuf = Buffer.from(patchText, 'utf-8');
    if (offset < 0 || !Number.isInteger(offset)) {
      throw new BadRequestException('Offset must be a non-negative integer');
    }

    const start = performance.now();
    let existingRes;
    try {
      existingRes = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
        throw new NotFoundException(`Object "${key}" not found`);
      }
      throw err;
    }

    const oldBuffer = await this.streamToBuffer(existingRes.Body);
    const oldEtag = (existingRes.ETag || '').replace(/"/g, '');
    const requiredLength = Math.max(oldBuffer.byteLength, offset + patchBuf.byteLength);
    const newBuffer = Buffer.alloc(requiredLength, 0x20);
    oldBuffer.copy(newBuffer, 0);
    patchBuf.copy(newBuffer, offset);

    const putRes = await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: newBuffer,
        ContentType: existingRes.ContentType || 'text/plain; charset=utf-8',
        Metadata: existingRes.Metadata || {},
      }),
    );

    const durationMs = Number((performance.now() - start).toFixed(2));
    return {
      key,
      offset,
      patchBytes: patchBuf.byteLength,
      bytesReadOverNetwork: oldBuffer.byteLength,
      bytesWrittenOverNetwork: newBuffer.byteLength,
      totalBytesTransferred: oldBuffer.byteLength + newBuffer.byteLength,
      oldEtag,
      newEtag: (putRes.ETag || '').replace(/"/g, ''),
      durationMs,
      note:
        'Object storage is immutable: changing ' +
        `${patchBuf.byteLength} bytes required downloading ${oldBuffer.byteLength} bytes and re-uploading ${newBuffer.byteLength} bytes.`,
    };
  }

  async createPresignedUrl(rawKey: string, expiresInSeconds = 300): Promise<string> {
    const key = this.sanitizeKey(rawKey);

    // =========================================================================
    // CODE-ALONG #2b (Step 4): Create a temporary direct RustFS download link
    // Uncomment or type this block, save the file, and try Step 4 in the UI!
    // =========================================================================
    /*
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.presignS3, command, { expiresIn: expiresInSeconds });
    */

    throw new NotImplementedException(
      'Code-Along #2b not completed yet! Open backend/src/storage/object/object-storage.service.ts and implement getSignedUrl() inside createPresignedUrl().',
    );
  }

  async deleteObject(rawKey: string) {
    await this.ensureBucket();
    const key = this.sanitizeKey(rawKey);
    const start = performance.now();
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      deleted: key,
      bucket: this.bucket,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  /**
   * Streams an object directly from RustFS without buffering it in NestJS RAM.
   * Forwards HTTP `Range` headers directly to S3/RustFS for true 206 Partial Content seeking.
   */
  async streamObject(rawKey: string, rangeHeader?: string): Promise<{
    stream: Readable;
    statusCode: number;
    contentType: string;
    contentLength?: number;
    contentRange?: string;
    acceptRanges: string;
    etag: string;
  }> {
    await this.ensureBucket();
    const key = this.sanitizeKey(rawKey);

    try {
      const res = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: rangeHeader || undefined,
        }),
      );

      let stream: Readable;
      if (res.Body instanceof Readable) {
        stream = res.Body;
      } else if (res.Body && typeof (res.Body as any).transformToWebStream === 'function') {
        stream = Readable.fromWeb((res.Body as any).transformToWebStream());
      } else {
        const buf = await this.streamToBuffer(res.Body);
        stream = Readable.from(buf);
      }

      const isPartial = Boolean(rangeHeader && res.ContentRange);
      return {
        stream,
        statusCode: isPartial ? 206 : 200,
        contentType: res.ContentType || 'application/octet-stream',
        contentLength: res.ContentLength,
        contentRange: res.ContentRange,
        acceptRanges: res.AcceptRanges || 'bytes',
        etag: (res.ETag || '').replace(/"/g, ''),
      };
    } catch (err: any) {
      const code = err?.$metadata?.httpStatusCode;
      if (code === 404 || err?.name === 'NoSuchKey') {
        throw new NotFoundException(`Object "${key}" not found in bucket "${this.bucket}"`);
      }
      if (code === 416 || err?.name === 'InvalidRange') {
        throw new BadRequestException(`Requested Range "${rangeHeader}" is not satisfiable`);
      }
      throw err;
    }
  }

  /**
   * Synthesizes a valid stereo 44.1 kHz 16-bit PCM WAV track (~2.65 MB for 15s)
   * so users can immediately test HTML5 audio seeking (HTTP 206) and chunked streaming.
   */
  buildDemoWavBuffer(durationSeconds = 15): Buffer {
    const sampleRate = 44100;
    const numChannels = 2;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples * blockAlign;

    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // PCM chunk size
    buffer.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Gentle C-major arpeggio chord progression
    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
    const stepDuration = 0.5; // seconds per note

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const stepIdx = Math.floor(t / stepDuration) % notes.length;
      const localT = t % stepDuration;
      const envelope = Math.min(1, localT * 20) * Math.exp(-localT * 3.2);
      const freq = notes[stepIdx];
      const left = Math.sin(2 * Math.PI * freq * t) * 0.32 * envelope;
      const right = Math.sin(2 * Math.PI * (freq * 1.003) * t) * 0.32 * envelope;

      buffer.writeInt16LE(Math.round(left * 32767), offset);
      buffer.writeInt16LE(Math.round(right * 32767), offset + 2);
      offset += 4;
    }

    return buffer;
  }

  async seedStreamableMedia() {
    const wav = this.buildDemoWavBuffer(15);
    const key = 'media/demo-stream-audio.wav';
    const result = await this.putObject(key, wav, 'audio/wav', {
      demo: 'streaming',
      format: 'pcm-wav-44100hz-stereo',
      durationseconds: '15',
    });
    return {
      ...result,
      streamUrl: `/api/storage/object/stream?key=${encodeURIComponent(key)}`,
    };
  }

  private async streamToBuffer(body: any): Promise<Buffer> {
    if (!body) return Buffer.alloc(0);
    if (typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    }
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    return Buffer.from(body);
  }

  private looksBinary(buf: Buffer, contentType?: string): boolean {
    if (contentType && /^(text\/|application\/json|application\/xml)/.test(contentType)) {
      return false;
    }
    const sampleLen = Math.min(buf.length, 512);
    for (let i = 0; i < sampleLen; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  }
}
