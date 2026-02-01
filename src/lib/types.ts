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
