import express from 'express';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  addWeeklyPhoto,
  clearSampleResponses,
  deleteChatBoardMessageById,
  deleteResponseById,
  deleteWeeklyPhoto,
  getChatBoardMessages,
  getCounts,
  getDb,
  getProjectSettings,
  getResponses,
  getWeeklyActivities,
  insertChatBoardMessage,
  insertSurveyResponse,
  restoreSampleResponses,
  updateProjectSettings,
  updateWeeklyActivity,
} from './server/db';
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
  chatBoardLimiter,
  createSecurityChallenge,
  getActiveProtections,
  getSecurityMetrics,
  recordBlockedBot,
  recordFailedAdminLogin,
  recordRateLimitHit,
  revokeSecurityToken,
  surveySubmitLimiter,
  verifyAdminPasscode,
  verifyLimiter,
  verifySecurityChallenge,
  verifySecurityToken,
} from './server/security';
import {
  DatasetScope,
  ProjectSettings,
  SecurityChallengeMode,
  SurveyInput,
} from './src/types/survey';

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

function requireSecurityToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const token = req.header('x-security-token');
  const payload = verifySecurityToken(token);
  if (!payload) {
    res.status(403).json({
      error: 'Security verification required. Please complete the human verification check.',
      code: 'SECURITY_VERIFICATION_REQUIRED',
    });
    return;
  }
  next();
}

function requireAiSecurityToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const settings = getProjectSettings();
  if (!settings.requireSiteGate) {
    next();
    return;
  }
  requireSecurityToken(req, res, next);
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
    res.json({ ok: true, counts: getCounts() });
  });

  // Security verification & challenge endpoints
  app.get('/api/security/status', (req, res) => {
    const settings = getProjectSettings();
    const verified = verifySecurityToken(req.header('x-security-token'));
    res.json({
      verified: Boolean(verified),
      requireSiteGate: settings.requireSiteGate,
      expiresAt: verified ? verified.exp : null,
      mode: verified ? verified.mode : null,
      protections: getActiveProtections(settings.requireSiteGate),
    });
  });

  app.get('/api/security/challenge', (req, res) => {
    const mode: SecurityChallengeMode = req.query.mode === 'math' ? 'math' : 'code';
    const challenge = createSecurityChallenge(mode);
    res.setHeader('Cache-Control', 'no-store');
    res.json(challenge);
  });

  app.post('/api/security/verify', (req, res) => {
    const ip = getClientIp(req);
    const rate = verifyLimiter.consume(ip);
    if (!rate.allowed) {
      recordRateLimitHit();
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      res.status(429).json({
        error: `Too many verification attempts. Please wait ${rate.retryAfterSeconds}s and try again.`,
      });
      return;
    }

    const body = (req.body || {}) as {
      challengeId?: unknown;
      answer?: unknown;
      website?: unknown;
    };
    const result = verifySecurityChallenge({
      challengeId: body.challengeId,
      answer: body.answer,
      honeypot: body.website,
    });

    if (!result.ok) {
      const errorStatus = 'status' in result ? result.status : 400;
      const errorMessage = 'error' in result ? result.error : 'Verification failed.';
      res.status(errorStatus).json({ error: errorMessage });
      return;
    }

    const settings = getProjectSettings();
    res.json({
      verified: true,
      token: result.token,
      expiresAt: result.expiresAt,
      mode: result.mode,
      protections: getActiveProtections(settings.requireSiteGate),
    });
  });

  app.post('/api/security/revoke', (req, res) => {
    revokeSecurityToken(req.header('x-security-token'));
    res.json({ ok: true });
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

  app.post('/api/responses', requireSecurityToken, (req, res) => {
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

  app.put('/api/activity/:weekNumber', requireSecurityToken, (req, res) => {
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
    requireSecurityToken,
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

  app.delete('/api/activity/:weekNumber/photos/:photoId', requireSecurityToken, (req, res) => {
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

  app.post('/api/ai/chat', requireAiSecurityToken, async (req, res) => {
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

  app.post('/api/admin/login', requireSecurityToken, (req, res) => {
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

  app.post('/api/chatboard', requireAiSecurityToken, (req, res) => {
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
