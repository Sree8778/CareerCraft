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
