import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import profileRoutes, { usersRouter, AVATAR_DIR } from './routes/profile.js';
import conversationRoutes from './routes/conversations.js';
import { initSocket } from './socket.js';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // avatars are loaded from the client origin
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads/avatars', express.static(AVATAR_DIR, { maxAge: '1d' }));

app.get('/api/health', (req, res) => res.json({ ok: true, aiConfigured: Boolean(config.ai.key) }));
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRouter);
app.use('/api/conversations', conversationRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const server = http.createServer(app);
app.set('io', initSocket(server));

await mongoose.connect(config.mongoUri);
server.listen(config.port, () => console.log(`Her Care API on :${config.port}`));
