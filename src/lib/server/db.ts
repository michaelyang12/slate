import { createClient } from '@libsql/client';
import { TURSO_URL, TURSO_AUTH_TOKEN } from '$env/static/private';

export const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

export async function initDb() {
  const schema = await import('./schema.sql?raw');
  const statements = schema.default.split(';').filter((s: string) => s.trim());
  for (const stmt of statements) {
    await db.execute(stmt);
  }
}
