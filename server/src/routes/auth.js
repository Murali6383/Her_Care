import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { validateRegister, hasErrors } from '../utils/validators.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });

router.post('/register', limiter, async (req, res) => {
  const { errors, value } = validateRegister(req.body);
  if (hasErrors(errors)) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
  if (await User.findOne({ email: value.email })) {
    return res.status(409).json({ error: 'An account with this email already exists.', fields: { email: 'Already registered.' } });
  }
  const passwordHash = await bcrypt.hash(value.password, 12);
  const user = await User.create({ email: value.email, displayName: value.displayName, passwordHash });
  res.status(201).json({ token: signToken(user.id), user: user.toPrivate() });
});

router.post('/login', limiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json({ token: signToken(user.id), user: user.toPrivate() });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPrivate() }));

export default router;
