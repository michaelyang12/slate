import { createClient, type Client } from '@libsql/client';
import { TURSO_URL, TURSO_AUTH_TOKEN } from '$env/static/private';

const isConfigured = TURSO_URL && !TURSO_URL.includes('your-db-name');

export const db: Client | null = isConfigured
  ? createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN })
  : null;

export async function initDb() {
  if (!db) {
    console.log('[Slate] Turso not configured — running in local-only mode');
    return;
  }
  const schema = await import('./schema.sql?raw');
  await db.executeMultiple(schema.default);
}
