
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    role: {
      type: String,
      enum: ['user', 'ai'],
      default: 'user',
    },

    text: {
      type: String,
      required: true,
      maxlength: 8000,
    },

    // Makes message retries idempotent.
    clientId: {
      type: String,
      required: true,
    },

    // Users who have hidden this message for themselves.
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // A date means the sender unsent this message for everyone.
    unsentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

messageSchema.index(
  { conversation: 1, clientId: 1 },
  { unique: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
