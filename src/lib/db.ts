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
      notes: 'id, folderId, sortOrder, updatedAt',
      syncQueue: 'id, type, entityId, createdAt',
    });
  }
}

export const localDb = new SlateDB();
