import mongoose from 'mongoose';

const customerSessionSchema = new mongoose.Schema({
  _id: String,
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Customer' },
  version: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false });

export default mongoose.model('CustomerSession', customerSessionSchema);
