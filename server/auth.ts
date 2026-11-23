import crypto from 'node:crypto';
import type express from 'express';

export const SESSION_COOKIE_NAME = 'csp_session';
export const ABSOLUTE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const SESSION_COOKIE_SECRET =
  process.env.SESSION_COOKIE_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

export function getIdleTimeoutMs(): number {
  const mins = Number(process.env.AUTH_IDLE_TIMEOUT_MINUTES);
  if (Number.isFinite(mins) && mins >= 1 && mins <= 1440) {
    return Math.round(mins * 60 * 1000);
  }
  return 30 * 60 * 1000;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export interface EnvAuthCredential {
  username: string;
  passwordHash?: string;
  plainPassword?: string;
}

export function getEnvAuthCredential(): EnvAuthCredential | null {
  const rawUser = process.env.AUTH_EMAIL?.trim() || process.env.AUTH_USERNAME?.trim();
  const username = rawUser ? rawUser.toLowerCase() : '';
  const passwordHash = process.env.AUTH_PASSWORD_HASH?.trim();
  const plainPassword = process.env.AUTH_PASSWORD?.trim();
  if (!username) return null;
  if (passwordHash) {
    return { username, passwordHash };
  }
  if (plainPassword) {
    return { username, plainPassword };
  }
  return null;
}

export function signSessionId(sessionId: string): string {
  const sig = crypto
    .createHmac('sha256', SESSION_COOKIE_SECRET)
    .update(sessionId)
    .digest('base64url');
  return `${sessionId}.${sig}`;
}

export function verifySignedSessionCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const dotIdx = cookieValue.indexOf('.');
  if (dotIdx <= 0) return null;
  const sessionId = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);
  if (!sessionId || !sig || !/^[a-f0-9-]{16,128}$/i.test(sessionId)) {
    return null;
  }

  const expected = crypto
    .createHmac('sha256', SESSION_COOKIE_SECRET)
    .update(sessionId)
    .digest('base64url');

  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return null;
  if (!crypto.timingSafeEqual(bufA, bufB)) return null;
  return sessionId;
}

export function parseCookieValue(
  rawCookieHeader: string | undefined,
  name: string = SESSION_COOKIE_NAME
): string | undefined {
  if (!rawCookieHeader) return undefined;
  const pairs = rawCookieHeader.split(';');
  for (const part of pairs) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return undefined;
}

export function isHttpsRequest(req: express.Request): boolean {
  if (req.secure) return true;
  const proto = req.header('x-forwarded-proto')?.split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

export function buildSessionCookieHeader(
  signedValue: string,
  maxAgeSeconds: number,
  https: boolean
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(signedValue)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (https) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

export function buildClearSessionCookieHeader(https: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (https) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

export function isTrustedMutationRequest(req: express.Request): boolean {
  const origin = req.header('origin');
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0].trim().toLowerCase();
  const hostHeader = (forwardedHost || req.header('host') || '').trim().toLowerCase();

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!hostHeader || originHost !== hostHeader) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  return req.header('x-requested-with') === 'XMLHttpRequest';
}
