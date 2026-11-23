import crypto from 'node:crypto';
import {
  SecurityChallenge,
  SecurityChallengeMode,
  SecurityChallengeToken,
  SecurityMetricsSnapshot,
  SecurityProtectionItem,
} from '../src/types/survey';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_PENDING_CHALLENGES = 2000;
const MAX_REVOKED_TOKENS = 2000;

const SECURITY_SECRET =
  process.env.SECURITY_TOKEN_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

interface PendingChallenge {
  answerHashHex: string;
  mode: SecurityChallengeMode;
  expiresAt: number;
}

export interface VerifiedTokenPayload {
  jti: string;
  mode: SecurityChallengeMode;
  iat: number;
  exp: number;
}

export class SlidingWindowLimiter {
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly hits = new Map<string, number[]>();

  constructor(windowMs: number, maxAttempts: number) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
  }

  private pruneKey(key: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((ts) => ts > cutoff);
    if (list.length === 0) {
      this.hits.delete(key);
    } else {
      this.hits.set(key, list);
    }
    return list;
  }

  isBlocked(key: string, now = Date.now()): { blocked: boolean; retryAfterSeconds: number; remaining: number } {
    const list = this.pruneKey(key, now);
    if (list.length >= this.maxAttempts) {
      const oldest = list[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return { blocked: true, retryAfterSeconds, remaining: 0 };
    }
    return {
      blocked: false,
      retryAfterSeconds: 0,
      remaining: Math.max(0, this.maxAttempts - list.length),
    };
  }

  consume(key: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const status = this.isBlocked(key, now);
    if (status.blocked) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: status.retryAfterSeconds,
      };
    }

    const list = this.hits.get(key) ?? [];
    list.push(now);
    this.hits.set(key, list);

    return {
      allowed: true,
      remaining: Math.max(0, this.maxAttempts - list.length),
      retryAfterSeconds: 0,
    };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

const pendingChallenges = new Map<string, PendingChallenge>();
const revokedTokenIds = new Set<string>();

const metrics = {
  verifiedSessions: 0,
  failedChallenges: 0,
  blockedBots: 0,
  rateLimitedRequests: 0,
  failedAdminLogins: 0,
};

export const verifyLimiter = new SlidingWindowLimiter(5 * 60 * 1000, 20);
export const adminLoginLimiter = new SlidingWindowLimiter(10 * 60 * 1000, 5);
export const surveySubmitLimiter = new SlidingWindowLimiter(10 * 60 * 1000, 15);
export const aiChatLimiter = new SlidingWindowLimiter(5 * 60 * 1000, 30);
export const chatBoardLimiter = new SlidingWindowLimiter(5 * 60 * 1000, 15);

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeDigestEqual(a: string, b: string): boolean {
  const bufA = crypto.createHash('sha256').update(a).digest();
  const bufB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

function pruneChallenges(now: number): void {
  for (const [id, entry] of pendingChallenges.entries()) {
    if (entry.expiresAt <= now) {
      pendingChallenges.delete(id);
    }
  }
  while (pendingChallenges.size > MAX_PENDING_CHALLENGES) {
    const firstKey = pendingChallenges.keys().next().value;
    if (!firstKey) break;
    pendingChallenges.delete(firstKey);
  }
}

export function verifyAdminPasscode(candidate: string, expectedPasscode: string): boolean {
  if (!candidate || !expectedPasscode) return false;
  return safeDigestEqual(candidate, expectedPasscode);
}

export function createSecurityChallenge(
  mode: SecurityChallengeMode = 'code',
  now = Date.now()
): SecurityChallenge {
  pruneChallenges(now);
  const challengeId = crypto.randomUUID();
  const expiresAt = now + CHALLENGE_TTL_MS;

  if (mode === 'math') {
    const left = crypto.randomInt(3, 16);
    const right = crypto.randomInt(2, 13);
    const answer = String(left + right);
    const prompt = `${left} + ${right} = ?`;

    pendingChallenges.set(challengeId, {
      answerHashHex: sha256Hex(`${answer}:${challengeId}`),
      mode: 'math',
      expiresAt,
    });

    return {
      challengeId,
      mode: 'math',
      prompt,
      tokens: [],
      expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
    };
  }

  const tokens: SecurityChallengeToken[] = [];
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    const ch = CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
    const tilt = crypto.randomInt(-8, 9);
    code += ch;
    tokens.push({ ch, tilt });
  }

  pendingChallenges.set(challengeId, {
    answerHashHex: sha256Hex(`${code}:${challengeId}`),
    mode: 'code',
    expiresAt,
  });

  return {
    challengeId,
    mode: 'code',
    prompt: 'Enter the 5-character verification code displayed below (case-insensitive).',
    tokens,
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
  };
}

function signTokenPayload(payload: VerifiedTokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', SECURITY_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `v1.${payloadB64}.${sigB64}`;
}

