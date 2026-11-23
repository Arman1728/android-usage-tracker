import express from 'express';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  addWeeklyPhoto,
  clearSampleResponses,
  createAuthSession,
  createAuthUser,
  deleteAuthSession,
  deleteChatBoardMessageById,
  deleteOtherAuthSessions,
  deleteResponseById,
  deleteWeeklyPhoto,
  getAuthSession,
  getAuthUserByUsername,
  getAuthUserCount,
  getChatBoardMessages,
  getCounts,
  getDb,
  getProjectSettings,
  getResponses,
  getWeeklyActivities,
  insertChatBoardMessage,
  insertSurveyResponse,
  restoreSampleResponses,
  touchAuthSession,
  updateAuthUserPassword,
  updateProjectSettings,
  updateWeeklyActivity,
} from './server/db';
import {
  ABSOLUTE_SESSION_TTL_MS,
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  getEnvAuthCredential,
  getIdleTimeoutMs,
  hashPassword,
  isHttpsRequest,
  isTrustedMutationRequest,
  parseCookieValue,
  signSessionId,
  timingSafeStringEqual,
  verifyPassword,
  verifySignedSessionCookie,
} from './server/auth';
import {
  validateAutoAccountInput,
  validateChangePasswordInput,
  validateLoginInput,
  validateRegisterInput,
} from './src/utils/authLogic';
import {
  computeActivityProgress,
  validatePhotoUpload,
  validateWeeklyActivityUpdate,
} from './src/utils/activityLogic';
import { validateChatBoardInput } from './src/utils/chatBoardLogic';
import {
  computeAnalytics,
  generateFindings,
  serializeResponsesToCsv,
  validateSurveyInput,
} from './src/utils/surveyLogic';
import { validateChatPayload } from './src/utils/aiContext';
import { AiServiceError, generateResearchBotReply } from './server/ai';
import { attachLiveVoiceWebSocket } from './server/live';
import {
  adminLoginLimiter,
  aiChatLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  chatBoardLimiter,
  getActiveProtections,
  getSecurityMetrics,
  recordBlockedBot,
  recordFailedAdminLogin,
  recordRateLimitHit,
  surveySubmitLimiter,
  verifyAdminPasscode,
} from './server/security';
import { DatasetScope, ProjectSettings, SurveyInput } from './src/types/survey';

dotenv.config();

function resolvePort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice(7));
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    } else if (arg === '--port' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  const envPort = Number(process.env.PORT);
  if (process.env.NODE_ENV !== 'production' && envPort === 8080) {
    return 3000;
  }
  return Number.isInteger(envPort) && envPort > 0 ? envPort : 3000;
}

const PORT = resolvePort();
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '12345';
const TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
const ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const activeAdminTokens = new Map<string, number>();

function parseScope(raw: unknown): DatasetScope {
  if (raw === 'real' || raw === 'sample' || raw === 'all') {
    return raw;
  }
  return 'all';
}

function getClientIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function pruneExpiredAdminTokens(now = Date.now()): void {
  for (const [token, expiresAt] of activeAdminTokens.entries()) {
    if (expiresAt <= now) {
      activeAdminTokens.delete(token);
    }
  }
}

