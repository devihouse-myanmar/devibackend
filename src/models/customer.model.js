import mongoose from 'mongoose';

const emailTokenSchema = new mongoose.Schema({
  hash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { _id: false });

const customerSchema = new mongoose.Schema({
  displayName: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  emailVerifiedAt: { type: Date, default: null },
  verification: { type: emailTokenSchema, select: false },
  passwordReset: { type: emailTokenSchema, select: false },
  sessionVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });

customerSchema.index({ 'verification.hash': 1 }, { sparse: true });
customerSchema.index({ 'passwordReset.hash': 1 }, { sparse: true });

export default mongoose.model('Customer', customerSchema);
