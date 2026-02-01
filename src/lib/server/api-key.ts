import { API_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';

export function validateApiKey(request: Request) {
  const key = request.headers.get('x-api-key');
  if (API_KEY && key !== API_KEY) {
    throw error(401, 'Invalid API key');
  }
}
