// Pure helpers for the message list (unit-tested in test/messages.test.js).
const isPending = (m) => m.status === 'sending' || m.status === 'failed';
const timeOf = (m) => (isPending(m) ? Number.MAX_SAFE_INTEGER : Date.parse(m.createdAt) || 0);

// Insert or merge a message. Matching by clientId (or server id) is what prevents duplicates when the
// same message arrives via the HTTP response AND the socket, or is retried.
export function upsertMessage(list, incoming) {
  const i = list.findIndex((m) => (incoming.clientId && m.clientId === incoming.clientId) || (incoming.id && m.id === incoming.id));
  const next = i === -1 ? [...list, incoming] : list.map((m, idx) => (idx === i ? { ...m, ...incoming } : m));
  // Array.sort is stable, so equal timestamps keep their order. Unsent messages always stay at the bottom.
  return next.sort((a, b) => (timeOf(a) < timeOf(b) ? -1 : timeOf(a) > timeOf(b) ? 1 : 0));
}

export const mergeMessages = (list, fetched) => fetched.reduce((acc, m) => upsertMessage(acc, { ...m, status: 'sent' }), list);

export function newClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
