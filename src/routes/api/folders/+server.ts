import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validateApiKey } from '$lib/server/api-key';
import type { RequestHandler } from './$types';

function mapFolder(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? null,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const GET: RequestHandler = async ({ request, url }) => {
  validateApiKey(request);
  if (!db) return json([]);
  const since = url.searchParams.get('since');
  let rows;
  if (since) {
    rows = await db.execute({
      sql: 'SELECT * FROM folders WHERE updated_at > ? ORDER BY sort_order',
      args: [since],
    });
  } else {
    rows = await db.execute('SELECT * FROM folders ORDER BY sort_order');
  }
  return json(rows.rows.map(mapFolder));
};

export const POST: RequestHandler = async ({ request }) => {
  validateApiKey(request);
  if (!db) return json({ error: 'Database not configured' }, { status: 503 });
  const body = await request.json();
  const { id, name, parentId, sortOrder } = body;
  const now = new Date().toISOString();
  await db.execute({
    sql: 'INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, name, parentId ?? null, sortOrder ?? 0, now, now],
  });
  return json({ id }, { status: 201 });
};
