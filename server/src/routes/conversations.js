
import { Router } from 'express';
import mongoose from 'mongoose';

import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validateMessage, hasErrors } from '../utils/validators.js';
import { generateAiReply, AiError } from '../utils/ai.js';

const router = Router();

router.use(requireAuth);

const UNSENT_TEXT = 'This message was unsent';

const userIdOf = (user) => String(user._id ?? user.id);

const serializeMessage = (message) => ({
  id: String(message._id),
  conversation: String(message.conversation),
  sender: message.sender ? String(message.sender) : null,
  role: message.role,
  text: message.text,
  clientId: message.clientId,
  createdAt: message.createdAt,
  isUnsent: Boolean(message.unsentAt),
  unsentAt: message.unsentAt || null,
});

async function serializeConversation(conversation, meId) {
  const otherId = conversation.participants
    .map(String)
    .find((id) => id !== String(meId));

  const other =
    conversation.type === 'direct' && otherId
      ? await User.findById(otherId)
      : null;

  return {
    id: String(conversation._id),
    type: conversation.type,
    title:
      conversation.type === 'ai'
        ? 'Her Care Assistant'
        : other
          ? other.displayName
          : 'Deleted user',
    avatarUrl: other?.avatarUrl || '',
    lastMessageText: conversation.lastMessageText,
    lastMessageAt: conversation.lastMessageAt,
  };
}

async function loadConversation(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: 'Conversation not found.' });
    return null;
  }

  const conversation = await Conversation.findOne({
    _id: id,
    participants: req.user._id,
  });

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found.' });
    return null;
  }

  return conversation;
}

function emitToParticipants(req, conversation, event, payload) {
  const io = req.app.get('io');

  if (!io) {
    console.error('Socket.IO is not registered on the Express app.');
    return;
  }

  for (const participantId of conversation.participants) {
    io.to(`user:${String(participantId)}`).emit(event, payload);
  }
}

async function findOrCreate(pairKey, doc) {
  const existing = await Conversation.findOne({ pairKey });

  if (existing) return existing;

  try {
    return await Conversation.create({ ...doc, pairKey });
  } catch (error) {
    if (error.code === 11000) {
      const conversation = await Conversation.findOne({ pairKey });
      if (conversation) return conversation;
    }

    throw error;
  }
}

// List conversations.
router.get('/', async (req, res) => {
  const conversations = await Conversation.find({
    participants: req.user._id,
  })
    .sort({ lastMessageAt: -1 })
    .limit(200);

  res.json({
    conversations: await Promise.all(
      conversations.map((conversation) =>
        serializeConversation(conversation, req.user._id)
      )
    ),
  });
});

// Create or reuse a direct conversation.
router.post('/', async (req, res) => {
  const { userId } = req.body || {};

  if (
    !mongoose.isValidObjectId(userId) ||
    String(userId) === userIdOf(req.user)
  ) {
    return res.status(400).json({
      error: 'Choose another user to chat with.',
    });
  }

  if (!(await User.exists({ _id: userId }))) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const pairKey = [
    userIdOf(req.user),
    String(userId),
  ]
    .sort()
    .join(':');

  const conversation = await findOrCreate(pairKey, {
    type: 'direct',
    participants: [req.user._id, userId],
  });

  res.status(201).json({
    conversation: await serializeConversation(
      conversation,
      req.user._id
    ),
  });
});

// Create or reuse the user's private AI conversation.
router.post('/ai', async (req, res) => {
  const conversation = await findOrCreate(
    `ai:${userIdOf(req.user)}`,
    {
      type: 'ai',
      participants: [req.user._id],
    }
  );

  res.status(201).json({
    conversation: await serializeConversation(
      conversation,
      req.user._id
    ),
  });
});

// Fetch messages visible to the current user.
router.get('/:id/messages', async (req, res) => {
  const conversation = await loadConversation(req, res);
  if (!conversation) return;

  const limit = Math.min(
    Math.max(Number(req.query.limit) || 30, 1),
    100
  );

  const filter = {
    conversation: conversation._id,
    deletedFor: { $ne: req.user._id },
  };

  if (req.query.before) {
    const before = new Date(String(req.query.before));

    if (!Number.isNaN(before.getTime())) {
      filter.createdAt = { $lt: before };
    }
  }

  const rows = await Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();

  res.json({
    messages: page.map(serializeMessage),
    hasMore,
  });
});

// Search visible messages.
router.get('/:id/search', async (req, res) => {
  const conversation = await loadConversation(req, res);
  if (!conversation) return;

  const query = String(req.query.q || '').trim().slice(0, 100);

  if (query.length < 2) {
    return res.json({ messages: [] });
  }

  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const messages = await Message.find({
    conversation: conversation._id,
    deletedFor: { $ne: req.user._id },
    text: new RegExp(safe, 'i'),
  })
    .sort({ createdAt: -1 })
    .limit(30);

  res.json({
    messages: messages.map(serializeMessage),
  });
});

// Delete for me. Other participants still retain the message.
router.delete('/:id/messages/:messageId', async (req, res) => {
  const conversation = await loadConversation(req, res);
  if (!conversation) return;

  const { messageId } = req.params;

  if (!mongoose.isValidObjectId(messageId)) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  const message = await Message.findOne({
    _id: messageId,
    conversation: conversation._id,
  });

  if (!message) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  await Message.updateOne(
    { _id: message._id },
    { $addToSet: { deletedFor: req.user._id } }
  );

  const meId = userIdOf(req.user);

  req.app.get('io')?.to(`user:${meId}`).emit(
    'message:deleted-for-me',
    {
      conversation: String(conversation._id),
      messageId: String(message._id),
      userId: meId,
    }
  );

  res.json({
    success: true,
    messageId: String(message._id),
  });
});

