import { config } from '../config.js';

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Groq uses the OpenAI-style chat format: a system message, then alternating user/assistant turns.
export function toGroqMessages(history, systemPrompt = config.ai.systemPrompt) {
  const turns = history.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return [{ role: 'system', content: systemPrompt }, ...turns];
}

// `history` must contain ONLY messages from the one AI conversation that belongs to the requesting user.
export async function generateAiReply(history) {
  if (!config.ai.key) {
    throw new AiError('AI_NOT_CONFIGURED', 'The AI assistant is not configured on the server yet (missing GROQ_API_KEY).');
  }
  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.key}` },
      body: JSON.stringify({ model: config.ai.model, messages: toGroqMessages(history), temperature: 0.6, max_tokens: 1024 }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    throw new AiError('AI_UNREACHABLE', err.name === 'TimeoutError' ? 'The AI took too long to answer.' : 'Could not reach the AI service.');
  }
  if (res.status === 401) throw new AiError('AI_NOT_CONFIGURED', 'The AI key on the server was rejected. Check GROQ_API_KEY.');
  if (res.status === 429) throw new AiError('AI_RATE_LIMITED', 'The AI is busy right now. Please retry in a moment.');
  if (!res.ok) throw new AiError('AI_PROVIDER_ERROR', `The AI service returned an error (${res.status}).`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiError('AI_EMPTY', 'The AI returned an empty answer. Please retry.');
  return text.slice(0, 7900);
}