function issueAdminToken(): string {
  pruneExpiredAdminTokens();
  const token = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${Date.now()}-${crypto.randomUUID()}`)
    .digest('hex');
  activeAdminTokens.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
  return token;
}

function extractAdminToken(req: express.Request): string | undefined {
  const auth = req.header('authorization');
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return req.header('x-admin-token') || undefined;
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  pruneExpiredAdminTokens();
  const token = extractAdminToken(req);
  const expiresAt = token ? activeAdminTokens.get(token) : undefined;
  if (!token || !expiresAt || expiresAt <= Date.now()) {
    if (token) activeAdminTokens.delete(token);
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}


function requireAuthSession(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const isMutation =
    req.method === 'POST' ||
    req.method === 'PUT' ||
    req.method === 'PATCH' ||
    req.method === 'DELETE';

  if (isMutation && !isTrustedMutationRequest(req)) {
    res.status(403).json({
      error: 'Cross-origin mutation request rejected.',
      code: 'CSRF_ORIGIN_MISMATCH',
    });
    return;
  }

  const rawCookie = parseCookieValue(req.headers.cookie);
  const sessionId = verifySignedSessionCookie(rawCookie);
  const now = Date.now();
  const idleTimeoutMs = getIdleTimeoutMs();
  const https = isHttpsRequest(req);

  const session = sessionId ? touchAuthSession(sessionId, now, idleTimeoutMs) : null;
  if (!session) {
    if (rawCookie) {
      res.setHeader('Set-Cookie', buildClearSessionCookieHeader(https));
    }
    res.status(401).json({
      error: 'Authentication required. Please log in to continue.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  res.locals.authSession = session;
  const signed = signSessionId(session.sessionId);
  res.setHeader(
    'Set-Cookie',
    buildSessionCookieHeader(signed, Math.ceil((session.expiresAt - now) / 1000), https)
  );
  next();
}

async function startServer() {
  // Initialize SQLite database and sample seed on boot
  getDb();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  // Baseline HTTP security headers (iframe-safe for preview environments)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Portal email + password authentication endpoints (HTTP-only session cookie + scrypt)
  app.get('/api/auth/session', (req, res) => {
    const envCred = getEnvAuthCredential();
    const hasUsers = Boolean(envCred) || getAuthUserCount() > 0;
    const rawCookie = parseCookieValue(req.headers.cookie);
    const sessionId = verifySignedSessionCookie(rawCookie);
    const now = Date.now();
    const idleTimeoutMs = getIdleTimeoutMs();
    const https = isHttpsRequest(req);

    const shouldTouch = req.query.touch === '1';
    const session = sessionId
      ? shouldTouch
        ? touchAuthSession(sessionId, now, idleTimeoutMs)
        : getAuthSession(sessionId, now)
      : null;

    if (!session) {
      if (rawCookie) {
        res.setHeader('Set-Cookie', buildClearSessionCookieHeader(https));
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        authenticated: false,
        hasUsers,
        user: null,
        idleTimeoutMs,
        expiresAt: null,
      });
      return;
    }

    if (shouldTouch) {
      const signed = signSessionId(session.sessionId);
      res.setHeader(
        'Set-Cookie',
        buildSessionCookieHeader(signed, Math.ceil((session.expiresAt - now) / 1000), https)
      );
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      authenticated: true,
      hasUsers: true,
      user: { username: session.username, role: session.role },
      idleTimeoutMs,
      expiresAt: session.expiresAt,
    });
  });

  app.post('/api/auth/register', (req, res) => {
    if (!isTrustedMutationRequest(req)) {
      res.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }

    const ip = getClientIp(req);
    const lock = authLoginLimiter.isBlocked(`register:${ip}`);
    if (lock.blocked) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(lock.retryAfterSeconds));
      res.status(429).json({
        error: `Too many registration attempts. Please wait ${lock.retryAfterSeconds}s and try again.`,
      });
      return;
    }

    const check = validateRegisterInput(req.body);
    if (!check.valid || !check.email || !check.password) {
      authLoginLimiter.consume(`register:${ip}`);
      res.status(400).json({ error: check.error || 'Please enter a valid email and password.' });
      return;
    }

    const envCred = getEnvAuthCredential();
    if (envCred && timingSafeStringEqual(check.email, envCred.username)) {
      authLoginLimiter.consume(`register:${ip}`);
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
      });
      return;
    }

    const passwordHash = hashPassword(check.password);
    const created = createAuthUser(check.email, passwordHash);
    if (!created.created || !created.user) {
      authLoginLimiter.consume(`register:${ip}`);
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
      });
      return;
    }

    authLoginLimiter.reset(`register:${ip}`);
    const now = Date.now();
    const idleTimeoutMs = getIdleTimeoutMs();
    const sessionId = crypto.randomUUID();
    const session = createAuthSession({
      sessionId,
      username: created.user.username,
      role: created.user.role,
      now,
      idleTimeoutMs,
      maxTtlMs: ABSOLUTE_SESSION_TTL_MS,
    });

    const https = isHttpsRequest(req);
    const signed = signSessionId(sessionId);
    res.setHeader(
      'Set-Cookie',
      buildSessionCookieHeader(signed, Math.ceil(idleTimeoutMs / 1000), https)
    );
    res.status(201).json({
      authenticated: true,
      hasUsers: true,
      user: created.user,
      idleTimeoutMs,
      expiresAt: session.expiresAt,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!isTrustedMutationRequest(req)) {
      res.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }

    const ip = getClientIp(req);
    const lockStatus = authLoginLimiter.isBlocked(ip);
    if (lockStatus.blocked) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(lockStatus.retryAfterSeconds));
      res.status(429).json({
        error: `Too many failed log in attempts. Please wait ${lockStatus.retryAfterSeconds}s and try again.`,
      });
      return;
    }

    const parsed = validateLoginInput(req.body);
    if (!parsed.valid || !parsed.identifier || !parsed.password) {
      authLoginLimiter.consume(ip);
      res.status(401).json({ error: 'Invalid username/email or password' });
      return;
    }

    const envCred = getEnvAuthCredential();
    let authenticatedUser: { username: string; role: string } | null = null;

    if (envCred && timingSafeStringEqual(parsed.identifier, envCred.username)) {
      const passMatches = envCred.passwordHash
        ? verifyPassword(parsed.password, envCred.passwordHash)
        : Boolean(
            envCred.plainPassword &&
              timingSafeStringEqual(parsed.password, envCred.plainPassword)
          );
      if (!passMatches) {
        const attempt = authLoginLimiter.consume(ip);
        if (!attempt.allowed) {
          res.setHeader('Retry-After', String(attempt.retryAfterSeconds));
          res.status(429).json({
            error: `Too many failed log in attempts. Locked for ${attempt.retryAfterSeconds}s.`,
          });
          return;
        }
        res.status(401).json({ error: 'Invalid username/email or password' });
        return;
      }
      authenticatedUser = { username: envCred.username, role: 'researcher' };
    }

    if (!authenticatedUser) {
      const storedUser = getAuthUserByUsername(parsed.identifier);
      if (storedUser) {
        if (!verifyPassword(parsed.password, storedUser.passwordHash)) {
          const attempt = authLoginLimiter.consume(ip);
          if (!attempt.allowed) {
            res.setHeader('Retry-After', String(attempt.retryAfterSeconds));
            res.status(429).json({
              error: `Too many failed log in attempts. Locked for ${attempt.retryAfterSeconds}s.`,
            });
            return;
          }
          res.status(401).json({ error: 'Invalid username/email or password' });
          return;
        }
        authenticatedUser = { username: storedUser.username, role: storedUser.role };
      } else if (!parsed.identifier.includes('@')) {
        const attempt = authLoginLimiter.consume(ip);
        if (!attempt.allowed) {
          res.setHeader('Retry-After', String(attempt.retryAfterSeconds));
          res.status(429).json({
            error: `Too many failed log in attempts. Locked for ${attempt.retryAfterSeconds}s.`,
          });
          return;
        }
        res.status(401).json({ error: 'Invalid username/email or password' });
        return;
      } else {
        const regLimit = authRegisterLimiter.consume(`auto-reg:${ip}`);
        if (!regLimit.allowed) {
          recordRateLimitHit();
          res.setHeader('Retry-After', String(regLimit.retryAfterSeconds));
          res.status(429).json({
            error: `Too many log in attempts. Please wait ${regLimit.retryAfterSeconds}s and try again.`,
          });
          return;
        }

        const regCheck = validateAutoAccountInput({
          email: parsed.identifier,
          password: parsed.password,
        });
        if (!regCheck.valid || !regCheck.email || !regCheck.password) {
          res.status(400).json({
            error: regCheck.error || 'Please enter a valid email address and password.',
          });
          return;
        }

        const passwordHash = hashPassword(regCheck.password);
        const created = createAuthUser(regCheck.email, passwordHash);
        if (!created.created || !created.user) {
          res.status(401).json({ error: 'Invalid username/email or password' });
          return;
        }
        authenticatedUser = created.user;
      }
    }

    authLoginLimiter.reset(ip);
    const now = Date.now();
    const idleTimeoutMs = getIdleTimeoutMs();
    const sessionId = crypto.randomUUID();
    const session = createAuthSession({
      sessionId,
      username: authenticatedUser.username,
      role: authenticatedUser.role,
      now,
      idleTimeoutMs,
      maxTtlMs: ABSOLUTE_SESSION_TTL_MS,
    });

    const https = isHttpsRequest(req);
    const signed = signSessionId(sessionId);
    res.setHeader(
      'Set-Cookie',
      buildSessionCookieHeader(signed, Math.ceil(idleTimeoutMs / 1000), https)
    );
    res.json({
      authenticated: true,
      hasUsers: true,
      user: authenticatedUser,
      idleTimeoutMs,
      expiresAt: session.expiresAt,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (!isTrustedMutationRequest(req)) {
      res.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }

    const rawCookie = parseCookieValue(req.headers.cookie);
    const sessionId = verifySignedSessionCookie(rawCookie);
    if (sessionId) {
      deleteAuthSession(sessionId);
    }
    const https = isHttpsRequest(req);
    res.setHeader('Set-Cookie', buildClearSessionCookieHeader(https));
    res.json({ ok: true });
  });

  app.post('/api/auth/ping', requireAuthSession, (req, res) => {
    const rawCookie = parseCookieValue(req.headers.cookie);
    const sessionId = verifySignedSessionCookie(rawCookie);
    const session = sessionId ? getAuthSession(sessionId) : null;
    res.json({
      ok: true,
      expiresAt: session?.expiresAt ?? null,
    });
  });

  app.post('/api/auth/change-password', requireAuthSession, (req, res) => {
    const session = res.locals.authSession as
      | { sessionId: string; username: string; role: string }
      | undefined;
    if (!session) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const rateKey = `pw:${session.username.toLowerCase()}:${getClientIp(req)}`;
    const lockStatus = authLoginLimiter.isBlocked(rateKey);
    if (lockStatus.blocked) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(lockStatus.retryAfterSeconds));
      res.status(429).json({
        error: `Too many password change attempts. Please wait ${lockStatus.retryAfterSeconds}s and try again.`,
      });
      return;
    }

    const check = validateChangePasswordInput(req.body);
    if (!check.valid || !check.currentPassword || !check.newPassword) {
      res.status(400).json({ error: check.error || 'Invalid password input.' });
      return;
    }

    const storedUser = getAuthUserByUsername(session.username);
    if (!storedUser) {
      res.status(400).json({
        error: 'Environment-configured account passwords must be updated in server settings.',
      });
      return;
    }

    if (!verifyPassword(check.currentPassword, storedUser.passwordHash)) {
      const attempt = authLoginLimiter.consume(rateKey);
      if (!attempt.allowed) {
        res.setHeader('Retry-After', String(attempt.retryAfterSeconds));
        res.status(429).json({
          error: `Too many incorrect current password attempts. Locked for ${attempt.retryAfterSeconds}s.`,
        });
        return;
      }
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const updated = updateAuthUserPassword(
      storedUser.username,
      hashPassword(check.newPassword)
    );
    if (!updated) {
      res.status(500).json({ error: 'Unable to update password right now.' });
      return;
    }

    deleteOtherAuthSessions(storedUser.username, session.sessionId);
    authLoginLimiter.reset(rateKey);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  // Require valid authenticated portal session on all protected backend APIs
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/auth/')) {
      next();
      return;
    }
    requireAuthSession(req, res, next);
  });


  app.get('/api/settings', (_req, res) => {
    res.json({ settings: getProjectSettings() });
  });

  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const current = getProjectSettings();
    const body = req.body as Partial<ProjectSettings>;
    if (!body.collegeName || body.collegeName.trim().length < 3) {
      res.status(400).json({ error: 'College name must be at least 3 characters.' });
      return;
    }
    const updated = updateProjectSettings({
      collegeName: body.collegeName,
      department: body.department || current.department,
      academicBatch: body.academicBatch || current.academicBatch,
      requireSiteGate:
        typeof body.requireSiteGate === 'boolean'
          ? body.requireSiteGate
          : current.requireSiteGate,
    });
    res.json({ settings: updated });
  });

  app.get('/api/admin/security', requireAdmin, (_req, res) => {
    pruneExpiredAdminTokens();
    const settings = getProjectSettings();
    res.json({
      requireSiteGate: settings.requireSiteGate,
      metrics: getSecurityMetrics(activeAdminTokens.size),
      protections: getActiveProtections(settings.requireSiteGate),
    });
  });

  app.get('/api/responses', (req, res) => {
    const scope = parseScope(req.query.scope);
    const responses = getResponses(scope);
    const counts = getCounts();
    const analytics = computeAnalytics(responses);
    const findings = generateFindings(responses);
    const settings = getProjectSettings();
    res.json({
      scope,
      counts,
      responses,
      analytics,
      findings,
      settings,
    });
  });

  app.post('/api/responses', (req, res) => {
    const ip = getClientIp(req);
    const rate = surveySubmitLimiter.consume(ip);
    if (!rate.allowed) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({
        error: `Submission rate limit reached. Please wait ${rate.retryAfterSeconds}s before submitting again.`,
      });
      return;
    }

    const body = (req.body || {}) as Partial<SurveyInput> & { _hp?: unknown };
    if (typeof body._hp === 'string' && body._hp.trim().length > 0) {
      recordBlockedBot();
      res.status(403).json({ error: 'Automated submission blocked by security verification.' });
      return;
    }

    const validation = validateSurveyInput(body);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Survey validation failed. Please review highlighted fields.',
        errors: validation.errors,
      });
      return;
    }

    const created = insertSurveyResponse(body as SurveyInput, false);
    const counts = getCounts();
    res.status(201).json({
      message: 'Survey response recorded successfully.',
      record: created,
      counts,
    });
  });

  app.get('/api/export/csv', (req, res) => {
    const scope = parseScope(req.query.scope);
    const responses = getResponses(scope);
    const csv = serializeResponsesToCsv(responses);
    const filename = `android-usage-survey-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  // Six-Week CSP Activity & Actual Photograph Upload endpoints
  app.get('/api/activity', (_req, res) => {
    const weeks = getWeeklyActivities();
    res.json({
      weeks,
      summary: computeActivityProgress(weeks),
    });
  });

  app.put('/api/activity/:weekNumber', (req, res) => {
    const weekNumber = Number(req.params.weekNumber);
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 6) {
      res.status(400).json({ error: 'Week number must be between 1 and 6.' });
      return;
    }

    const validation = validateWeeklyActivityUpdate(req.body);
    if (!validation.valid || !validation.sanitized) {
      res.status(400).json({ error: validation.error || 'Invalid activity update.' });
      return;
    }

    const updatedWeek = updateWeeklyActivity(weekNumber, validation.sanitized);
    if (!updatedWeek) {
      res.status(404).json({ error: 'Weekly activity record not found.' });
      return;
    }

    const weeks = getWeeklyActivities();
    res.json({
      week: updatedWeek,
      weeks,
      summary: computeActivityProgress(weeks),
    });
  });

  app.post(
    '/api/activity/:weekNumber/photos',
    express.json({ limit: '8mb' }),
    (req, res) => {
      const weekNumber = Number(req.params.weekNumber);
      if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 6) {
        res.status(400).json({ error: 'Week number must be between 1 and 6.' });
        return;
      }

      const check = validatePhotoUpload(req.body);
      if (!check.valid || !check.sanitized) {
        res.status(400).json({ error: check.error || 'Invalid photograph payload.' });
        return;
      }

      const result = addWeeklyPhoto(weekNumber, check.sanitized);
      if (result.error || !result.activity) {
        res.status(400).json({ error: result.error || 'Unable to attach photograph.' });
        return;
      }

      const weeks = getWeeklyActivities();
      res.status(201).json({
        photo: result.photo,
        week: result.activity,
        weeks,
        summary: computeActivityProgress(weeks),
      });
    }
  );

  app.delete('/api/activity/:weekNumber/photos/:photoId', (req, res) => {
    const weekNumber = Number(req.params.weekNumber);
    const photoId = String(req.params.photoId || '').trim();
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 6 || !photoId) {
      res.status(400).json({ error: 'Invalid week number or photo ID.' });
      return;
    }

    const updatedWeek = deleteWeeklyPhoto(weekNumber, photoId);
    if (!updatedWeek) {
      res.status(404).json({ error: 'Weekly activity record not found.' });
      return;
    }

    const weeks = getWeeklyActivities();
    res.json({
      week: updatedWeek,
      weeks,
      summary: computeActivityProgress(weeks),
    });
  });

  app.post('/api/ai/chat', async (req, res) => {
    const ip = getClientIp(req);
    const rate = aiChatLimiter.consume(ip);
    if (!rate.allowed) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({
        error: `AI chat rate limit reached. Please wait ${rate.retryAfterSeconds}s and try again.`,
      });
      return;
    }

    const check = validateChatPayload(req.body);
    if (!check.valid || !check.payload) {
      res.status(400).json({ error: check.error || 'Invalid AI chat request.' });
      return;
    }

    try {
      const { message, history, scope } = check.payload;
      const responses = getResponses(scope);
      const counts = getCounts();
      const settings = getProjectSettings();

      const result = await generateResearchBotReply({
        message,
        history,
        scope,
        responses,
        counts,
        settings,
      });

      res.json({
        reply: result.reply,
        model: result.model,
        scope,
        counts,
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({
        error: 'Unable to generate AI Research Bot response right now.',
      });
    }
  });

  app.post('/api/admin/login', (req, res) => {
    const ip = getClientIp(req);
    const lockStatus = adminLoginLimiter.isBlocked(ip);
    if (lockStatus.blocked) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(lockStatus.retryAfterSeconds));
      res.status(429).json({
        error: `Too many failed admin sign-in attempts. Locked for ${lockStatus.retryAfterSeconds}s.`,
      });
      return;
    }

    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    if (!verifyAdminPasscode(passcode, ADMIN_PASSCODE)) {
      const attempt = adminLoginLimiter.consume(ip);
      recordFailedAdminLogin();
      const msg = attempt.allowed
        ? `Invalid admin passcode. ${attempt.remaining} attempt(s) remaining.`
        : `Invalid admin passcode. Sign-in temporarily locked for ${attempt.retryAfterSeconds}s.`;
      res.status(401).json({ error: msg });
      return;
    }

    adminLoginLimiter.reset(ip);
    const token = issueAdminToken();
    res.json({ token });
  });

  app.post('/api/admin/logout', (req, res) => {
    const token = extractAdminToken(req);
    if (token) activeAdminTokens.delete(token);
    res.json({ ok: true });
  });

  app.delete('/api/admin/responses/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid response ID.' });
      return;
    }
    const deleted = deleteResponseById(id);
    if (!deleted) {
      res.status(404).json({ error: 'Response record not found.' });
      return;
    }
    res.json({ deletedId: id, counts: getCounts() });
  });

  app.post('/api/admin/sample/restore', requireAdmin, (_req, res) => {
    const inserted = restoreSampleResponses();
    res.json({ restoredCount: inserted, counts: getCounts() });
  });

  app.delete('/api/admin/sample/clear', requireAdmin, (_req, res) => {
    const cleared = clearSampleResponses();
    res.json({ clearedCount: cleared, counts: getCounts() });
  });

  app.get('/api/admin/export/csv', requireAdmin, (req, res) => {
    const scope = parseScope(req.query.scope);
    const responses = getResponses(scope);
    const csv = serializeResponsesToCsv(responses);
    const filename = `admin-android-usage-survey-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  // Community Chat Board endpoints
  app.get('/api/chatboard', (_req, res) => {
    res.json({ messages: getChatBoardMessages(100) });
  });

  app.post('/api/chatboard', (req, res) => {
    const ip = getClientIp(req);
    const rate = chatBoardLimiter.consume(ip);
    if (!rate.allowed) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({
        error: `Chat board rate limit reached. Please wait ${rate.retryAfterSeconds}s before posting again.`,
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    if (typeof body._hp === 'string' && body._hp.trim().length > 0) {
      recordBlockedBot();
      res.status(403).json({ error: 'Automated submission blocked by security verification.' });
      return;
    }

    const validation = validateChatBoardInput(body);
    if (!validation.valid || !validation.sanitized) {
      res.status(400).json({ error: validation.error || 'Invalid chat board message.' });
      return;
    }

    const created = insertChatBoardMessage(validation.sanitized);
    res.status(201).json({
      record: created,
      messages: getChatBoardMessages(100),
    });
  });

  app.delete('/api/admin/chatboard/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid chat message ID.' });
      return;
    }
    const deleted = deleteChatBoardMessageById(id);
    if (!deleted) {
      res.status(404).json({ error: 'Chat board message not found.' });
      return;
    }
    res.json({ deletedId: id, messages: getChatBoardMessages(100) });
  });

  const httpServer = http.createServer(app);
  attachLiveVoiceWebSocket(httpServer);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vitePromise = createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev middleware:', err);
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  }

  httpServer.on('error', (err) => {
    console.error(`HTTP server error on port ${PORT}:`, err);
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Android Usage Research Portal running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
