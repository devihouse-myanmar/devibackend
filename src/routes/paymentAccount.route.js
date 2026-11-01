import express from "express";
import {
  getPaymentAccounts,
  uploadQrImage,
  createPaymentAccount,
  updatePaymentAccount,
  retirePaymentAccount,
  rollbackPaymentAccount,
  getSecurityAuditLogs,
  getSecurityAlerts,
  acknowledgeSecurityAlert,
  getPublicPaymentAccounts,
} from "../controllers/paymentAccount.controller.js";
import {
  protect,
  permissionGranted,
} from "../controllers/administrationPolicy.controller.js";
import { multerQrUpload } from "../middlewares/multerQrUpload.middleware.js";
import { paymentAccountRateLimiter } from "../middlewares/paymentAccountRateLimiter.middleware.js";

const router = express.Router();

// =========================================================================
// PUBLIC ROUTE (Online Shop Checkout)
// =========================================================================
router.get("/ecommerce/payment-accounts", getPublicPaymentAccounts);

// =========================================================================
// OWNER-ONLY PROTECTED ROUTES (S1, S2, S7, S8)
// =========================================================================
router.get(
  "/payment-accounts",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  getPaymentAccounts
);

router.post(
  "/payment-accounts/qr-upload",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  multerQrUpload("qrImage"),
  uploadQrImage
);

router.post(
  "/payment-accounts",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  createPaymentAccount
);

router.patch(
  "/payment-accounts/:id",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  updatePaymentAccount
);

router.post(
  "/payment-accounts/:id/retire",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  retirePaymentAccount
);

router.post(
  "/payment-accounts/:id/rollback",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  rollbackPaymentAccount
);

router.get(
  "/security-audit-log",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  getSecurityAuditLogs
);

router.get(
  "/security-alerts",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  getSecurityAlerts
);

router.post(
  "/security-alerts/:id/ack",
  protect,
  permissionGranted("owner"),
  paymentAccountRateLimiter,
  acknowledgeSecurityAlert
);

export default router;
