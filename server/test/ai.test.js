import test from 'node:test';
import assert from 'node:assert/strict';
process.env.MONGODB_URI = 'x';
process.env.JWT_SECRET = 'x';
const { toGroqMessages } = await import('../src/utils/ai.js');

test('builds system + alternating roles and drops a leading assistant turn', () => {
  const out = toGroqMessages(
    [{ role: 'ai', text: 'stray' }, { role: 'user', text: 'a' }, { role: 'ai', text: 'b' }],
    'SYS'
  );
  assert.deepEqual(out.map((m) => m.role), ['system', 'user', 'assistant']);
  assert.equal(out[0].content, 'SYS');
});

test('only the supplied history is sent (no other conversation data)', () => {
  const out = toGroqMessages([{ role: 'user', text: 'only this' }], 'SYS');
  assert.equal(out.length, 2);
  assert.equal(out[1].content, 'only this');
});
