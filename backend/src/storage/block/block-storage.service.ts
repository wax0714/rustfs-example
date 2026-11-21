import {
  Injectable,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BlockSummary {
  lba: number;
  byteStart: number;
  byteEnd: number;
  allocated: boolean;
  nonZeroBytes: number;
  preview: string;
}

@Injectable()
export class BlockStorageService implements OnModuleInit {
  readonly diskPath: string;
  readonly blockSize: number;
  readonly blockCount: number;
  readonly totalBytes: number;

  constructor() {
    this.diskPath = path.resolve(
      process.env.BLOCK_STORAGE_FILE ||
        path.join(process.cwd(), 'storage', 'block', 'virtual-disk.img'),
    );
    this.blockSize = Number(process.env.BLOCK_SIZE_BYTES) || 4096;
    this.blockCount = Number(process.env.BLOCK_COUNT) || 64;
    this.totalBytes = this.blockSize * this.blockCount;
  }

  async onModuleInit() {
    await this.ensureDiskInitialized();
  }

  async ensureDiskInitialized() {
    await fs.mkdir(path.dirname(this.diskPath), { recursive: true });
    let needsInit = false;
    try {
      const stat = await fs.stat(this.diskPath);
      if (stat.size !== this.totalBytes) {
        needsInit = true;
      }
    } catch {
      needsInit = true;
    }

    if (needsInit) {
      await fs.writeFile(this.diskPath, Buffer.alloc(this.totalBytes, 0));
      // Seed LBA 0 with a raw header demonstrating no filenames/metadata
      await this.writeBlock(
        0,
        'RAW BLOCK LBA 0: No filenames, no directories, no HTTP URLs — just fixed 4KB sectors addressed by LBA offset!',
        0,
        true,
      );
    }
  }

  private validateLba(lba: number): number {
    if (!Number.isInteger(lba) || lba < 0 || lba >= this.blockCount) {
      throw new BadRequestException(
        `Invalid LBA ${lba}. Valid range is 0..${this.blockCount - 1}.`,
      );
    }
    return lba;
  }

  async getStatus() {
    await this.ensureDiskInitialized();
    const info = await this.getDiskInfo();
    return {
      healthy: true,
      engine: 'Raw Virtual Block Device (4 KB Fixed-Size Sectors / LBA)',
      diskPath: this.diskPath,
      blockSize: this.blockSize,
      blockCount: this.blockCount,
      totalBytes: this.totalBytes,
      allocatedBlocks: info.allocatedBlocks,
    };
  }

  async getDiskInfo() {
    await this.ensureDiskInitialized();
    const start = performance.now();
    const fh = await fs.open(this.diskPath, 'r');
    const blocks: BlockSummary[] = [];
    let allocatedBlocks = 0;

    try {
      const buf = Buffer.alloc(this.blockSize);
      for (let lba = 0; lba < this.blockCount; lba++) {
        await fh.read(buf, 0, this.blockSize, lba * this.blockSize);
        let nonZeroBytes = 0;
        for (let i = 0; i < this.blockSize; i++) {
          if (buf[i] !== 0) nonZeroBytes++;
        }
        const allocated = nonZeroBytes > 0;
        if (allocated) allocatedBlocks++;

        blocks.push({
          lba,
          byteStart: lba * this.blockSize,
          byteEnd: (lba + 1) * this.blockSize - 1,
          allocated,
          nonZeroBytes,
          preview: allocated ? this.extractPrintablePreview(buf, 48) : '',
        });
      }
    } finally {
      await fh.close();
    }

    return {
      diskPath: this.diskPath,
      blockSize: this.blockSize,
      blockCount: this.blockCount,
      totalBytes: this.totalBytes,
      allocatedBlocks,
      freeBlocks: this.blockCount - allocatedBlocks,
      blocks,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  async readBlock(lbaInput: number, dumpOffset = 0, dumpLength = 256) {
    await this.ensureDiskInitialized();
    const lba = this.validateLba(lbaInput);
    const start = performance.now();
    const buf = Buffer.alloc(this.blockSize);

    const fh = await fs.open(this.diskPath, 'r');
    try {
      await fh.read(buf, 0, this.blockSize, lba * this.blockSize);
    } finally {
      await fh.close();
    }

    let nonZeroBytes = 0;
    let lastNonZeroIdx = -1;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] !== 0) {
        nonZeroBytes++;
        lastNonZeroIdx = i;
      }
    }

    const safeStart = Math.max(0, Math.min(dumpOffset, this.blockSize - 16));
    const safeLen = Math.max(16, Math.min(dumpLength, this.blockSize - safeStart));
    const slice = buf.subarray(safeStart, safeStart + safeLen);

    return {
      lba,
      byteStart: lba * this.blockSize,
      byteEnd: (lba + 1) * this.blockSize - 1,
      blockSize: this.blockSize,
      nonZeroBytes,
      slackSpaceBytes: this.blockSize - nonZeroBytes,
      textPreview:
        lastNonZeroIdx >= 0
          ? buf
              .subarray(0, Math.min(lastNonZeroIdx + 1, 1024))
              .toString('utf-8')
              .replace(/\0/g, '·')
          : '',
      hexDump: this.formatHexDump(slice, lba * this.blockSize + safeStart),
      dumpOffset: safeStart,
      dumpLength: safeLen,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  /**
   * Writes raw bytes directly to a specific Logical Block Address (LBA) and intra-block offset.
   * When overwriteBlock=false, performs a surgical sub-block positional pwrite() of ONLY the modified bytes!
   */
  async writeBlock(
    lbaInput: number,
    data: string | Buffer,
    offsetInBlock = 0,
    overwriteBlock = false,
  ) {
    await this.ensureDiskInitialized();
    const lba = this.validateLba(lbaInput);
    if (!Number.isInteger(offsetInBlock) || offsetInBlock < 0 || offsetInBlock >= this.blockSize) {
      throw new BadRequestException(
        `offsetInBlock must be an integer between 0 and ${this.blockSize - 1}`,
      );
    }

    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data ?? '', 'utf-8');
    if (offsetInBlock + payload.byteLength > this.blockSize) {
      throw new BadRequestException(
        `Payload (${payload.byteLength} B) at offset ${offsetInBlock} exceeds single ${this.blockSize} B block boundary. Use multi-block write to span LBAs.`,
      );
    }

    const start = performance.now();
    const fh = await fs.open(this.diskPath, 'r+');
    let bytesWritten: number;

    try {
      if (overwriteBlock) {
        const blockBuf = Buffer.alloc(this.blockSize, 0);
        payload.copy(blockBuf, offsetInBlock);
        await fh.write(blockBuf, 0, this.blockSize, lba * this.blockSize);
        bytesWritten = this.blockSize;
      } else {
        const absoluteOffset = lba * this.blockSize + offsetInBlock;
        await fh.write(payload, 0, payload.byteLength, absoluteOffset);
        bytesWritten = payload.byteLength;
      }
      await fh.datasync();
    } finally {
      await fh.close();
    }

    return {
      lba,
      offsetInBlock,
      absoluteByteOffset: lba * this.blockSize + offsetInBlock,
      payloadBytes: payload.byteLength,
      bytesWrittenToDisk: bytesWritten,
      overwriteBlock,
      durationMs: Number((performance.now() - start).toFixed(2)),
      note: overwriteBlock
        ? `Rewrote full ${this.blockSize}-byte sector at LBA ${lba}.`
        : `Surgical random-access I/O: wrote ONLY ${bytesWritten} bytes directly at disk offset ${lba * this.blockSize + offsetInBlock} (LBA ${lba} + ${offsetInBlock}).`,
    };
  }

  /**
   * Splits an arbitrary payload across contiguous 4 KB blocks starting at startLba.
   */
  async writeMultiBlock(startLbaInput: number, data: string | Buffer) {
    await this.ensureDiskInitialized();
    const startLba = this.validateLba(startLbaInput);
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data ?? '', 'utf-8');
    const blocksNeeded = Math.max(1, Math.ceil(payload.byteLength / this.blockSize));

    if (startLba + blocksNeeded > this.blockCount) {
      throw new BadRequestException(
        `Payload needs ${blocksNeeded} blocks starting at LBA ${startLba}, exceeding disk capacity (${this.blockCount} blocks).`,
      );
    }

    const start = performance.now();
    const totalSectorBytes = blocksNeeded * this.blockSize;
    const padded = Buffer.alloc(totalSectorBytes, 0);
    payload.copy(padded, 0);

    const fh = await fs.open(this.diskPath, 'r+');
    try {
      await fh.write(padded, 0, totalSectorBytes, startLba * this.blockSize);
      await fh.datasync();
    } finally {
      await fh.close();
    }

    const lbas = Array.from({ length: blocksNeeded }, (_, i) => startLba + i);
    const slackSpaceBytes = totalSectorBytes - payload.byteLength;

    return {
      startLba,
      endLba: startLba + blocksNeeded - 1,
      lbasWritten: lbas,
      blocksUsed: blocksNeeded,
      payloadBytes: payload.byteLength,
      allocatedBytes: totalSectorBytes,
      slackSpaceBytes,
      durationMs: Number((performance.now() - start).toFixed(2)),
      note: `Split ${payload.byteLength} bytes across ${blocksNeeded} fixed ${this.blockSize}-byte blocks (LBA ${startLba}..${startLba + blocksNeeded - 1}). Notice raw block storage has NO filename or directory entry — your app or database must track the LBA range itself!`,
    };
  }

  async eraseBlock(lbaInput: number) {
    await this.ensureDiskInitialized();
    const lba = this.validateLba(lbaInput);
    const start = performance.now();
    const fh = await fs.open(this.diskPath, 'r+');
    try {
      await fh.write(Buffer.alloc(this.blockSize, 0), 0, this.blockSize, lba * this.blockSize);
      await fh.datasync();
    } finally {
      await fh.close();
    }
    return {
      erasedLba: lba,
      zeroedBytes: this.blockSize,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  async formatDisk() {
    await fs.mkdir(path.dirname(this.diskPath), { recursive: true });
    const start = performance.now();
    await fs.writeFile(this.diskPath, Buffer.alloc(this.totalBytes, 0));
    return {
      formatted: true,
      zeroedBytes: this.totalBytes,
      blockCount: this.blockCount,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  private extractPrintablePreview(buf: Buffer, maxLen: number): string {
    let out = '';
    for (let i = 0; i < buf.length && out.length < maxLen; i++) {
      const b = buf[i];
      if (b === 0) continue;
      out += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
    }
    return out;
  }

  private formatHexDump(slice: Buffer, baseOffset: number): string[] {
    const lines: string[] = [];
    for (let i = 0; i < slice.length; i += 16) {
      const row = slice.subarray(i, Math.min(i + 16, slice.length));
      const addr = (baseOffset + i).toString(16).padStart(8, '0');
      const hex = Array.from(row)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
        .padEnd(47, ' ');
      const ascii = Array.from(row)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      lines.push(`0x${addr}  ${hex}  |${ascii}|`);
    }
    return lines;
  }
}
