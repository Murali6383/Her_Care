import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertMessage, mergeMessages } from '../src/lib/messages.js';

const msg = (over) => ({ id: 'id', clientId: 'cid', text: 't', createdAt: '2026-10-27T10:00:00Z', ...over });

test('server message replaces the optimistic one (same clientId) instead of duplicating', () => {
  let list = upsertMessage([], msg({ id: 'cid', status: 'sending' }));
  list = upsertMessage(list, msg({ id: 'srv1', status: 'sent' }));
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'srv1');
  assert.equal(list[0].status, 'sent');
});

test('same message arriving twice (HTTP + socket) is stored once', () => {
  let list = upsertMessage([], msg({ id: 'a', clientId: 'a1' }));
  list = upsertMessage(list, msg({ id: 'a', clientId: 'a1' }));
  assert.equal(list.length, 1);
});

test('messages are ordered by time; unsent ones stay at the bottom', () => {
  let list = [];
  list = upsertMessage(list, msg({ id: '2', clientId: 'c2', createdAt: '2026-10-27T10:05:00Z' }));
  list = upsertMessage(list, msg({ id: '1', clientId: 'c1', createdAt: '2026-10-27T10:01:00Z' }));
  list = upsertMessage(list, msg({ id: 'p', clientId: 'cp', createdAt: '2026-10-27T09:00:00Z', status: 'failed' }));
  assert.deepEqual(list.map((m) => m.id), ['1', '2', 'p']);
});

test('mergeMessages after reconnect adds only missing messages', () => {
  const have = [msg({ id: '1', clientId: 'c1', status: 'sent' })];
  const out = mergeMessages(have, [msg({ id: '1', clientId: 'c1' }), msg({ id: '2', clientId: 'c2', createdAt: '2026-10-27T10:02:00Z' })]);
  assert.equal(out.length, 2);
});
