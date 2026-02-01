# Slate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal notes PWA with three-panel UI, WYSIWYG editing, fuzzy search, and offline-first sync.

**Architecture:** SvelteKit handles both frontend and API routes. Turso (hosted SQLite) is the remote source of truth. Dexie.js (IndexedDB) provides the local cache and offline support. Tiptap provides the rich text editor. Sync is timestamp-based last-write-wins.

**Tech Stack:** Bun, SvelteKit, Turso/libsql, Dexie.js, Tiptap, SQLite FTS5

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via `bun create svelte`)
- Create: `svelte.config.js`
- Create: `src/app.html`
- Create: `src/routes/+page.svelte`

**Step 1: Scaffold SvelteKit project**

Run from `/home/myang/Source/slate`:
```bash
bun create svelte@latest . --template skeleton --types typescript --no-add-ons
```
Select: Skeleton project, TypeScript, no additional options.

**Step 2: Install dependencies**

```bash
bun add @libsql/client dexie @tiptap/core @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder uuid
bun add -d @types/uuid
```

**Step 3: Verify it runs**

```bash
bun run dev
```
Expected: Dev server starts on localhost:5173, shows default SvelteKit page.

**Step 4: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold SvelteKit project with dependencies"
```

---

### Task 2: Database Schema & Turso Setup

**Files:**
- Create: `src/lib/server/db.ts`
- Create: `src/lib/server/schema.sql`
- Create: `.env.example`
- Create: `.env`

**Step 1: Create SQL schema**

Create `src/lib/server/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  plain_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  plain_text,
  content='notes',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, plain_text) VALUES (new.rowid, new.title, new.plain_text);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, plain_text) VALUES('delete', old.rowid, old.title, old.plain_text);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, plain_text) VALUES('delete', old.rowid, old.title, old.plain_text);
  INSERT INTO notes_fts(rowid, title, plain_text) VALUES (new.rowid, new.title, new.plain_text);
END;
```

**Step 2: Create database client**

Create `src/lib/server/db.ts`:
```typescript
import { createClient } from '@libsql/client';
import { TURSO_URL, TURSO_AUTH_TOKEN } from '$env/static/private';

export const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

export async function initDb() {
  const schema = await import('./schema.sql?raw');
  const statements = schema.default.split(';').filter((s: string) => s.trim());
  for (const stmt of statements) {
    await db.execute(stmt);
  }
}
```

**Step 3: Create env files**

Create `.env.example`:
```
TURSO_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-token-here
API_KEY=your-api-key-here
```

Add `.env` to `.gitignore` if not already there.

**Step 4: Commit**

```bash
git add src/lib/server/db.ts src/lib/server/schema.sql .env.example .gitignore
git commit -m "feat: add Turso database schema with FTS5 search"
```

---

### Task 3: API Routes — Folders CRUD

**Files:**
- Create: `src/routes/api/folders/+server.ts` (GET all, POST create)
- Create: `src/routes/api/folders/[id]/+server.ts` (PUT update, DELETE)
- Create: `src/lib/server/api-key.ts`

**Step 1: Create API key middleware**

Create `src/lib/server/api-key.ts`:
```typescript
import { API_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';

export function validateApiKey(request: Request) {
  const key = request.headers.get('x-api-key');
  if (API_KEY && key !== API_KEY) {
    throw error(401, 'Invalid API key');
  }
}
```

**Step 2: Create folders endpoints**

Create `src/routes/api/folders/+server.ts`:
```typescript
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  validateApiKey(request);
  const since = url.searchParams.get('since');
  let rows;
  if (since) {
    rows = await db.execute({
      sql: 'SELECT * FROM folders WHERE updated_at > ? ORDER BY sort_order',
      args: [since],
    });
  } else {
    rows = await db.execute('SELECT * FROM folders ORDER BY sort_order');
  }
  return json(rows.rows);
};

