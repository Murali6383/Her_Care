
import 'dotenv/config';

const required = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
};

const DEFAULT_SYSTEM_PROMPT =
  'You are the Her Care assistant. Give supportive, ' +
  'general information. You are not a doctor and must not ' +
  'diagnose medical conditions. For medical concerns, ' +
  'recommend consulting a qualified healthcare professional.';

export const config = {
  port: Number(process.env.PORT || 5000),

  mongoUri: required('MONGODB_URI'),

  jwtSecret: required('JWT_SECRET'),

  clientOrigin:
    process.env.CLIENT_ORIGIN?.trim() ||
    'http://localhost:5173',

  ai: {
    // Keep the API key on the server only.
    // An empty key allows the app to show its
    // AI_NOT_CONFIGURED state.
    key: process.env.GROQ_API_KEY?.trim() || '',

    // Can be overridden using GROQ_MODEL in .env.
    model:
      process.env.GROQ_MODEL?.trim() ||
      'openai/gpt-oss-120b',

    systemPrompt:
      process.env.AI_SYSTEM_PROMPT?.trim() ||
      DEFAULT_SYSTEM_PROMPT,
  },
};
