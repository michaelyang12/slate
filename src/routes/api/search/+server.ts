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
