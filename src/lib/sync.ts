import { localDb } from './db';
import type { Folder, Note } from './types';
import { v4 as uuid } from 'uuid';

const API_BASE = '/api';

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

function getLastSyncTime(): string | null {
  return localStorage.getItem('slate_last_sync');
}

function setLastSyncTime(time: string) {
  localStorage.setItem('slate_last_sync', time);
}

export async function pullFromRemote() {
  try {
    const since = getLastSyncTime();
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

    setLastSyncTime(new Date().toISOString());
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
  flushSyncQueue();
}

export async function fullSync() {
  await flushSyncQueue();
  await pullFromRemote();
}
