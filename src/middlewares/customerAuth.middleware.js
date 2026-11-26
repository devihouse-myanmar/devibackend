import { customerStorefrontOrigin } from '../services/customerMail.service.js';
import { safeTokenMatch } from '../services/customerCredentials.service.js';
import { getCustomerSession } from '../services/customerSession.service.js';
import CustomError from '../utils/customError.js';

function assertCustomerOrigin(req) {
  const origin = req.get('Origin');
  const read = req.method === 'GET' || req.method === 'HEAD';
  const fetchSite = req.get('Sec-Fetch-Site');
  if (((origin || !read) && origin !== customerStorefrontOrigin()) ||
      (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')) {
    throw new CustomError(403, 'This request origin is not allowed.', 'CUSTOMER_ORIGIN_INVALID');
  }
}

export function validateCustomerOrigin(req, _res, next) {
  assertCustomerOrigin(req);
  next();
}

export function requireCustomerJson(req, _res, next) {
  if (!req.is('application/json')) throw new CustomError(415, 'Use application/json.');
  next();
}

async function authenticatedCustomer(req) {
  const session = await getCustomerSession(req);
  if (!session) {
    throw new CustomError(401, 'Sign in to continue.', 'CUSTOMER_SIGN_IN_REQUIRED');
  }
  return session;
}

export async function requireCustomerSession(req, _res, next) {
  req.customerAuth = await authenticatedCustomer(req);
  next();
}

export function checkCustomerCsrf(req, session) {
  if (!safeTokenMatch(req.get('X-Customer-CSRF'), session.csrfToken)) {
    throw new CustomError(403, 'Refresh your session and try again.', 'CUSTOMER_CSRF_INVALID');
  }
}

export async function authorizeCustomerCheckout(req, res, next) {
  const mode = req.body?.checkoutMode;
  if (mode === undefined || mode === 'guest') return next();
  if (mode !== 'account') throw new CustomError(400, 'Invalid checkout mode.');

  res.set('Cache-Control', 'no-store');
  assertCustomerOrigin(req);
  req.customerAuth = await authenticatedCustomer(req);
  checkCustomerCsrf(req, req.customerAuth);
  next();
}

export function customerApiError(error, _req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status || error.statusCode;
  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
  }
  if (status >= 400 && status < 500) {
    return res.status(status).json({ success: false, code: 'CUSTOMER_REQUEST_INVALID', message: 'Invalid customer request.' });
  }
  console.error('[CustomerAPI] Request failed', error.name);
  res.status(500).json({ success: false, code: 'CUSTOMER_AUTH_UNAVAILABLE', message: 'Please try again later.' });
}
