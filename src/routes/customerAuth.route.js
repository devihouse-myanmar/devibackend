import express from 'express';
import {
  registerCustomer, resendCustomerVerification, verifyCustomerEmail, loginCustomer,
  getCurrentCustomer, logoutCustomer, forgotCustomerPassword, resetCustomerPassword,
} from '../controllers/customerAuth.controller.js';
import { getCustomerOrder, listCustomerOrders } from '../controllers/customerOrders.controller.js';
import {
  requireCustomerJson, requireCustomerSession, validateCustomerOrigin,
} from '../middlewares/customerAuth.middleware.js';
import { throttleCustomer } from '../middlewares/customerThrottle.middleware.js';

const router = express.Router();
const verificationLimit = throttleCustomer('verification-delivery', { ipLimit: 16, emailLimit: 4 });
const loginLimit = throttleCustomer('login', { ipLimit: 30, emailLimit: 10 });
const forgotLimit = throttleCustomer('password-email', { ipLimit: 16, emailLimit: 4 });
const verifyLimit = throttleCustomer('verify', { ipLimit: 15 });
const resetLimit = throttleCustomer('reset', { ipLimit: 15 });

router.use(validateCustomerOrigin);
router.post('/auth/register', requireCustomerJson, verificationLimit, registerCustomer);
router.post('/auth/resend-verification', requireCustomerJson, verificationLimit, resendCustomerVerification);
router.post('/auth/verify-email', requireCustomerJson, verifyLimit, verifyCustomerEmail);
router.post('/auth/login', requireCustomerJson, loginLimit, loginCustomer);
router.get('/auth/me', requireCustomerSession, getCurrentCustomer);
router.post('/auth/logout', logoutCustomer);
router.post('/auth/forgot-password', requireCustomerJson, forgotLimit, forgotCustomerPassword);
router.post('/auth/reset-password', requireCustomerJson, resetLimit, resetCustomerPassword);
router.get('/orders', requireCustomerSession, listCustomerOrders);
router.get('/orders/:orderNumber', requireCustomerSession, getCustomerOrder);

export default router;
