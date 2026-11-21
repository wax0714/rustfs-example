import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { FileStorageService } from './file/file-storage.service';
import { BlockStorageService } from './block/block-storage.service';
import { ObjectStorageService } from './object/object-storage.service';

describe('FileStorageService & BlockStorageService', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-demo-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('FileStorageService supports directories, in-place patch preserving inode, and zero-copy rename', async () => {
    process.env.FILE_STORAGE_DIR = path.join(tmpDir, 'file');
    const svc = new FileStorageService();
    await svc.onModuleInit();

    const written = await svc.writeFile('projects/demo.txt', 'Hello World from POSIX!');
    expect(written.path).toBe('projects/demo.txt');

    const patched = await svc.patchFileInPlace('projects/demo.txt', 6, 'NestJS');
    expect(patched.inodePreserved).toBe(true);
    expect(patched.bytesWritten).toBe(6);

    const read = await svc.readFile('projects/demo.txt');
    expect(read.content).toBe('Hello NestJSfrom POSIX!');

    const moved = await svc.renameItem('projects/demo.txt', 'archive/demo-renamed.txt');
    expect(moved.zeroCopyMove).toBe(true);

    const movedRead = await svc.readFile('archive/demo-renamed.txt');
    expect(movedRead.content).toBe('Hello NestJSfrom POSIX!');
  });

  it('FileStorageService blocks path traversal attempts', () => {
    process.env.FILE_STORAGE_DIR = path.join(tmpDir, 'file-sec');
    const svc = new FileStorageService();
    expect(() => svc.resolveSafePath('../../etc/passwd')).toThrow();
  });

  it('BlockStorageService performs fixed 4KB LBA multi-block writes and surgical byte-offset patching', async () => {
    process.env.BLOCK_STORAGE_FILE = path.join(tmpDir, 'block', 'disk.img');
    process.env.BLOCK_SIZE_BYTES = '4096';
    process.env.BLOCK_COUNT = '16';
    const svc = new BlockStorageService();
    await svc.onModuleInit();

    const multi = await svc.writeMultiBlock(2, 'A'.repeat(5000));
    expect(multi.blocksUsed).toBe(2);
    expect(multi.lbasWritten).toEqual([2, 3]);
    expect(multi.slackSpaceBytes).toBe(4096 * 2 - 5000);

    const patch = await svc.writeBlock(2, 'PATCHED!', 10, false);
    expect(patch.bytesWrittenToDisk).toBe(8);
    expect(patch.absoluteByteOffset).toBe(2 * 4096 + 10);

    const read = await svc.readBlock(2, 0, 32);
    expect(read.textPreview.slice(10, 18)).toBe('PATCHED!');
  });

  it('ObjectStorageService synthesizes a valid streamable PCM WAV buffer', () => {
    const svc = new ObjectStorageService();
    const wav = svc.buildDemoWavBuffer(2);
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wav.byteLength).toBe(44 + 44100 * 2 * 4);
  });
});
