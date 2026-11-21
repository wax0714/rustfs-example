# Object Storage (RustFS) vs File Storage — NestJS Code-Along Workshop

A hands-on **NestJS + React + Docker** code-along project that starts with **File Storage only** and gradually migrates to **Object Storage ([RustFS](https://rustfs.com))** in real time.

The key Object Storage code blocks in the backend are intentionally **commented out** so participants can write (or uncomment) them live while NestJS auto-reloads (`npm run start:dev`).

---

## Quick Start (2 Terminals)

### 1. Start RustFS + NestJS Backend (Docker, live-watch mode)
```bash
docker compose up --build
```
This runs:
- **RustFS S3 API** on http://localhost:9000
- **RustFS Web Console** on http://localhost:9001 (`rustfsadmin` / `rustfsadmin`)
- **NestJS Server A** on http://localhost:3000 (`file_storage_a`, watch mode `npm run start:dev`)
- **NestJS Server B** on http://localhost:3001 (`file_storage_b`, watch mode `npm run start:dev`) — separate local folder, same shared RustFS bucket, powering the real Two-Server demo in Step 3!

### 2. Start Frontend Locally (`npm run start:dev`)
In a second terminal:
```bash
cd frontend
npm install
npm run start:dev
```
Open **http://localhost:5173** (Vite automatically proxies `/api` requests to `http://localhost:3000`).

---

## Live Code-Along Roadmap

Use the top stepper (or `←` / `→` arrow keys) to walk through the 5 steps:

| Step | Topic | What Participants Edit in Real Time |
| --- | --- | --- |
| **Step 1** | **File Storage Only** | Works out of the box! Save notes & upload files to a local `uploads/` folder. |
| **Step 2** | **Code-Along #1: Move to RustFS** | Implement `PutObjectCommand` in `backend/src/storage/object/object-storage.service.ts` → `putObject()`. |
| **Step 3** | **Live Two-Server Proof** | Compare local folders (`HTTP 404` on Server B) vs shared RustFS (`HTTP 200` on Server B) live, plus a plain-English note on Block Storage. |
| **Step 4** | **Code-Along #2: Labels & Share Links** | Uncomment `Metadata: cleanMeta` in `putObject()` and `getSignedUrl(...)` in `createPresignedUrl()` (`object-storage.service.ts`). |
| **Step 5** | **Code-Along #3: Streaming & Wrap-Up** | Implement HTTP Range streaming in `backend/src/storage/object/object-storage.controller.ts` → `stream()`, then test audio scrubbing and the File vs Object edit trade-off. |

> **Need deeper technical visuals during Q&A?** Click **Deep-Dive Q&A** in the top-right corner of the UI to inspect the Side-by-Side Lab, POSIX directory tree, 4 KB Block Sector Hex viewer, and full comparison matrix.

---

## Resetting the Workshop Environment

```bash
docker compose down -v
```
This wipes all stored RustFS objects, POSIX files, and virtual disk blocks so you can start a fresh session cleanly.
