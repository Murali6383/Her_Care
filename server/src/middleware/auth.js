import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';

export const signToken = (userId) => jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });

export async function userFromToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return await User.findById(payload.sub);
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token ? await userFromToken(token) : null;
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });
  req.user = user;
  next();
}
