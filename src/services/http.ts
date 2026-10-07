import { sleep } from '@/lib/utils';

/**
 * Single seam between the UI and the backend.
 * Today every service resolves mock data after a short delay.
 * To connect FastAPI later: set USE_MOCK = false and implement `request`
 * with fetch(`${API_BASE}${path}`), or replace the body of each service function.
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';
export const USE_MOCK = true;

export async function mock<T>(data: T, ms = 280): Promise<T> {
  await sleep(ms + Math.random() * 160);
  return structuredClone(data);
}
