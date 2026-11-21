import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SlidingWindowLimiter,
  createSecurityChallenge,
  getSecurityMetrics,
  resetSecurityStateForTests,
  revokeSecurityToken,
  verifyAdminPasscode,
  verifySecurityChallenge,
  verifySecurityToken,
} from './security';

test('createSecurityChallenge issues math and code challenges without leaking answers', () => {
  resetSecurityStateForTests();

  const codeChallenge = createSecurityChallenge('code');
  assert.ok(codeChallenge.challengeId);
  assert.equal(codeChallenge.mode, 'code');
  assert.equal(codeChallenge.tokens.length, 5);

  const mathChallenge = createSecurityChallenge('math');
  assert.ok(mathChallenge.challengeId);
  assert.equal(mathChallenge.mode, 'math');
  assert.match(mathChallenge.prompt, /^\d+ \+ \d+ = \?$/);
});

test('verifySecurityChallenge validates math answers, rejects replays, and detects honeypots', () => {
  resetSecurityStateForTests();

  const mathChallenge = createSecurityChallenge('math');
  const [left, right] = mathChallenge.prompt.replace(' = ?', '').split(' + ').map(Number);
  const answer = String(left + right);

  const botAttempt = verifySecurityChallenge({
    challengeId: mathChallenge.challengeId,
    answer,
    honeypot: 'http://spam.example.com',
  });
  assert.equal(botAttempt.ok, false);
  if (!botAttempt.ok) assert.equal(botAttempt.status, 403);

  const okResult = verifySecurityChallenge({
    challengeId: mathChallenge.challengeId,
    answer,
    honeypot: '',
  });
  assert.equal(okResult.ok, true);
  if (okResult.ok) {
    const verified = verifySecurityToken(okResult.token);
    assert.ok(verified);
    assert.equal(verified?.mode, 'math');

    // Replay with the same challengeId must fail
    const replay = verifySecurityChallenge({
      challengeId: mathChallenge.challengeId,
      answer,
    });
    assert.equal(replay.ok, false);

    // Revoking token invalidates subsequent checks
    revokeSecurityToken(okResult.token);
    assert.equal(verifySecurityToken(okResult.token), null);
  }
});

test('verifySecurityChallenge rejects wrong answers and expired challenges', () => {
  resetSecurityStateForTests();
  const baseNow = 1_700_000_000_000;

  const ch1 = createSecurityChallenge('math', baseNow);
  const wrong = verifySecurityChallenge({
    challengeId: ch1.challengeId,
    answer: '9999',
    now: baseNow + 1000,
  });
  assert.equal(wrong.ok, false);

  const ch2 = createSecurityChallenge('math', baseNow);
  const [l, r] = ch2.prompt.replace(' = ?', '').split(' + ').map(Number);
  const expired = verifySecurityChallenge({
    challengeId: ch2.challengeId,
    answer: String(l + r),
    now: baseNow + 6 * 60 * 1000,
  });
  assert.equal(expired.ok, false);

  const metrics = getSecurityMetrics(0);
  assert.equal(metrics.failedChallenges, 2);
});

test('verifySecurityToken rejects tampered signatures', () => {
  resetSecurityStateForTests();
  const ch = createSecurityChallenge('math');
  const [l, r] = ch.prompt.replace(' = ?', '').split(' + ').map(Number);
  const res = verifySecurityChallenge({ challengeId: ch.challengeId, answer: String(l + r) });
  assert.equal(res.ok, true);
  if (!res.ok) return;

  const tampered = `${res.token.slice(0, -2)}xx`;
  assert.equal(verifySecurityToken(tampered), null);
});

test('SlidingWindowLimiter enforces max attempts and resets cleanly', () => {
  const limiter = new SlidingWindowLimiter(60_000, 3);
  const t0 = 1_700_000_000_000;

  assert.equal(limiter.consume('1.2.3.4', t0).allowed, true);
  assert.equal(limiter.consume('1.2.3.4', t0 + 1000).allowed, true);
  assert.equal(limiter.consume('1.2.3.4', t0 + 2000).allowed, true);

  const blocked = limiter.consume('1.2.3.4', t0 + 3000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  // Window expires
  assert.equal(limiter.consume('1.2.3.4', t0 + 61_000).allowed, true);

  limiter.reset('1.2.3.4');
  assert.equal(limiter.isBlocked('1.2.3.4', t0 + 61_000).blocked, false);
});

test('verifyAdminPasscode validates passcodes using timing-safe comparison', () => {
  assert.equal(verifyAdminPasscode('12345', '12345'), true);
  assert.equal(verifyAdminPasscode('12346', '12345'), false);
  assert.equal(verifyAdminPasscode('', '12345'), false);
});
