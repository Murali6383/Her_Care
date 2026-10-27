import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validateProfile, hasErrors } from '../utils/validators.js';

export const AVATAR_DIR = path.resolve('uploads/avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    // Server-chosen filename: never trust the client's.
    filename: (req, file, cb) => cb(null, `${req.user.id}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new Error('INVALID_TYPE'))),
});

const router = Router();
router.use(requireAuth);

// Owner only: full private profile.
router.get('/', (req, res) => res.json({ user: req.user.toPrivate() }));

// Owner only: there is no :id here on purpose, so editing someone else's profile is impossible.
router.put('/', async (req, res) => {
  const { errors, value } = validateProfile(req.body);
  if (hasErrors(errors)) return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
  Object.assign(req.user, value);
  await req.user.save();
  res.json({ user: req.user.toPrivate() });
});

router.post('/avatar', (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller.' :
        err.message === 'INVALID_TYPE' ? 'Use a JPG, PNG or WebP image.' : 'Upload failed. Please try again.';
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    const old = req.user.avatarUrl;
    req.user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await req.user.save();
    if (old) fs.promises.unlink(path.join(AVATAR_DIR, path.basename(old))).catch(() => {});
    res.json({ user: req.user.toPrivate() });
  });
});

router.delete('/avatar', async (req, res) => {
  const old = req.user.avatarUrl;
  req.user.avatarUrl = '';
  await req.user.save();
  if (old) fs.promises.unlink(path.join(AVATAR_DIR, path.basename(old))).catch(() => {});
  res.json({ user: req.user.toPrivate() });
});

// Other people: public fields only (no email, no phone).
export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 50);
  if (q.length < 2) return res.json({ users: [] });
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({ displayName: new RegExp(safe, 'i'), _id: { $ne: req.user._id } }).limit(10);
  res.json({ users: users.map((u) => u.toPublic()) });
});
usersRouter.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'User not found.' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: user.toPublic() });
});

export default router;
