import * as crypto from 'node:crypto';
import { promisify } from 'node:util';
import validator from 'validator';
import CustomError from '../utils/customError.js';

const minLength = 15;
const maxLength = 128;
const saltBytes = 16;
const hashBytes = 32;
const deriveKey = crypto.argon2 && promisify(crypto.argon2);
// Use the same work factor when an email doesn't match an account.
const dummyHash = `${Buffer.alloc(saltBytes).toString('base64url')}.${Buffer.alloc(hashBytes).toString('base64url')}`;

export const newCustomerToken = () => crypto.randomBytes(32).toString('base64url');
export const hashCustomerToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const isCustomerToken = (token) => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

export function safeTokenMatch(actual, expected) {
  return isCustomerToken(actual) && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function customerEmail(input) {
  const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !validator.isEmail(email)) {
    throw new CustomError(400, 'Enter a valid email address.', 'CUSTOMER_EMAIL_INVALID');
  }
  return email;
}

export function customerPassword(input, { newPassword = false } = {}) {
  const length = typeof input === 'string' ? Array.from(input).length : 0;
  if (length < (newPassword ? minLength : 1) || length > maxLength) {
    throw new CustomError(400, 'Enter a valid password.', 'CUSTOMER_PASSWORD_INVALID');
  }
  return input;
}

async function hashWithSalt(password, salt) {
  if (!deriveKey) throw new Error('Customer login requires Node.js 24.7 or newer.');
  return deriveKey('argon2id', {
    message: Buffer.from(password), nonce: salt, parallelism: 1,
    tagLength: hashBytes, memory: 19456, passes: 2,
  });
}

export async function hashCustomerPassword(password) {
  const salt = crypto.randomBytes(saltBytes);
  const hash = await hashWithSalt(password, salt);
  return `${salt.toString('base64url')}.${hash.toString('base64url')}`;
}

export async function verifyCustomerPassword(password, storedHash = dummyHash) {
  const [salt, hash] = storedHash.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (salt.length !== saltBytes || !hash || hash.length !== hashBytes) return false;
  const result = await hashWithSalt(password, salt);
  return crypto.timingSafeEqual(result, hash);
}
