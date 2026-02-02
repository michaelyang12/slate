import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, params }) => {
  validateApiKey(request);
  if (!db) return json({ error: 'Database not configured' }, { status: 503 });
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
  if (!db) return json({ error: 'Database not configured' }, { status: 503 });
  await db.execute({ sql: 'DELETE FROM notes WHERE id = ?', args: [params.id] });
  return json({ id: params.id });
};
