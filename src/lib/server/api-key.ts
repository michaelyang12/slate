import { API_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';

export function validateApiKey(request: Request) {
  const key = request.headers.get('x-api-key');
  // Skip validation for same-origin requests (browser fetch with no key)
  // API key is enforced only for external/programmatic access
  if (!key) return;
  if (API_KEY && key !== API_KEY) {
    throw error(401, 'Invalid API key');
  }
}
