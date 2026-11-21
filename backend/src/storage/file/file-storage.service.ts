import {
  Injectable,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

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

@Injectable()
export class FileStorageService implements OnModuleInit {
  readonly rootDir: string;

  constructor() {
    this.rootDir = path.resolve(
      process.env.FILE_STORAGE_DIR || path.join(process.cwd(), 'storage', 'file'),
    );
  }

  async onModuleInit() {
    await fs.mkdir(this.rootDir, { recursive: true });
    await this.seedWelcomeFiles();
  }

  private async seedWelcomeFiles() {
    const entries = await fs.readdir(this.rootDir);
    if (entries.length === 0) {
      const docsDir = path.join(this.rootDir, 'documents');
      const logsDir = path.join(this.rootDir, 'logs');
      await fs.mkdir(docsDir, { recursive: true });
      await fs.mkdir(logsDir, { recursive: true });
      await fs.writeFile(
        path.join(docsDir, 'readme.txt'),
        'Welcome to POSIX File Storage!\n\n' +
          'Files live inside real hierarchical directories with OS inodes and permissions.\n' +
          'You can append lines, patch bytes in place, or atomically rename files across folders.\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(logsDir, 'app.log'),
        '[INIT] File storage mounted at POSIX path\n',
        'utf-8',
      );
    }
  }

  resolveSafePath(relativePath: string): { absPath: string; relPath: string } {
    const cleaned = (relativePath || '').trim().replace(/^\/+/, '');
    if (!cleaned) {
      throw new BadRequestException('File or directory path is required');
    }
    const normalized = path.posix.normalize(cleaned).replace(/^\/+/, '');
    if (normalized.startsWith('..') || normalized === '.') {
      throw new BadRequestException('Invalid path: directory traversal is not allowed');
    }
    const absPath = path.resolve(this.rootDir, normalized);
    if (absPath !== this.rootDir && !absPath.startsWith(this.rootDir + path.sep)) {
      throw new BadRequestException('Path escapes file storage root');
    }
    return { absPath, relPath: normalized };
  }

  async getStatus() {
    await fs.mkdir(this.rootDir, { recursive: true });
    const tree = await this.buildTree(this.rootDir, '');
    const counts = this.countNodes(tree);
    return {
      healthy: true,
      engine: 'POSIX Filesystem (Docker Shared Volume)',
      rootDir: this.rootDir,
      fileCount: counts.files,
      directoryCount: counts.directories,
    };
  }

  async getTree() {
    await fs.mkdir(this.rootDir, { recursive: true });
    const start = performance.now();
    const tree = await this.buildTree(this.rootDir, '');
    return {
      rootDir: this.rootDir,
      tree,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  private async buildTree(dirAbs: string, relPrefix: string): Promise<FileTreeNode[]> {
    const dirents = await fs.readdir(dirAbs, { withFileTypes: true });
    dirents.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const nodes: FileTreeNode[] = [];
    for (const d of dirents) {
      const childAbs = path.join(dirAbs, d.name);
      const childRel = relPrefix ? `${relPrefix}/${d.name}` : d.name;
      const stat = await fs.stat(childAbs);
      const node: FileTreeNode = {
        name: d.name,
        path: childRel,
        type: d.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        inode: Number(stat.ino),
        mode: '0' + (stat.mode & 0o777).toString(8),
        modifiedAt: stat.mtime.toISOString(),
      };
      if (d.isDirectory()) {
        node.children = await this.buildTree(childAbs, childRel);
      }
      nodes.push(node);
    }
    return nodes;
  }

  private countNodes(nodes: FileTreeNode[]): { files: number; directories: number } {
    let files = 0;
    let directories = 0;
    for (const n of nodes) {
      if (n.type === 'directory') {
        directories++;
        const sub = this.countNodes(n.children || []);
        files += sub.files;
        directories += sub.directories;
      } else {
        files++;
      }
    }
    return { files, directories };
  }

  async createDirectory(relativePath: string) {
    const { absPath, relPath } = this.resolveSafePath(relativePath);
    const start = performance.now();
    await fs.mkdir(absPath, { recursive: true });
    const stat = await fs.stat(absPath);
    return {
      path: relPath,
      inode: Number(stat.ino),
      mode: '0' + (stat.mode & 0o777).toString(8),
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  async writeFile(relativePath: string, content: string | Buffer) {
    const { absPath, relPath } = this.resolveSafePath(relativePath);
    const start = performance.now();
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content ?? '', 'utf-8');
    await fs.writeFile(absPath, buf);
    const stat = await fs.stat(absPath);
    return {
      path: relPath,
      size: stat.size,
      inode: Number(stat.ino),
      mode: '0' + (stat.mode & 0o777).toString(8),
      modifiedAt: stat.mtime.toISOString(),
      durationMs: Number((performance.now() - start).toFixed(2)),
      mechanism: 'POSIX open() + write() inside hierarchical directory tree',
    };
  }

  async readFile(relativePath: string) {
    const { absPath, relPath } = this.resolveSafePath(relativePath);
    const start = performance.now();
    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      throw new NotFoundException(`File "${relPath}" not found`);
    }
    if (stat.isDirectory()) {
      throw new BadRequestException(`"${relPath}" is a directory, not a file`);
    }
    const content = await fs.readFile(absPath, 'utf-8');
    return {
      path: relPath,
      content,
      size: stat.size,
      posixMetadata: {
        inode: Number(stat.ino),
        mode: '0' + (stat.mode & 0o777).toString(8),
        uid: stat.uid,
        gid: stat.gid,
        links: stat.nlink,
        blocksAllocated: stat.blocks,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      },
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }

  async appendFile(relativePath: string, line: string) {
    const { absPath, relPath } = this.resolveSafePath(relativePath);
    const start = performance.now();
    let beforeStat;
    try {
      beforeStat = await fs.stat(absPath);
    } catch {
      throw new NotFoundException(`File "${relPath}" not found`);
    }
    const payload = line.endsWith('\n') ? line : `${line}\n`;
    const appendedBytes = Buffer.byteLength(payload, 'utf-8');
    await fs.appendFile(absPath, payload, 'utf-8');
    const afterStat = await fs.stat(absPath);

    return {
      path: relPath,
      appendedBytes,
      oldSize: beforeStat.size,
      newSize: afterStat.size,
      inodeBefore: Number(beforeStat.ino),
      inodeAfter: Number(afterStat.ino),
      inodePreserved: beforeStat.ino === afterStat.ino,
      durationMs: Number((performance.now() - start).toFixed(2)),
      note: 'POSIX O_APPEND wrote only the new bytes to the end of the file without rewriting existing data.',
    };
  }

  async patchFileInPlace(relativePath: string, offset: number, patchText: string) {
    const { absPath, relPath } = this.resolveSafePath(relativePath);
    if (offset < 0 || !Number.isInteger(offset)) {
      throw new BadRequestException('Offset must be a non-negative integer');
    }
    const patchBuf = Buffer.from(patchText, 'utf-8');
    const start = performance.now();

    let fh: fs.FileHandle;
    try {
      fh = await fs.open(absPath, 'r+');
    } catch {
      throw new NotFoundException(`File "${relPath}" not found`);
    }

    try {
      const beforeStat = await fh.stat();
      await fh.write(patchBuf, 0, patchBuf.byteLength, offset);
      await fh.datasync();
      const afterStat = await fh.stat();

      return {
        path: relPath,
        offset,
        bytesWritten: patchBuf.byteLength,
        fileSize: afterStat.size,
        inodeBefore: Number(beforeStat.ino),
        inodeAfter: Number(afterStat.ino),
        inodePreserved: beforeStat.ino === afterStat.ino,
        durationMs: Number((performance.now() - start).toFixed(2)),
        note: `POSIX pwrite() updated ONLY ${patchBuf.byteLength} bytes in place at byte offset ${offset} — keeping the same inode (${afterStat.ino}).`,
      };
    } finally {
      await fh.close();
    }
  }

  async renameItem(fromPath: string, toPath: string) {
    const from = this.resolveSafePath(fromPath);
    const to = this.resolveSafePath(toPath);
    const start = performance.now();

    let beforeStat;
    try {
      beforeStat = await fs.stat(from.absPath);
    } catch {
      throw new NotFoundException(`Source path "${from.relPath}" not found`);
    }

    await fs.mkdir(path.dirname(to.absPath), { recursive: true });
    await fs.rename(from.absPath, to.absPath);
    const afterStat = await fs.stat(to.absPath);

    return {
      from: from.relPath,
      to: to.relPath,
      inodeBefore: Number(beforeStat.ino),
      inodeAfter: Number(afterStat.ino),
      zeroCopyMove: beforeStat.ino === afterStat.ino,
      durationMs: Number((performance.now() - start).toFixed(2)),
      note: 'POSIX rename() is an atomic directory-pointer update — zero data bytes were copied!',
    };
  }

  async deleteItem(relativePath: string) {
    const { absPath, relPath } = this.resolveSafePath(relativePath);
    const start = performance.now();
    try {
      await fs.rm(absPath, { recursive: true, force: false });
    } catch {
      throw new NotFoundException(`Path "${relPath}" not found`);
    }
    return {
      deleted: relPath,
      durationMs: Number((performance.now() - start).toFixed(2)),
    };
  }
}
