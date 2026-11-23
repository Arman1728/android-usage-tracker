export interface LoginValidationResult {
  valid: boolean;
  identifier?: string;
  email?: string;
  password?: string;
  error?: string;
}

export interface RegisterValidationResult {
  valid: boolean;
  email?: string;
  password?: string;
  error?: string;
}

export interface ChangePasswordValidationResult {
  valid: boolean;
  currentPassword?: string;
  newPassword?: string;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function normalizeIdentifier(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function validateLoginInput(raw: unknown): LoginValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Invalid username/email or password' };
  }
  const obj = raw as Record<string, unknown>;
  const rawIdentifier = obj.identifier ?? obj.username ?? obj.email;
  const identifier = normalizeIdentifier(rawIdentifier);
  const password = typeof obj.password === 'string' ? obj.password : '';

  if (identifier.length < 3 || identifier.length > 120 || /\s/.test(identifier)) {
    return { valid: false, error: 'Invalid username/email or password' };
  }
  if (password.length < 1 || password.length > 128) {
    return { valid: false, error: 'Invalid username/email or password' };
  }

  return { valid: true, identifier, email: identifier, password };
}

export function validateRegisterInput(raw: unknown): RegisterValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Please enter your email and a password.' };
  }
  const obj = raw as Record<string, unknown>;
  const email = normalizeEmail(obj.email ?? obj.username);
  const password = typeof obj.password === 'string' ? obj.password : '';

  if (!email || email.length > 120 || !EMAIL_PATTERN.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address.',
    };
  }
  if (password.length < 6 || password.length > 128) {
    return {
      valid: false,
      error: 'Password must be at least 6 characters long.',
    };
  }

  return { valid: true, email, password };
}

export function validateAutoAccountInput(raw: unknown): RegisterValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Please enter your email and password.' };
  }
  const obj = raw as Record<string, unknown>;
  const email = normalizeEmail(obj.email ?? obj.username ?? obj.identifier);
  const password = typeof obj.password === 'string' ? obj.password : '';

  if (!email || email.length > 120 || !EMAIL_PATTERN.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address.',
    };
  }
  if (password.length < 1 || password.length > 128) {
    return {
      valid: false,
      error: 'Please enter a password.',
    };
  }

  return { valid: true, email, password };
}

export function validateChangePasswordInput(raw: unknown): ChangePasswordValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Please fill in all password fields.' };
  }
  const obj = raw as Record<string, unknown>;
  const currentPassword = typeof obj.currentPassword === 'string' ? obj.currentPassword : '';
  const newPassword = typeof obj.newPassword === 'string' ? obj.newPassword : '';
  const confirmPassword = typeof obj.confirmPassword === 'string' ? obj.confirmPassword : '';

  if (currentPassword.length < 1 || currentPassword.length > 128) {
    return { valid: false, error: 'Please enter your current password.' };
  }
  if (newPassword.length < 6 || newPassword.length > 128) {
    return { valid: false, error: 'New password must be at least 6 characters long.' };
  }
  if (newPassword !== confirmPassword) {
    return { valid: false, error: 'New passwords do not match.' };
  }
  if (newPassword === currentPassword) {
    return {
      valid: false,
      error: 'New password must be different from your current password.',
    };
  }

  return { valid: true, currentPassword, newPassword };
}
