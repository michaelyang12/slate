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
  await loadNotes(updated.folderId);
}

export async function deleteNote(id: string, folderId: string) {
  await localDb.notes.delete(id);
  await queueSync('note', 'delete', id);
  await loadNotes(folderId);
}
