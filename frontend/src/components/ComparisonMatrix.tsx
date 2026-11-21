import React from 'react';
import { Box, FolderTree, HardDrive } from 'lucide-react';

const rows = [
  {
    dimension: 'Data Structure & Addressing',
    object: 'Flat namespace (Bucket + Key string). Slashes like "a/b.txt" are visual prefixes, not real directories.',
    file: 'Hierarchical directory tree (/dir/subdir/file) managed by an OS filesystem (ext4, XFS, NFS).',
    block: 'Fixed-size raw sectors (e.g., 4 KB) addressed purely by Logical Block Address (LBA 0, 1, 2...).',
  },
  {
    dimension: 'Access Protocol / Interface',
    object: 'HTTP / REST API (S3 API: PUT, GET, HEAD, DELETE) + Presigned URLs over the network.',
    file: 'OS POSIX syscalls (open, read, write, rename) or network file protocols (NFS, SMB).',
    block: 'Low-level block I/O (NVMe, SCSI, iSCSI, Fibre Channel) — no built-in HTTP or filenames.',
  },
  {
    dimension: 'Mutability (Partial Updates)',
    object: 'Immutable! Updating 16 bytes requires reading and re-uploading the ENTIRE object (new ETag).',
    file: 'Mutable in place (pwrite / O_APPEND) while preserving the same inode; atomic zero-copy rename.',
    block: 'Ultra-fast random-access sub-block updates directly at exact disk byte offsets.',
  },
  {
    dimension: 'Metadata Support',
    object: 'Rich, customizable key-value metadata (x-amz-meta-*, Content-Type, tags) stored with the object.',
    file: 'Fixed POSIX metadata only (inode, owner UID/GID, permissions mode, timestamps, size).',
    block: 'None. Raw bytes only — an OS filesystem or database engine must interpret what the blocks mean.',
  },
  {
    dimension: 'Scalability & Durability',
    object: 'Scales horizontally to exabytes across distributed nodes (e.g., RustFS erasure coding).',
    file: 'Scales well to terabytes, but deep folder trees & file locking become bottlenecks at massive scale.',
    block: 'Usually attached to a single host/VM (or clustered SAN); bounded per volume size.',
  },
  {
    dimension: 'Best Real-World Use Cases',
    object: 'Media/assets, user uploads, backups, AI datasets, data lakes, static websites, cloud-native apps.',
    file: 'Shared team folders, home directories, app configs, log files, CMS assets shared across servers.',
    block: 'Relational databases (PostgreSQL, MySQL), VM boot disks, high-IOPS transactional workloads.',
  },
  {
    dimension: 'Popular Technologies',
    object: 'RustFS, Amazon S3, Google Cloud Storage, MinIO, Ceph RGW.',
    file: 'Linux ext4/XFS, NFS, SMB/CIFS, Amazon EFS, Azure Files.',
    block: 'Local NVMe/SSD, Amazon EBS, Google Persistent Disk, Ceph RBD, iSCSI SAN.',
  },
];

export const ComparisonMatrix: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr>
              <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400 w-48">
                Dimension
              </th>
              <th className="px-4 py-3.5 font-semibold text-amber-300">
                <span className="inline-flex items-center gap-1.5">
                  <Box className="h-4 w-4" /> Object Storage (RustFS)
                </span>
              </th>
              <th className="px-4 py-3.5 font-semibold text-emerald-300">
                <span className="inline-flex items-center gap-1.5">
                  <FolderTree className="h-4 w-4" /> File Storage (POSIX)
                </span>
              </th>
              <th className="px-4 py-3.5 font-semibold text-indigo-300">
                <span className="inline-flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4" /> Block Storage (Raw LBA)
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {rows.map((r) => (
              <tr key={r.dimension} className="hover:bg-slate-800/30">
                <td className="px-4 py-3.5 font-medium text-slate-200 align-top">
                  {r.dimension}
                </td>
                <td className="px-4 py-3.5 text-slate-300 align-top">{r.object}</td>
                <td className="px-4 py-3.5 text-slate-300 align-top">{r.file}</td>
                <td className="px-4 py-3.5 text-slate-300 align-top">{r.block}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4">
          <h4 className="font-semibold text-amber-300">Why RustFS for Object Storage?</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            RustFS is a high-performance, S3-compatible distributed object storage engine written in
            Rust. Because it speaks the standard S3 protocol, your NestJS app uses the exact same{' '}
            <code>@aws-sdk/client-s3</code> SDK locally in Docker as it would against AWS S3 in
            production.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4">
          <h4 className="font-semibold text-emerald-300">When File Storage Wins</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            When apps expect standard OS paths, atomic directory renames, file locks, or streaming
            log appends (<code>O_APPEND</code>) without rewriting previous bytes.
          </p>
        </div>
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-4">
          <h4 className="font-semibold text-indigo-300">When Block Storage Wins</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            When a database engine (like PostgreSQL or InnoDB) manages its own B-tree pages and
            needs raw, predictable, microsecond-level random reads and writes at exact sector
            offsets.
          </p>
        </div>
      </div>
    </div>
  );
};