export const POST: RequestHandler = async ({ request }) => {
  validateApiKey(request);
  const body = await request.json();
  const { id, name, parentId, sortOrder } = body;
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, name, parentId ?? null, sortOrder ?? 0, now, now],
  });
  return json({ id }, { status: 201 });
};
```

Create `src/routes/api/folders/[id]/+server.ts`:
```typescript
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, params }) => {
  validateApiKey(request);
  const body = await request.json();
  const { name, parentId, sortOrder, updatedAt } = body;
  const now = updatedAt ?? new Date().toISOString();
  await db.execute({
    sql: 'UPDATE folders SET name = ?, parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    args: [name, parentId ?? null, sortOrder ?? 0, now, params.id],
  });
  return json({ id: params.id });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  validateApiKey(request);
  await db.execute({ sql: 'DELETE FROM folders WHERE id = ?', args: [params.id] });
  return json({ id: params.id });
};
```

**Step 3: Commit**

```bash
git add src/routes/api/folders/ src/lib/server/api-key.ts
git commit -m "feat: add folders CRUD API routes"
```

---

### Task 4: API Routes — Notes CRUD + Search

**Files:**
- Create: `src/routes/api/notes/+server.ts` (GET all, POST create)
- Create: `src/routes/api/notes/[id]/+server.ts` (PUT update, DELETE)
- Create: `src/routes/api/search/+server.ts`

**Step 1: Create notes endpoints**

Create `src/routes/api/notes/+server.ts`:
```typescript
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  validateApiKey(request);
  const since = url.searchParams.get('since');
  const folderId = url.searchParams.get('folderId');
  let sql = 'SELECT * FROM notes';
  const args: string[] = [];
  const conditions: string[] = [];

  if (since) {
    conditions.push('updated_at > ?');
    args.push(since);
  }
  if (folderId) {
    conditions.push('folder_id = ?');
    args.push(folderId);
  }
  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY sort_order';

  const rows = await db.execute({ sql, args });
  return json(rows.rows);
};

export const POST: RequestHandler = async ({ request }) => {
  validateApiKey(request);
  const body = await request.json();
  const { id, folderId, title, content, plainText, sortOrder } = body;
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO notes (id, folder_id, title, content, plain_text, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, folderId, title ?? '', content ?? '', plainText ?? '', sortOrder ?? 0, now, now],
  });
  return json({ id }, { status: 201 });
};
```

Create `src/routes/api/notes/[id]/+server.ts`:
```typescript
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, params }) => {
  validateApiKey(request);
  const body = await request.json();
  const { folderId, title, content, plainText, sortOrder, updatedAt } = body;
  const now = updatedAt ?? new Date().toISOString();
  await db.execute({
    sql: 'UPDATE notes SET folder_id = ?, title = ?, content = ?, plain_text = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    args: [folderId, title, content, plainText, sortOrder ?? 0, now, params.id],
  });
  return json({ id: params.id });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  validateApiKey(request);
  await db.execute({ sql: 'DELETE FROM notes WHERE id = ?', args: [params.id] });
  return json({ id: params.id });
};
```

**Step 2: Create search endpoint**

Create `src/routes/api/search/+server.ts`:
```typescript
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  validateApiKey(request);
  const q = url.searchParams.get('q');
  if (!q) return json([]);

  const rows = await db.execute({
    sql: `SELECT notes.*, snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as snippet,
          rank
          FROM notes_fts
          JOIN notes ON notes.rowid = notes_fts.rowid
          WHERE notes_fts MATCH ?
          ORDER BY rank
          LIMIT 20`,
    args: [q + '*'],
  });
  return json(rows.rows);
};
```

**Step 3: Commit**

```bash
git add src/routes/api/notes/ src/routes/api/search/
git commit -m "feat: add notes CRUD and FTS5 search API routes"
```

---

### Task 5: Local Database (Dexie/IndexedDB)

**Files:**
- Create: `src/lib/db.ts` (Dexie schema)
- Create: `src/lib/types.ts` (shared types)

**Step 1: Create shared types**

Create `src/lib/types.ts`:
```typescript
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  folderId: string;
  title: string;
  content: string;
  plainText: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'folder' | 'note';
  action: 'create' | 'update' | 'delete';
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

**Step 2: Create Dexie database**

