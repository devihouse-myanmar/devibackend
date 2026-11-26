import mongoose from 'mongoose';
import { ipKeyGenerator } from 'express-rate-limit';
import { customerEmail, hashCustomerToken } from '../services/customerCredentials.service.js';
import CustomError from '../utils/customError.js';

const counterSchema = new mongoose.Schema({
  _id: String,
  hits: Number,
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false });
const Counter = mongoose.model('CustomerAuthCounter', counterSchema);
const windowMs = 15 * 60_000;

async function count(scope, key, expiresAt) {
  const id = hashCustomerToken(JSON.stringify([scope, key, expiresAt.getTime()]));
  let counter;
  try {
    counter = await Counter.findOneAndUpdate({ _id: id }, {
      $inc: { hits: 1 }, $setOnInsert: { expiresAt },
    }, { upsert: true, returnDocument: 'after' }).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    counter = await Counter.findOneAndUpdate({ _id: id }, {
      $inc: { hits: 1 },
    }, { returnDocument: 'after' }).lean();
  }
  return counter.hits;
}

export function throttleCustomer(scope, { ipLimit, emailLimit }) {
  return async (req, res, next) => {
    const expiresAt = new Date((Math.floor(Date.now() / windowMs) + 1) * windowMs);
    const reject = () => {
      res.set('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))));
      throw new CustomError(429, 'Too many attempts. Try again later.', 'CUSTOMER_RATE_LIMIT');
    };
    const ip = ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
    if (await count(`${scope}:ip`, ip, expiresAt) > ipLimit) reject();
    if (emailLimit) {
      req.customerEmail = customerEmail(req.body?.email);
      if (await count(`${scope}:email`, req.customerEmail, expiresAt) > emailLimit) reject();
    }
    next();
  };
}
