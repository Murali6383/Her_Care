import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegister, validateProfile, validateMessage, hasErrors } from '../src/utils/validators.js';

test('register: accepts valid input and normalises email', () => {
  const { errors, value } = validateRegister({ email: ' A@B.com ', displayName: 'Ann', password: 'longenough1' });
  assert.equal(hasErrors(errors), false);
  assert.equal(value.email, 'a@b.com');
});

test('register: rejects bad email, short name, short password', () => {
  const { errors } = validateRegister({ email: 'nope', displayName: 'A', password: '123' });
  assert.deepEqual(Object.keys(errors).sort(), ['displayName', 'email', 'password']);
});

test('profile: only whitelisted fields are returned (no role/email/password)', () => {
  const { value } = validateProfile({ displayName: 'Ann', role: 'admin', email: 'x@y.z', password: 'x', bio: 'hi' });
  assert.deepEqual(Object.keys(value).sort(), ['bio', 'displayName']);
});

test('profile: validates lengths and phone', () => {
  const { errors } = validateProfile({ displayName: 'A', bio: 'x'.repeat(301), phone: 'abc', location: 'y'.repeat(81) });
  assert.deepEqual(Object.keys(errors).sort(), ['bio', 'displayName', 'location', 'phone']);
});

test('profile: empty phone is allowed (clears it)', () => {
  const { errors, value } = validateProfile({ phone: '' });
  assert.equal(hasErrors(errors), false);
  assert.equal(value.phone, '');
});

test('message: requires text and clientId, limits length', () => {
  assert.ok(validateMessage({ text: '  ', clientId: 'abcdefgh' }).errors.text);
  assert.ok(validateMessage({ text: 'hi', clientId: 'x' }).errors.clientId);
  assert.ok(validateMessage({ text: 'x'.repeat(4001), clientId: 'abcdefgh' }).errors.text);
  assert.equal(hasErrors(validateMessage({ text: 'hello 😊', clientId: 'abcdefgh' }).errors), false);
});
