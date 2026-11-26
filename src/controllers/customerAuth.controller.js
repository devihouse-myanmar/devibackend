import { setTimeout as delay } from 'node:timers/promises';
import Customer from '../models/customer.model.js';
import CustomError from '../utils/customError.js';
import {
  customerPassword, hashCustomerPassword, hashCustomerToken, isCustomerToken,
  newCustomerToken, verifyCustomerPassword,
} from '../services/customerCredentials.service.js';
import { customerMailer } from '../services/customerMail.service.js';
import {
  customerProfile, endCustomerSession, getCustomerSession, startCustomerSession,
} from '../services/customerSession.service.js';
import { checkCustomerCsrf } from '../middlewares/customerAuth.middleware.js';

const verificationLifetime = 24 * 60 * 60_000;
const resetLifetime = 30 * 60_000;
const emailResponseMs = 2300;

function emailToken(lifetime) {
  const token = newCustomerToken();
  return { token, stored: { hash: hashCustomerToken(token), expiresAt: new Date(Date.now() + lifetime) } };
}

async function acceptedEmail(res, startedAt) {
  await delay(Math.max(0, emailResponseMs - (Date.now() - startedAt)));
  res.status(202).json({ status: 'accepted' });
}

function invalidLink() {
  return new CustomError(400, 'This link is invalid or expired.', 'CUSTOMER_LINK_INVALID');
}

function tokenFilter(field, value) {
  if (!isCustomerToken(value)) throw invalidLink();
  return { [`${field}.hash`]: hashCustomerToken(value), [`${field}.expiresAt`]: { $gt: new Date() } };
}

export async function registerCustomer(req, res) {
  const startedAt = Date.now();
  const email = req.customerEmail;
  const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
  if (!displayName || displayName.length > 100) {
    throw new CustomError(400, 'Enter a name between 1 and 100 characters.', 'CUSTOMER_NAME_INVALID');
  }
  const password = customerPassword(req.body.password, { newPassword: true });
  const send = customerMailer();
  const verification = emailToken(verificationLifetime);
  const passwordHash = await hashCustomerPassword(password);
  await Customer.init();
  try {
    await Customer.create({ displayName, email, passwordHash, verification: verification.stored });
    await send(email, 'verification', verification.token);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  await acceptedEmail(res, startedAt);
}

async function sendCustomerLink(req, res, field, lifetime, filter = {}) {
  const startedAt = Date.now();
  const send = customerMailer();
  const { token, stored } = emailToken(lifetime);
  const email = req.customerEmail;
  const updated = await Customer.findOneAndUpdate({ email, ...filter }, { $set: { [field]: stored } });
  if (updated) await send(email, field, token);
  await acceptedEmail(res, startedAt);
}

export const resendCustomerVerification = (req, res) =>
  sendCustomerLink(req, res, 'verification', verificationLifetime, { emailVerifiedAt: null });

export const forgotCustomerPassword = (req, res) => sendCustomerLink(req, res, 'passwordReset', resetLifetime);

export async function verifyCustomerEmail(req, res) {
  const filter = { ...tokenFilter('verification', req.body?.token), emailVerifiedAt: null };
  const password = customerPassword(req.body?.password);
  const customer = await Customer.findOne(filter).select('+passwordHash').lean();
  // Require the password chosen during signup as well as access to the inbox.
  const matches = await verifyCustomerPassword(password, customer?.passwordHash);
  if (!customer) throw invalidLink();
  if (!matches) throw new CustomError(400, 'The registration password does not match.', 'CUSTOMER_VERIFY_PASSWORD_INVALID');

  const result = await Customer.updateOne({ ...filter, _id: customer._id, passwordHash: customer.passwordHash }, {
    $set: { emailVerifiedAt: new Date() }, $unset: { verification: 1 },
  });
  if (!result.modifiedCount) throw invalidLink();
  res.status(204).end();
}

export async function resetCustomerPassword(req, res) {
  const filter = tokenFilter('passwordReset', req.body?.token);
  const password = customerPassword(req.body?.password, { newPassword: true });
  // Consuming the token, changing the password, and revoking prior sessions are one update.
  const passwordHash = await hashCustomerPassword(password);
  const result = await Customer.updateOne(filter, [
    { $set: { passwordHash, emailVerifiedAt: { $ifNull: ['$emailVerifiedAt', '$$NOW'] },
      sessionVersion: { $add: ['$sessionVersion', 1] }, updatedAt: '$$NOW' } },
    { $unset: ['passwordReset', 'verification'] },
  ], { updatePipeline: true });
  if (!result.modifiedCount) throw invalidLink();
  res.status(204).end();
}

export async function loginCustomer(req, res) {
  const password = customerPassword(req.body?.password);
  const customer = await Customer.findOne({ email: req.customerEmail }).select('+passwordHash +sessionVersion');
  const matches = await verifyCustomerPassword(password, customer?.passwordHash);
  if (!customer || !matches) {
    throw new CustomError(401, 'Email or password is incorrect.', 'CUSTOMER_LOGIN_INVALID');
  }
  if (!customer.emailVerifiedAt) {
    throw new CustomError(403, 'Verify your email to sign in.', 'CUSTOMER_EMAIL_UNVERIFIED');
  }
  await startCustomerSession(req, res, customer);
  res.json({ customer: customerProfile(customer) });
}

export function getCurrentCustomer(req, res) {
  const { customer, csrfToken } = req.customerAuth;
  res.json({ customer: customerProfile(customer), csrfToken });
}

export async function logoutCustomer(req, res) {
  const session = await getCustomerSession(req);
  if (session) checkCustomerCsrf(req, session);
  await endCustomerSession(res, session);
  res.status(204).end();
}
