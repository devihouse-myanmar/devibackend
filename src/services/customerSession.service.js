import { createHmac } from 'node:crypto';
import Customer from '../models/customer.model.js';
import CustomerSession from '../models/customerSession.model.js';
import { hashCustomerToken, isCustomerToken, newCustomerToken } from './customerCredentials.service.js';

const sessionMs = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});
const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-devi_customer' : 'devi_customer';

function customerCookie(req) {
  const prefix = `${cookieName()}=`;
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  const token = cookie?.slice(prefix.length);
  return isCustomerToken(token) ? token : null;
}

const csrfFor = (token) => createHmac('sha256', token).update('devi:customer:csrf:v1').digest('base64url');

export function customerProfile(customer) {
  return { id: customer._id.toString(), displayName: customer.displayName, email: customer.email };
}

export async function getCustomerSession(req) {
  const token = customerCookie(req);
  if (!token) return null;
  const session = await CustomerSession.findOne({
    _id: hashCustomerToken(token), expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;

  const customer = await Customer.findOne({
    _id: session.customerId, sessionVersion: session.version, emailVerifiedAt: { $type: 'date' },
  }).select('displayName email').lean();
  return customer ? { customer, sessionId: session._id, csrfToken: csrfFor(token) } : null;
}

export async function startCustomerSession(req, res, customer) {
  const previous = customerCookie(req);
  if (previous) await CustomerSession.deleteOne({ _id: hashCustomerToken(previous) });
  const token = newCustomerToken();
  await CustomerSession.create({
    _id: hashCustomerToken(token), customerId: customer._id, version: customer.sessionVersion,
    expiresAt: new Date(Date.now() + sessionMs),
  });
  res.cookie(cookieName(), token, { ...cookieOptions(), maxAge: sessionMs });
}

export async function endCustomerSession(res, session) {
  if (session) await CustomerSession.deleteOne({ _id: session.sessionId });
  res.clearCookie(cookieName(), cookieOptions());
}
