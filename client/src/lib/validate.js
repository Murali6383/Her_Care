// Mirrors server/src/utils/validators.js so errors show instantly; the server remains the source of truth.
export function validateProfile(v) {
  const e = {};
  const name = (v.displayName || '').trim();
  if (name.length < 2 || name.length > 50) e.displayName = 'Name must be 2–50 characters.';
  if ((v.bio || '').trim().length > 300) e.bio = 'Bio can be at most 300 characters.';
  if ((v.location || '').trim().length > 80) e.location = 'Location can be at most 80 characters.';
  const phone = (v.phone || '').trim();
  if (phone && !/^[+]?[0-9\s-]{7,20}$/.test(phone)) e.phone = 'Enter a valid phone number or leave it empty.';
  return e;
}