// Unsend for everyone. Only the original sender can do this.
router.post(
  '/:id/messages/:messageId/unsend',
  async (req, res) => {
    const conversation = await loadConversation(req, res);
    if (!conversation) return;

    const { messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const message = await Message.findOne({
      _id: messageId,
      conversation: conversation._id,
      role: 'user',
      sender: req.user._id,
    });

    if (!message) {
      return res.status(404).json({
        error: 'Message not found or you cannot unsend it.',
      });
    }

    if (!message.unsentAt) {
      message.text = UNSENT_TEXT;
      message.unsentAt = new Date();
      await message.save();
    }

    const latest = await Message.findOne({
      conversation: conversation._id,
    }).sort({ createdAt: -1, _id: -1 });

    if (latest && latest._id.equals(message._id)) {
      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { lastMessageText: UNSENT_TEXT } }
      );

      conversation.lastMessageText = UNSENT_TEXT;
    }

    const payload = serializeMessage(message);

    emitToParticipants(
      req,
      conversation,
      'message:updated',
      payload
    );

    res.json({
      success: true,
      message: payload,
    });
  }
);

// Avoid overlapping AI replies in this server process.
const aiInFlight = new Set();

async function runAi(req, conversation, userMessage) {
  const key = String(conversation._id);

  if (aiInFlight.has(key)) {
    throw new AiError(
      'AI_BUSY',
      'The assistant is still answering your previous message.'
    );
  }

  aiInFlight.add(key);

  try {
    const aiClientId = `ai-${userMessage.id}`;

    const existing = await Message.findOne({
      conversation: conversation._id,
      clientId: aiClientId,
    });

    if (existing) return existing;

    // Exclude deleted and unsent messages from AI context.
    const history = (
      await Message.find({
        conversation: conversation._id,
        createdAt: { $lte: userMessage.createdAt },
        deletedFor: { $ne: req.user._id },
        unsentAt: null,
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .lean()
    ).reverse();

    const text = await generateAiReply(history);

    let aiMessage;

    try {
      aiMessage = await Message.create({
        conversation: conversation._id,
        sender: null,
        role: 'ai',
        text,
        clientId: aiClientId,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;

      aiMessage = await Message.findOne({
        conversation: conversation._id,
        clientId: aiClientId,
      });
    }

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageText: text.slice(0, 120),
          lastMessageAt: aiMessage.createdAt,
        },
      }
    );

    emitToParticipants(
      req,
      conversation,
      'message:new',
      serializeMessage(aiMessage)
    );

    return aiMessage;
  } finally {
    aiInFlight.delete(key);
  }
}

const aiFailure = (error) =>
  error instanceof AiError
    ? { code: error.code, message: error.message }
    : {
        code: 'AI_FAILED',
        message: 'The assistant could not answer. Please retry.',
      };

// Send a message and optionally generate an AI response.
router.post('/:id/messages', async (req, res) => {
  const conversation = await loadConversation(req, res);
  if (!conversation) return;

  const { errors, value } = validateMessage(req.body);

  if (hasErrors(errors)) {
    return res.status(400).json({
      error: 'Message was not sent.',
      fields: errors,
    });
  }

  let message;
  let duplicate = false;

  try {
    message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      role: 'user',
      text: value.text,
      clientId: value.clientId,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;

    message = await Message.findOne({
      conversation: conversation._id,
      clientId: value.clientId,
      sender: req.user._id,
    });

    if (!message) {
      return res.status(409).json({
        error: 'Message id already used.',
      });
    }

    duplicate = true;
  }

  if (!duplicate) {
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageText: message.text.slice(0, 120),
          lastMessageAt: message.createdAt,
        },
      }
    );

    emitToParticipants(
      req,
      conversation,
      'message:new',
      serializeMessage(message)
    );
  }

  const body = {
    message: serializeMessage(message),
    duplicate,
  };

  if (conversation.type === 'ai') {
    try {
      body.ai = {
        message: serializeMessage(
          await runAi(req, conversation, message)
        ),
      };
    } catch (error) {
      body.ai = { error: aiFailure(error) };
    }
  }

  res.status(duplicate ? 200 : 201).json(body);
});

// Retry AI response for a user's own message.
router.post(
  '/:id/messages/:messageId/ai-retry',
  async (req, res) => {
    const conversation = await loadConversation(req, res);
    if (!conversation) return;

    if (conversation.type !== 'ai') {
      return res.status(400).json({
        error: 'Only the assistant chat supports this.',
      });
    }

    if (!mongoose.isValidObjectId(req.params.messageId)) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const userMessage = await Message.findOne({
      _id: req.params.messageId,
      conversation: conversation._id,
      role: 'user',
      sender: req.user._id,
      unsentAt: null,
    });

    if (!userMessage) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    try {
      const aiMessage = await runAi(req, conversation, userMessage);

      res.json({
        ai: {
          message: serializeMessage(aiMessage),
        },
      });
    } catch (error) {
      res.json({
        ai: { error: aiFailure(error) },
      });
    }
  }
);

export default router;
