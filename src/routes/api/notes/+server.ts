import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

function mapNote(row: Record<string, unknown>) {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title ?? '',
    content: row.content ?? '',
    plainText: row.plain_text ?? '',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const GET: RequestHandler = async ({ request, url }) => {
  validateApiKey(request);
  if (!db) return json([]);
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
  return json(rows.rows.map(mapNote));
};

export const POST: RequestHandler = async ({ request }) => {
  validateApiKey(request);
  if (!db) return json({ error: 'Database not configured' }, { status: 503 });
  const body = await request.json();
  const { id, folderId, title, content, plainText, sortOrder } = body;
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO notes (id, folder_id, title, content, plain_text, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, folderId, title ?? '', content ?? '', plainText ?? '', sortOrder ?? 0, now, now],
  });
  return json({ id }, { status: 201 });
};
