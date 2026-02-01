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
