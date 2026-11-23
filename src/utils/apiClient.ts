export const AUTH_EXPIRED_EVENT = 'csp-auth-expired';

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }

  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (response.status === 401) {
    try {
      const cloned = response.clone();
      const body = (await cloned.json()) as { code?: string };
      if (body?.code === 'AUTH_REQUIRED') {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      }
    } catch {
      // Ignore non-JSON 401 responses
    }
  }

  return response;
}
