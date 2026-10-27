
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    bio: {
      type: String,
      default: '',
      maxlength: 300,
    },

    location: {
      type: String,
      default: '',
      maxlength: 80,
    },

    // Optional phone number: do not store an empty string.
    phone: {
      type: String,
      trim: true,
      default: undefined,
    },

    avatarUrl: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

// Phone numbers must be unique only when a phone number is provided.
// Missing phone fields are excluded from this index.
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    sparse: true,
  },
);

// Private view: returned only to the account owner.
userSchema.methods.toPrivate = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    displayName: this.displayName,
    bio: this.bio,
    location: this.location,
    phone: this.phone || '',
    avatarUrl: this.avatarUrl,
    createdAt: this.createdAt,
  };
};

// Public view: never expose email or phone.
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    displayName: this.displayName,
    bio: this.bio,
    location: this.location,
    avatarUrl: this.avatarUrl,
  };
};

export const User =
  mongoose.models.User || mongoose.model('User', userSchema);
