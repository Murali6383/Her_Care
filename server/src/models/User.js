import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    bio: { type: String, default: '', maxlength: 300 },
    location: { type: String, default: '', maxlength: 80 },
    phone: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

// Private view: only ever returned to the owner.
userSchema.methods.toPrivate = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    displayName: this.displayName,
    bio: this.bio,
    location: this.location,
    phone: this.phone,
    avatarUrl: this.avatarUrl,
    createdAt: this.createdAt,
  };
};

// Public view: no email, no phone.
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    displayName: this.displayName,
    bio: this.bio,
    location: this.location,
    avatarUrl: this.avatarUrl,
  };
};

export const User = mongoose.model('User', userSchema);
