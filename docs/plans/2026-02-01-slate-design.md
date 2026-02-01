# Slate — Design Document

## Overview

Slate is a personal notes app optimized for speed. Folders, notes, fuzzy search, cross-device sync (iPhone, Mac, Linux, Windows). Hybrid local-first architecture: works offline, syncs when connected.

Single user. No auth (API key for the server endpoint).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Framework | SvelteKit (frontend + API routes) |
| Database | Turso (hosted SQLite) |
| Local storage | IndexedDB via Dexie.js |
| Editor | Tiptap (WYSIWYG rich text) |
| Search | SQLite FTS5 + local IndexedDB search |
| Deployment | Serverless (Fly.io or Cloudflare) |
| PWA | Service worker for offline app shell + data caching |

## Data Model

### Folder

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Unique identifier |
| name | string | Folder name |
| parentId | string? | Nullable, enables nested folders |
| sortOrder | integer | Manual ordering |
| createdAt | datetime | Creation timestamp |
| updatedAt | datetime | Last modified timestamp |

### Note

| Field | Type | Description |
|-------|------|-------------|
| id | string (uuid) | Unique identifier |
| folderId | string | Parent folder |
| title | string | Note title |
| content | string | HTML from Tiptap |
| plainText | string | Stripped text for FTS indexing |
| sortOrder | integer | Manual ordering |
| createdAt | datetime | Creation timestamp |
| updatedAt | datetime | Last modified timestamp |

## UI Layout

Three-panel layout:

```
┌──────────┬──────────────┬─────────────────────────┐
│ Folders  │  Note List   │      Editor             │
│          │  (previews)  │                         │
│ > Work   │ Meeting...   │  [Tiptap WYSIWYG        │
│ > Personal│ Ideas for.. │   editor]               │
│ > Ideas  │ TODO: Fix..  │                         │
│          │              │                         │
│ [+ New]  │  [+ New]     │                         │
└──────────┴──────────────┴─────────────────────────┘
```

- **Desktop/tablet:** All three panels visible, resizable
- **Mobile:** Stack navigation — folders > note list > editor (full screen)
- Note list shows title + preview snippet

### Keyboard Shortcuts

- `Cmd/Ctrl+K` — Fuzzy search (Spotlight-style modal)
- `Cmd/Ctrl+N` — New note in current folder, cursor in editor

## Search

Spotlight-style modal triggered by `Cmd/Ctrl+K`:

- Searches titles and body text via SQLite FTS5
- Results ranked by relevance
- Shows: note title, folder path, matching text snippet
- Arrow keys to navigate, Enter to open, Escape to dismiss
- Also searches local IndexedDB for offline support

## Sync Strategy

Single-user, last-write-wins, timestamp-based:

1. **On app load:** Pull records from Turso where `updatedAt > local updatedAt`. Overwrite local.
2. **On save:** Write to IndexedDB immediately, push to Turso in background. If offline, queue the write.
3. **On reconnect:** Flush pending write queue to Turso, newest timestamp wins.

PWA service worker caches app shell for offline loading.

## Non-Goals

- Multi-user / sharing
- Tags or metadata system
- Markdown syntax editing
- Advanced search filters
- Version history (v1)
