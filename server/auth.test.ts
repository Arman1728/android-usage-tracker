import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  hashPassword,
  parseCookieValue,
  signSessionId,
  timingSafeStringEqual,
  verifyPassword,
  verifySignedSessionCookie,
} from './auth';

test('hashPassword and verifyPassword use salted scrypt hashes safely', () => {
  const hashA = hashPassword('ResearchPortal#2026');
  const hashB = hashPassword('ResearchPortal#2026');
  assert.notEqual(hashA, hashB);
  assert.ok(hashA.startsWith('scrypt$'));
  assert.equal(verifyPassword('ResearchPortal#2026', hashA), true);
  assert.equal(verifyPassword('WrongPassword', hashA), false);
  assert.equal(verifyPassword('ResearchPortal#2026', 'malformed'), false);
});

test('signSessionId and verifySignedSessionCookie reject tampered session IDs', () => {
  const sid = '11111111-2222-4333-8444-555555555555';
  const signed = signSessionId(sid);
  assert.equal(verifySignedSessionCookie(signed), sid);
  assert.equal(verifySignedSessionCookie(`${sid}.tampered`), null);
  assert.equal(verifySignedSessionCookie('bad'), null);
});

test('parseCookieValue extracts csp_session from multi-cookie header', () => {
  const header = 'theme=navy; csp_session=abc-123.sigValue; foo=bar';
  assert.equal(parseCookieValue(header, 'csp_session'), 'abc-123.sigValue');
  assert.equal(parseCookieValue(header, 'missing'), undefined);
});

test('buildSessionCookieHeader emits HttpOnly Secure SameSite=None Partitioned on HTTPS', () => {
  const httpsCookie = buildSessionCookieHeader('sid.sig', 1800, true);
  assert.ok(httpsCookie.includes('HttpOnly'));
  assert.ok(httpsCookie.includes('Secure'));
  assert.ok(httpsCookie.includes('SameSite=None'));
  assert.ok(httpsCookie.includes('Partitioned'));

  const clearCookie = buildClearSessionCookieHeader(true);
  assert.ok(clearCookie.includes('Max-Age=0'));
  assert.ok(clearCookie.includes('HttpOnly'));
  assert.ok(clearCookie.includes('SameSite=None'));
});

test('timingSafeStringEqual handles equal and unequal strings', () => {
  assert.equal(timingSafeStringEqual('admin', 'admin'), true);
  assert.equal(timingSafeStringEqual('admin', 'Admin'), false);
});
