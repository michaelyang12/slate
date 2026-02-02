import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  validateApiKey(request);
  const q = url.searchParams.get('q');
  if (!q) return json([]);

  if (!db) return json([]);
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
  return json(rows.rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    folderId: row.folder_id,
    title: row.title ?? '',
    content: row.content ?? '',
    plainText: row.plain_text ?? '',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    snippet: row.snippet,
  })));
};
