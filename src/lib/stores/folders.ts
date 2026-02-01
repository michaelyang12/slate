import { writable } from 'svelte/store';
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
  await localDb.notes.where('folderId').equals(id).delete();
  await queueSync('folder', 'delete', id);
  await loadFolders();
}