export function verifySecurityToken(
  token: string | undefined | null,
  now = Date.now()
): VerifiedTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;

  const [, payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSigB64 = crypto
    .createHmac('sha256', SECURITY_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64);
  const expectedBuf = Buffer.from(expectedSigB64);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as Partial<VerifiedTokenPayload>;
    if (
      typeof parsed.jti !== 'string' ||
      (parsed.mode !== 'code' && parsed.mode !== 'math') ||
      typeof parsed.iat !== 'number' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (revokedTokenIds.has(parsed.jti)) {
      return null;
    }
    if (parsed.exp <= now) {
      return null;
    }
    return parsed as VerifiedTokenPayload;
  } catch {
    return null;
  }
}

export function revokeSecurityToken(token: string | undefined | null): void {
  const verified = verifySecurityToken(token);
  if (!verified) return;
  if (revokedTokenIds.size >= MAX_REVOKED_TOKENS) {
    const first = revokedTokenIds.values().next().value;
    if (first) revokedTokenIds.delete(first);
  }
  revokedTokenIds.add(verified.jti);
}

export function verifySecurityChallenge(input: {
  challengeId?: unknown;
  answer?: unknown;
  honeypot?: unknown;
  now?: number;
}):
  | { ok: true; token: string; expiresAt: number; mode: SecurityChallengeMode }
  | { ok: false; status: number; error: string } {
  const now = input.now ?? Date.now();
  const honeypot = typeof input.honeypot === 'string' ? input.honeypot.trim() : '';
  if (honeypot.length > 0) {
    metrics.blockedBots += 1;
    return {
      ok: false,
      status: 403,
      error: 'Automated submission detected by bot protection.',
    };
  }

  const challengeId = typeof input.challengeId === 'string' ? input.challengeId.trim() : '';
  const answer = typeof input.answer === 'string' ? input.answer.trim().toUpperCase() : '';

  if (!challengeId || !answer) {
    return {
      ok: false,
      status: 400,
      error: 'Please enter the verification answer before continuing.',
    };
  }

  const entry = pendingChallenges.get(challengeId);
  if (!entry) {
    metrics.failedChallenges += 1;
    return {
      ok: false,
      status: 400,
      error: 'Verification challenge expired or was already used. Please solve the new challenge.',
    };
  }

  // Single-use challenge consumption prevents replay attacks
  pendingChallenges.delete(challengeId);

  if (now > entry.expiresAt) {
    metrics.failedChallenges += 1;
    return {
      ok: false,
      status: 400,
      error: 'Verification challenge expired. Please solve the new challenge.',
    };
  }

  const candidateHash = sha256Hex(`${answer}:${challengeId}`);
  const expectedBuf = Buffer.from(entry.answerHashHex, 'hex');
  const actualBuf = Buffer.from(candidateHash, 'hex');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    metrics.failedChallenges += 1;
    return {
      ok: false,
      status: 400,
      error: 'Incorrect verification answer. A fresh challenge has been generated.',
    };
  }

  metrics.verifiedSessions += 1;
  const payload: VerifiedTokenPayload = {
    jti: crypto.randomUUID(),
    mode: entry.mode,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const token = signTokenPayload(payload);
  return {
    ok: true,
    token,
    expiresAt: payload.exp,
    mode: entry.mode,
  };
}

export function recordRateLimitHit(): void {
  metrics.rateLimitedRequests += 1;
}

export function recordBlockedBot(): void {
  metrics.blockedBots += 1;
}

export function recordFailedAdminLogin(): void {
  metrics.failedAdminLogins += 1;
}

export function getActiveProtections(requireSiteGate: boolean): SecurityProtectionItem[] {
  return [
    {
      id: 'human-gate',
      label: 'Human Challenge-Response Verification',
      detail: requireSiteGate
        ? 'Site-wide entry verification + submission protection active'
        : 'Protected survey submission & admin sign-in verification active',
      active: true,
    },
    {
      id: 'hmac-tokens',
      label: 'Server-Signed HMAC-SHA256 Tokens',
      detail: 'Single-use challenges and 2-hour tamper-proof verification tokens',
      active: true,
    },
    {
      id: 'rate-limiting',
      label: 'Brute-Force & Spam Rate Limiting',
      detail: 'Sliding-window IP throttling on login, survey POST, AI chat, and verification',
      active: true,
    },
    {
      id: 'sqlite-parameterized',
      label: 'Parameterized SQLite & Input Validation',
      detail: 'Strict schema enforcement and prepared statements across all DB operations',
      active: true,
    },
    {
      id: 'security-headers',
      label: 'HTTP Security Headers & Honeypot Trap',
      detail: 'X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and bot traps',
      active: true,
    },
    {
      id: 'admin-session-hygiene',
      label: 'Timing-Safe Admin Auth & Memory Tokens',
      detail: 'Constant-time passcode checks with TTL-bound Bearer tokens held in memory',
      active: true,
    },
  ];
}

export function getSecurityMetrics(activeAdminSessions: number): SecurityMetricsSnapshot {
  return {
    ...metrics,
    activeAdminSessions,
    pendingChallenges: pendingChallenges.size,
  };
}

export function resetSecurityStateForTests(): void {
  pendingChallenges.clear();
  revokedTokenIds.clear();
  metrics.verifiedSessions = 0;
  metrics.failedChallenges = 0;
  metrics.blockedBots = 0;
  metrics.rateLimitedRequests = 0;
  metrics.failedAdminLogins = 0;
}
