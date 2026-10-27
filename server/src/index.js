
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

import { config } from './config.js';
import authRoutes from './routes/auth.js';
import profileRoutes, {
  usersRouter,
  AVATAR_DIR,
} from './routes/profile.js';
import conversationRoutes from './routes/conversations.js';
import { initSocket } from './socket.js';

const app = express();
const server = http.createServer(app);

// Render deployment: trust one reverse-proxy hop.
// Configure this before rate-limit middleware or request handlers.
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  }),
);

// Allow requests from the configured frontend origin.
app.use(
  cors({
    origin: config.clientOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// Parse JSON request bodies.
app.use(express.json({ limit: '100kb' }));

// Serve uploaded profile avatars.
app.use(
  '/uploads/avatars',
  express.static(AVATAR_DIR, {
    maxAge: '1d',
  }),
);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    aiConfigured: Boolean(config.ai.key),
    databaseConnected: mongoose.connection.readyState === 1,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRouter);
app.use('/api/conversations', conversationRoutes);

// API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found.',
  });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('API error:', err);

  if (res.headersSent) {
    return;
  }

  res.status(err.status || 500).json({
    error:
      err.status && err.status < 500
        ? err.message
        : 'Something went wrong on our side. Please try again.',
  });
});

// Initialize Socket.IO
app.set('io', initSocket(server));

// Start the server only after MongoDB connects successfully.
try {
  await mongoose.connect(config.mongoUri);

  console.log('MongoDB connected successfully.');

  const port = Number(process.env.PORT || config.port || 5000);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Her Care API listening on port ${port}`);
  });
} catch (error) {
  console.error('Failed to start Her Care API:', error);
  process.exit(1);
}
