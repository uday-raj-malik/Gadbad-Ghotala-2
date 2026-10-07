import { sleep } from '@/lib/utils';

/**
 * Single seam between the UI and the backend.
 *
 * `API_BASE` points at the real FastAPI service in backend/ (see its README).
 * Rather than a single global USE_MOCK switch, each live-capable service
 * (sonarService.analyzeScan, recoveryService.generateRoute) tries the real
 * endpoint first via `liveApi` / `isBackendOnline`, and falls back to the
 * mock implementation below if the backend isn't running. Services with no
 * real backend counterpart yet (detections CRUD, waste stage tracking)
 * still resolve mock data — see each file's doc comment.
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';

export async function mock<T>(data: T, ms = 280): Promise<T> {
  await sleep(ms + Math.random() * 160);
  return structuredClone(data);
}
