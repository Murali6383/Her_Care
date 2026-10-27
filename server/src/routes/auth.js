
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';

import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import {
  validateRegister,
  hasErrors,
} from '../utils/validators.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', limiter, async (req, res, next) => {
  try {
    const { errors, value } = validateRegister(req.body);

    if (hasErrors(errors)) {
      return res.status(400).json({
        error: 'Please fix the highlighted fields.',
        fields: errors,
      });
    }

    const email = String(value.email).trim().toLowerCase();

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
        fields: {
          email: 'Already registered.',
        },
      });
    }

    const passwordHash = await bcrypt.hash(value.password, 12);

    const userData = {
      email,
      displayName: value.displayName,
      passwordHash,
    };

    // Only save a phone number when the user actually provides one.
    const phoneValue =
      typeof value.phone === 'string'
        ? value.phone.trim()
        : '';

    if (phoneValue) {
      userData.phone = phoneValue;
    }

    const user = await User.create(userData);

    return res.status(201).json({
      token: signToken(user.id),
      user: user.toPrivate(),
    });
  } catch (error) {
    // Handle duplicate-index errors, including concurrent registrations.
    if (error?.code === 11000) {
      if (error.keyPattern?.email || error.keyValue?.email) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
          fields: {
            email: 'Already registered.',
          },
        });
      }

      if (error.keyPattern?.phone || error.keyValue?.phone) {
        return res.status(409).json({
          error: 'This phone number is already registered.',
          fields: {
            phone: 'Already registered.',
          },
        });
      }
    }

    return next(error);
  }
});

router.post('/login', limiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || '');

    const user = await User.findOne({ email }).select('+passwordHash');

    const passwordMatches =
      user && (await bcrypt.compare(password, user.passwordHash));

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Incorrect email or password.',
      });
    }

    return res.json({
      token: signToken(user.id),
      user: user.toPrivate(),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: req.user.toPrivate(),
  });
});

export default router;