Create `src/lib/db.ts`:
```typescript
import Dexie, { type Table } from 'dexie';
import type { Folder, Note, SyncQueueItem } from './types';

export class SlateDB extends Dexie {
  folders!: Table<Folder, string>;
  notes!: Table<Note, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('slate');
    this.version(1).stores({
      folders: 'id, parentId, sortOrder, updatedAt',
      notes: 'id, folderId, sortOrder, updatedAt, *plainTextWords',
      syncQueue: 'id, type, entityId, createdAt',
    });
  }
}

export const localDb = new SlateDB();
```

**Step 3: Commit**

```bash
git add src/lib/db.ts src/lib/types.ts
git commit -m "feat: add local Dexie database and shared types"
```

---

### Task 6: Sync Engine

**Files:**
- Create: `src/lib/sync.ts`

**Step 1: Create sync engine**

Create `src/lib/sync.ts`:
```typescript
import { localDb } from './db';
import type { Folder, Note } from './types';
import { v4 as uuid } from 'uuid';

const API_BASE = '/api';

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

async function getLastSyncTime(): Promise<string | null> {
  return localStorage.getItem('slate_last_sync');
}

async function setLastSyncTime(time: string) {
  localStorage.setItem('slate_last_sync', time);
}

export async function pullFromRemote() {
  try {
    const since = await getLastSyncTime();
    const params = since ? `?since=${encodeURIComponent(since)}` : '';

    const [foldersRes, notesRes] = await Promise.all([
      fetch(`${API_BASE}/folders${params}`, { headers: headers() }),
      fetch(`${API_BASE}/notes${params}`, { headers: headers() }),
    ]);

    if (!foldersRes.ok || !notesRes.ok) return;

    const folders: Folder[] = await foldersRes.json();
    const notes: Note[] = await notesRes.json();

    await localDb.transaction('rw', localDb.folders, localDb.notes, async () => {
      for (const f of folders) await localDb.folders.put(f);
      for (const n of notes) await localDb.notes.put(n);
    });

    await setLastSyncTime(new Date().toISOString());
  } catch {
    // Offline — skip pull
  }
}

export async function flushSyncQueue() {
  const items = await localDb.syncQueue.orderBy('createdAt').toArray();
  const succeeded: string[] = [];

  for (const item of items) {
    try {
      const endpoint = `${API_BASE}/${item.type === 'folder' ? 'folders' : 'notes'}`;
      let res: Response;

      if (item.action === 'create') {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(item.payload),
        });
      } else if (item.action === 'update') {
        res = await fetch(`${endpoint}/${item.entityId}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(item.payload),
        });
      } else {
        res = await fetch(`${endpoint}/${item.entityId}`, {
          method: 'DELETE',
          headers: headers(),
        });
      }

      if (res.ok) succeeded.push(item.id);
    } catch {
      break; // Offline — stop flushing
    }
  }

  if (succeeded.length) {
    await localDb.syncQueue.bulkDelete(succeeded);
  }
}

export async function queueSync(
  type: 'folder' | 'note',
  action: 'create' | 'update' | 'delete',
  entityId: string,
  payload: Record<string, unknown> = {}
) {
  await localDb.syncQueue.put({
    id: uuid(),
    type,
    action,
    entityId,
    payload,
    createdAt: new Date().toISOString(),
  });
  // Try to flush immediately
  flushSyncQueue();
}

export async function fullSync() {
  await flushSyncQueue();
  await pullFromRemote();
}
```

**Step 2: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat: add sync engine with queue and pull/push"
```

---

### Task 7: Svelte Stores (State Management)

**Files:**
- Create: `src/lib/stores/folders.ts`
- Create: `src/lib/stores/notes.ts`
- Create: `src/lib/stores/ui.ts`

**Step 1: Create folder store**

