// Pure validation helpers (unit-tested in test/validators.test.js).
const PHONE_RE = /^[+]?[0-9\s-]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(body = {}) {
  const errors = {};
  const email = String(body.email || '').trim().toLowerCase();
  const displayName = String(body.displayName || '').trim();
  const password = String(body.password || '');
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (displayName.length < 2 || displayName.length > 50) errors.displayName = 'Name must be 2–50 characters.';
  if (password.length < 8 || password.length > 128) errors.password = 'Password must be 8–128 characters.';
  return { errors, value: { email, displayName, password } };
}

// Only these fields can ever be changed through the profile endpoint (no mass assignment).
export function validateProfile(body = {}) {
  const errors = {};
  const value = {};
  if ('displayName' in body) {
    const v = String(body.displayName || '').trim();
    if (v.length < 2 || v.length > 50) errors.displayName = 'Name must be 2–50 characters.';
    else value.displayName = v;
  }
  if ('bio' in body) {
    const v = String(body.bio || '').trim();
    if (v.length > 300) errors.bio = 'Bio can be at most 300 characters.';
    else value.bio = v;
  }
  if ('location' in body) {
    const v = String(body.location || '').trim();
    if (v.length > 80) errors.location = 'Location can be at most 80 characters.';
    else value.location = v;
  }
  if ('phone' in body) {
    const v = String(body.phone || '').trim();
    if (v && !PHONE_RE.test(v)) errors.phone = 'Enter a valid phone number or leave it empty.';
    else value.phone = v;
  }
  return { errors, value };
}

export function validateMessage(body = {}) {
  const errors = {};
  const text = String(body.text ?? '').trim();
  const clientId = String(body.clientId ?? '');
  if (!text) errors.text = 'Message cannot be empty.';
  else if (text.length > 4000) errors.text = 'Message is too long (max 4000 characters).';
  if (clientId.length < 8 || clientId.length > 64) errors.clientId = 'clientId is required (8–64 characters).';
  return { errors, value: { text, clientId } };
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;
