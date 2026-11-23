import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChatBoardInput } from './chatBoardLogic';

test('validateChatBoardInput accepts valid student post and normalizes whitespace', () => {
  const result = validateChatBoardInput({
    senderName: '  Syed   Saad Arman ',
    roleTag: 'CSP Team',
    message: '  Great observations on student screen time trends!  ',
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.sanitized, {
    senderName: 'Syed Saad Arman',
    roleTag: 'CSP Team',
    message: 'Great observations on student screen time trends!',
  });
});

test('validateChatBoardInput rejects too-short names, invalid roles, and oversized messages', () => {
  const badName = validateChatBoardInput({
    senderName: 'A',
    roleTag: 'Student',
    message: 'Hello world',
  });
  assert.equal(badName.valid, false);

  const badRole = validateChatBoardInput({
    senderName: 'Dinesh',
    roleTag: 'SuperAdmin',
    message: 'Hello world',
  });
  assert.equal(badRole.valid, false);

  const longMsg = validateChatBoardInput({
    senderName: 'Dinesh',
    roleTag: 'Student',
    message: 'x'.repeat(501),
  });
  assert.equal(longMsg.valid, false);
});
