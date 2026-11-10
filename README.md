# AirBox 📦 ⚡

> **A high-performance, distributed, content-addressed file synchronization platform built with Go & Next.js.**

AirBox is an open-source Dropbox alternative designed around **Content-Addressable Storage (CAS)**, **chunk-level deduplication**, **delta sync**, and real-time live synchronization.

---

## 🏗️ Architecture

```
                       ┌─────────────────────────┐
                       │  AirBox Next.js Web UI  │
                       │  (App Router + Tailwind)│
                       └───────────┬─────────────┘
                                   │ HTTP/REST + WebSocket
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AirBox Core Engine (Go)                         │
│                                                                        │
│  ┌───────────────────────┐   ┌──────────────────────────────────────┐  │
│  │     API & Routing     │   │         Metadata & Versions          │  │
│  │  (HTTP / Sync RPC)    │   │  (File manifests, Revisions, Trees)  │  │
│  └───────────┬───────────┘   └──────────────────┬───────────────────┘  │
│              │                                  │                      │
│              ▼                                  ▼                      │
│  ┌───────────────────────┐   ┌──────────────────────────────────────┐  │
│  │   Chunking Engine     │   │      Block Storage Engine (CAS)      │  │
│  │ (SHA-256 Slicing/CAS) │──▶│  (Deduplication & Local/Blob Store)  │  │
│  └───────────────────────┘   └──────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │ Sync Protocol
                       ┌───────────┴─────────────┐
                       │   AirBox Client Daemon  │
                       │    (CLI File Watcher)   │
                       └─────────────────────────┘
```

---

## 🚀 Key Features

- **Content-Addressable Deduplication:** Files are sliced into SHA-256 verified blocks. Identical blocks across files or revisions are stored once.
- **Delta Sync:** Edits to large files only upload modified chunks, drastically reducing network I/O.
- **Polyglot Design:** High-throughput Go engine for systems-level concurrency + clean Next.js 15 dashboard for file exploration and version history.
- **Revision History:** Point-in-time recovery and conflict resolution copies.

---

## 📂 Project Structure

```text
airbox/
├── backend/                  # Go systems engine
│   ├── cmd/
│   │   ├── server/           # AirBox HTTP API & storage daemon
│   │   └── cli/              # Client sync CLI daemon (watcher)
│   ├── pkg/
│   │   ├── api/              # HTTP handlers & routes
│   │   ├── cas/              # Content-addressable chunking & hashing
│   │   ├── meta/             # File manifest versions & trees
│   │   └── storage/          # Block store & deduplication logic
│   └── go.mod
│
├── frontend/                 # Modern Next.js App Router UI
│   ├── src/
│   │   ├── app/              # Next.js App directory
│   │   └── components/       # UI Components
│   ├── package.json
│   └── tailwind.config.ts
│
├── docker-compose.yml        # One-command orchestration
└── README.md
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Go 1.22+**
- **Node.js 20+**
- **npm** or **pnpm**

### 2. Running the Backend
```bash
cd backend
go run ./cmd/server
# Server listens on http://localhost:8080
```

### 3. Running the Frontend
```bash
cd frontend
npm run dev
# Dashboard available on http://localhost:3000
```

---

## 📜 License
MIT © pfrancistechs-cel

