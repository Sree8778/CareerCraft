/**
 * Centralized API configuration.
 * All fetch calls should import API_BASE from here instead of hardcoding the URL.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

/** Build an Authorization header from a Firebase ID token or mock token. */
export function authHeader(userId: string): Record<string, string> {
  return { Authorization: `Bearer mock_token_for_${userId}` };
}

/** Convenience: authHeader + JSON content-type. */
export function jsonHeaders(userId: string): Record<string, string> {
  return { ...authHeader(userId), 'Content-Type': 'application/json' };
}

/** Shape of the 402 "no API keys" response from the backend. */
export interface NoApiKeysPayload {
  error: 'no_api_keys';
  message: string;
  action: string;
}

/** Returns true when the backend says the user has no API keys configured. */
export function isNoApiKeysError(status: number, body: unknown): body is NoApiKeysPayload {
  return status === 402 && (body as any)?.error === 'no_api_keys';
}

/**
 * Show a standardised "add your API keys" toast.
 * Pass the `toast` import from 'sonner' and optionally a Next.js `router`.
 */
export function showNoApiKeysToast(
  toastFn: (message: string, options?: any) => void,
  router?: { push: (path: string) => void }
) {
  toastFn('🔑 AI features require your API keys.', {
    description: 'Add your keys in Profile → Settings to unlock all AI-powered features.',
    duration: 6000,
    action: router
      ? { label: 'Add Keys', onClick: () => router.push('/candidate/profile') }
      : undefined,
  });
}

/**
 * Convenience wrapper: fetch an AI endpoint and handle 402 automatically.
 * Returns the parsed JSON body, or null if the user has no keys (and shows the toast).
 */
export async function fetchAi<T = unknown>(
  url: string,
  options: RequestInit,
  toastFn: (message: string, opts?: any) => void,
  router?: { push: (path: string) => void }
): Promise<T | null> {
  const res = await fetch(url, options);
  const body = await res.json();
  if (isNoApiKeysError(res.status, body)) {
    showNoApiKeysToast(toastFn, router);
    return null;
  }
  return body as T;
}
