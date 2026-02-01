import { initDb } from '$lib/server/db';
import type { Handle } from '@sveltejs/kit';

let initialized = false;

export const handle: Handle = async ({ event, resolve }) => {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
  return resolve(event);
};