Create `src/lib/stores/folders.ts`:
```typescript
import { writable, derived } from 'svelte/store';
import { localDb } from '$lib/db';
import { queueSync } from '$lib/sync';
import { v4 as uuid } from 'uuid';
import type { Folder } from '$lib/types';

export const folders = writable<Folder[]>([]);
export const selectedFolderId = writable<string | null>(null);

export async function loadFolders() {
  const all = await localDb.folders.orderBy('sortOrder').toArray();
  folders.set(all);
}

export async function createFolder(name: string, parentId: string | null = null) {
  const now = new Date().toISOString();
  const folder: Folder = {
    id: uuid(),
    name,
    parentId,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await localDb.folders.put(folder);
  await queueSync('folder', 'create', folder.id, folder as unknown as Record<string, unknown>);
  await loadFolders();
  return folder;
}

export async function updateFolder(id: string, updates: Partial<Folder>) {
  const existing = await localDb.folders.get(id);
  if (!existing) return;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await localDb.folders.put(updated);
  await queueSync('folder', 'update', id, updated as unknown as Record<string, unknown>);
  await loadFolders();
}

export async function deleteFolder(id: string) {
  await localDb.folders.delete(id);
  // Also delete all notes in this folder locally
  await localDb.notes.where('folderId').equals(id).delete();
  await queueSync('folder', 'delete', id);
  await loadFolders();
}
```

**Step 2: Create notes store**

Create `src/lib/stores/notes.ts`:
```typescript
import { writable } from 'svelte/store';
import { localDb } from '$lib/db';
import { queueSync } from '$lib/sync';
import { v4 as uuid } from 'uuid';
import type { Note } from '$lib/types';

export const notes = writable<Note[]>([]);
export const selectedNoteId = writable<string | null>(null);
export const selectedNote = writable<Note | null>(null);

export async function loadNotes(folderId: string) {
  const all = await localDb.notes.where('folderId').equals(folderId).sortBy('sortOrder');
  notes.set(all);
}

export async function createNote(folderId: string) {
  const now = new Date().toISOString();
  const note: Note = {
    id: uuid(),
    folderId,
    title: 'Untitled',
    content: '',
    plainText: '',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await localDb.notes.put(note);
  await queueSync('note', 'create', note.id, note as unknown as Record<string, unknown>);
  await loadNotes(folderId);
  return note;
}

export async function updateNote(id: string, updates: Partial<Note>) {
  const existing = await localDb.notes.get(id);
  if (!existing) return;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await localDb.notes.put(updated);
  await queueSync('note', 'update', id, updated as unknown as Record<string, unknown>);
  selectedNote.set(updated);
}

export async function deleteNote(id: string, folderId: string) {
  await localDb.notes.delete(id);
  await queueSync('note', 'delete', id);
  await loadNotes(folderId);
}
```

**Step 3: Create UI store**

Create `src/lib/stores/ui.ts`:
```typescript
import { writable } from 'svelte/store';

export const searchOpen = writable(false);
export const searchQuery = writable('');
export const mobileView = writable<'folders' | 'notes' | 'editor'>('folders');
```

**Step 4: Commit**

```bash
git add src/lib/stores/
git commit -m "feat: add Svelte stores for folders, notes, and UI state"
```

---

### Task 8: UI — App Layout Shell

