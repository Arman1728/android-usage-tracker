import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAutoAccountInput,
  validateChangePasswordInput,
  validateLoginInput,
  validateRegisterInput,
} from './authLogic';

test('validateLoginInput normalizes email and accepts valid login credentials', () => {
  const res = validateLoginInput({ email: '  Student@SVCE.edu.in ', password: 'MyPassword1' });
  assert.equal(res.valid, true);
  assert.equal(res.identifier, 'student@svce.edu.in');
  assert.equal(res.email, 'student@svce.edu.in');
  assert.equal(res.password, 'MyPassword1');
});

test('validateLoginInput accepts administrator username without email domain', () => {
  const res = validateLoginInput({ username: '  SaadArman ', password: 'PortalPassword1' });
  assert.equal(res.valid, true);
  assert.equal(res.identifier, 'saadarman');
  assert.equal(res.password, 'PortalPassword1');
});

test('validateLoginInput rejects blank or invalid credentials with generic error', () => {
  const emptyUser = validateLoginInput({ email: ' ', password: 'secret' });
  assert.equal(emptyUser.valid, false);
  assert.equal(emptyUser.error, 'Invalid username/email or password');

  const spacedUser = validateLoginInput({ username: 'bad user', password: 'secret' });
  assert.equal(spacedUser.valid, false);
  assert.equal(spacedUser.error, 'Invalid username/email or password');

  const emptyPass = validateLoginInput({ email: 'user@example.com', password: '' });
  assert.equal(emptyPass.valid, false);
  assert.equal(emptyPass.error, 'Invalid username/email or password');
});

test('validateRegisterInput enforces valid email format and 6+ character password', () => {
  const badEmail = validateRegisterInput({
    email: 'not-an-email',
    password: 'Password123',
  });
  assert.equal(badEmail.valid, false);

  const shortPass = validateRegisterInput({
    email: 'user@example.com',
    password: '123',
  });
  assert.equal(shortPass.valid, false);

  const valid = validateRegisterInput({
    email: '  Saad@Example.com ',
    password: 'StrongPassword1',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.email, 'saad@example.com');
});

test('validateAutoAccountInput allows first-time email account creation with any non-empty password', () => {
  const badEmail = validateAutoAccountInput({ email: 'invalid-email', password: '1234' });
  assert.equal(badEmail.valid, false);

  const emptyPass = validateAutoAccountInput({ email: 'visitor@example.com', password: '' });
  assert.equal(emptyPass.valid, false);

  const validShort = validateAutoAccountInput({ email: '  NewUser@Example.com ', password: '1234' });
  assert.equal(validShort.valid, true);
  assert.equal(validShort.email, 'newuser@example.com');
  assert.equal(validShort.password, '1234');
});

test('validateChangePasswordInput enforces matching 6+ character different passwords', () => {
  assert.equal(
    validateChangePasswordInput({
      currentPassword: '',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1',
    }).valid,
    false
  );

  assert.equal(
    validateChangePasswordInput({
      currentPassword: 'OldPassword1',
      newPassword: 'short',
      confirmPassword: 'short',
    }).valid,
    false
  );

  assert.equal(
    validateChangePasswordInput({
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
      confirmPassword: 'DifferentPassword2',
    }).valid,
    false
  );

  assert.equal(
    validateChangePasswordInput({
      currentPassword: 'SamePassword1',
      newPassword: 'SamePassword1',
      confirmPassword: 'SamePassword1',
    }).valid,
    false
  );

  const ok = validateChangePasswordInput({
    currentPassword: 'OldPassword1',
    newPassword: 'NewPassword2',
    confirmPassword: 'NewPassword2',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.currentPassword, 'OldPassword1');
  assert.equal(ok.newPassword, 'NewPassword2');
});