**Files:**
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+page.svelte`
- Create: `src/app.css`

**Step 1: Create global styles**

Create `src/app.css` with CSS variables, three-panel grid layout, and base typography. Neutral color scheme, system font stack, dark mode via `prefers-color-scheme`.

**Step 2: Create layout**

Create `src/routes/+layout.svelte` that imports `app.css` and wraps the slot.

**Step 3: Create main page**

Create `src/routes/+page.svelte` with the three-panel grid:
- Left: `<FolderSidebar />`
- Middle: `<NoteList />`
- Right: `<NoteEditor />`

On mount, call `fullSync()` and `loadFolders()`. Set up online/offline event listeners to trigger sync.

**Step 4: Commit**

```bash
git add src/routes/ src/app.css
git commit -m "feat: add three-panel app layout shell"
```

---

### Task 9: UI — Folder Sidebar Component

**Files:**
- Create: `src/lib/components/FolderSidebar.svelte`

**Step 1: Build folder sidebar**

Collapsible tree of folders. "New Folder" button at bottom. Click to select folder and load its notes. Right-click context menu for rename/delete. Highlights selected folder.

**Step 2: Commit**

```bash
git add src/lib/components/FolderSidebar.svelte
git commit -m "feat: add folder sidebar component"
```

---

### Task 10: UI — Note List Component

**Files:**
- Create: `src/lib/components/NoteList.svelte`

**Step 1: Build note list**

Shows notes for selected folder. Each item shows title + first ~80 chars of plainText as preview + relative timestamp. "New Note" button. Click to select and open in editor. Selected note highlighted.

**Step 2: Commit**

```bash
git add src/lib/components/NoteList.svelte
git commit -m "feat: add note list component with previews"
```

---

### Task 11: UI — Tiptap Editor Component

**Files:**
- Create: `src/lib/components/NoteEditor.svelte`

**Step 1: Build editor**

Tiptap WYSIWYG editor with StarterKit (bold, italic, headings, lists, code blocks, blockquote). Editable title field at top. Auto-saves on content change (debounced 500ms). Strips HTML to update `plainText` field on save. Shows empty state when no note selected.

**Step 2: Commit**

```bash
git add src/lib/components/NoteEditor.svelte
git commit -m "feat: add Tiptap WYSIWYG editor component"
```

---

### Task 12: UI — Search Modal

**Files:**
- Create: `src/lib/components/SearchModal.svelte`

**Step 1: Build search modal**

Triggered by `Cmd/Ctrl+K`. Overlay modal with search input. Searches local IndexedDB (filters notes by title and plainText containing query). Shows results with title, folder name, and text snippet. Arrow keys to navigate results, Enter to open, Escape to close. Debounced input (200ms).

**Step 2: Commit**

```bash
git add src/lib/components/SearchModal.svelte
git commit -m "feat: add fuzzy search modal"
```

---

### Task 13: Keyboard Shortcuts

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add global keyboard listeners**

- `Cmd/Ctrl+K` → open search modal
- `Cmd/Ctrl+N` → create new note in current folder, focus editor
- `Escape` → close search modal

Wire into the main page component via `svelte:window` event listener.

**Step 2: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add keyboard shortcuts"
```

---

### Task 14: PWA Setup

**Files:**
- Create: `static/manifest.json`
- Create: `src/service-worker.ts`
- Modify: `src/app.html` (add manifest link)

**Step 1: Create web manifest**

Create `static/manifest.json` with app name "Slate", short_name "Slate", start_url "/", display "standalone", theme colors.

**Step 2: Create service worker**

SvelteKit has built-in service worker support. Create `src/service-worker.ts` that caches the app shell (HTML, CSS, JS) for offline loading.

**Step 3: Add manifest to HTML**

Add `<link rel="manifest" href="/manifest.json">` and meta tags for mobile to `src/app.html`.

**Step 4: Commit**

```bash
git add static/manifest.json src/service-worker.ts src/app.html
git commit -m "feat: add PWA manifest and service worker"
```

---

### Task 15: Database Init Hook

**Files:**
- Create: `src/hooks.server.ts`

**Step 1: Create server hook**

Create `src/hooks.server.ts` that calls `initDb()` on first request to ensure tables exist in Turso.

```typescript
import { initDb } from '$lib/server/db';

let initialized = false;

export async function handle({ event, resolve }) {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
  return resolve(event);
}
```

**Step 2: Commit**

```bash
git add src/hooks.server.ts
git commit -m "feat: add server hook for database initialization"
```

---

### Task 16: Mobile Responsive Layout

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/app.css`

**Step 1: Add responsive behavior**

Use media queries and the `mobileView` store. Below 768px, show only one panel at a time with navigation between them. Add back buttons and swipe hints.

**Step 2: Commit**

```bash
git add src/routes/+page.svelte src/app.css
git commit -m "feat: add mobile responsive layout"
```

---

### Task 17: Polish & Integration Test

**Step 1: Manual integration test**

Run `bun run dev` and verify:
- [ ] Can create, rename, delete folders
- [ ] Can create, edit, delete notes
- [ ] Three-panel layout renders correctly
- [ ] Tiptap editor works (bold, italic, headings, lists)
- [ ] Search modal opens with Cmd/Ctrl+K and finds notes
- [ ] Cmd/Ctrl+N creates new note
- [ ] Notes persist across page reload (IndexedDB)
- [ ] PWA installable (check DevTools > Application > Manifest)

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: polish and integration fixes"
```
