import mongoose from "mongoose";
import NodeCache from "node-cache";
import PaymentAccount from "../models/paymentAccount.model.js";
import PaymentAccountVersion from "../models/paymentAccountVersion.model.js";
import SecurityAuditLog from "../models/securityAuditLog.model.js";
import SecurityAlert from "../models/securityAlert.model.js";
import { verifyPasswordOrThrow } from "../services/stepUpAuth.service.js";
import { processAndUploadQrImage, verifyAndResolveQrKey } from "../services/qrImage.service.js";
import { asyncErrorHandler } from "../utils/asyncErrorHandler.js";
import CustomError from "../utils/customError.js";

// Cache for public payment accounts (60-second TTL per plan 10.3)
export const paymentAccountsCache = new NodeCache({ stdTTL: 60 });
export const PUBLIC_CACHE_KEY = "public_payment_accounts";

const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  req.ip ||
  "unknown";

const getUserAgent = (req) => req.headers["user-agent"] || "unknown";

// =========================================================================
// OWNER ENDPOINTS (protect + permissionGranted("owner"))
// =========================================================================

/**
 * 1. GET /api/v1/payment-accounts
 * Fetch all payment accounts (active & inactive) with their historical version logs.
 */
export const getPaymentAccounts = asyncErrorHandler(async (req, res, next) => {
  const accounts = await PaymentAccount.find()
    .sort({ sortOrder: 1, createdAt: 1 })
    .populate("updatedBy", "name role");

  const accountIds = accounts.map((a) => a._id);
  const allVersions = await PaymentAccountVersion.find({
    paymentAccountId: { $in: accountIds },
  })
    .sort({ version: -1 })
    .populate("savedBy", "name role");

  const versionsByAccountId = {};
  for (const v of allVersions) {
    const k = v.paymentAccountId.toString();
    if (!versionsByAccountId[k]) versionsByAccountId[k] = [];
    versionsByAccountId[k].push(v);
  }

  const data = accounts.map((a) => ({
    ...a.toObject(),
    history: versionsByAccountId[a._id.toString()] || [],
  }));

  res.status(200).json({
    success: true,
    message: "Payment accounts fetched successfully",
    data,
  });
});

/**
 * 2. POST /api/v1/payment-accounts/qr-upload
 * Step-up authenticated upload of QR image: validates magic bytes, sharp sanitize, jsQR decode, R2 store.
 */
export const uploadQrImage = asyncErrorHandler(async (req, res, next) => {
  const password = req.body.password;
  await verifyPasswordOrThrow(req.user._id, password, req);

  if (!req.file || !req.file.buffer) {
    return next(new CustomError(400, "Please upload a QR image file"));
  }

  const qrData = await processAndUploadQrImage(req.file.buffer);

  res.status(200).json({
    success: true,
    message: "QR code uploaded, decoded, and validated successfully",
    data: qrData,
  });
});

/**
 * 3. POST /api/v1/payment-accounts
 * Create new payment account with password step-up verification. Live immediately (S3).
 */
export const createPaymentAccount = asyncErrorHandler(async (req, res, next) => {
  const {
    password,
    provider,
    displayName,
    accountName,
    accountNumber,
    brandColor,
    textColor,
    qrImageKey,
    qrChecked,
    sortOrder,
  } = req.body;

  // Reject client-provided QR URLs, hashes, or decoded text (Problem 1)
  if (
    req.body.qrImageUrl !== undefined ||
    req.body.qrSha256 !== undefined ||
    req.body.qrDecodedText !== undefined
  ) {
    return next(
      new CustomError(
        400,
        "Client cannot provide qrImageUrl, qrSha256, or qrDecodedText. Only qrImageKey is allowed."
      )
    );
  }

  await verifyPasswordOrThrow(req.user._id, password, req);

  const effectiveDisplayName = displayName || provider;

  if (!provider || !accountName || !accountNumber) {
    return next(
      new CustomError(
        400,
        "Provider, account name, and account number are required"
      )
    );
  }

  // If a QR image is attached, require explicit confirmation that the owner checked the decoded QR (S4)
  // and resolve it strictly from R2 storage (Problem 1)
  let resolvedQr = null;
  if (qrImageKey) {
    if (qrChecked !== true && qrChecked !== "true") {
      return next(
        new CustomError(
          400,
          "You must tick 'I checked the account in the decoded QR' before saving a QR code"
        )
      );
    }
    resolvedQr = await verifyAndResolveQrKey(qrImageKey);
  }

  const existingAccount = await PaymentAccount.findOne({ provider });
  if (existingAccount) {
    return next(
      new CustomError(
        400,
        `Payment account for provider '${provider}' already exists. Please edit the existing account.`
      )
    );
  }

  const session = await mongoose.startSession();
  let createdAccount;

  await session.withTransaction(async () => {
    const accountDoc = new PaymentAccount({
      provider,
      displayName: effectiveDisplayName,
      accountName,
      accountNumber,
      brandColor: brandColor || "#0B0B45",
      textColor: textColor || "#FFFFFF",
      qrImageUrl: resolvedQr?.url || null,
      qrImageKey: resolvedQr?.key || null,
      qrSha256: resolvedQr?.sha256 || null,
      qrDecodedText: resolvedQr?.decodedText || null,
      sortOrder: Number(sortOrder) || 0,
      version: 1,
      isActive: true,
      updatedBy: req.user._id,
    });

    createdAccount = await accountDoc.save({ session });

    // Save initial version snapshot (S3, immutable)
    await PaymentAccountVersion.create(
      [
        {
          paymentAccountId: createdAccount._id,
          version: 1,
          provider: createdAccount.provider,
          displayName: createdAccount.displayName,
          accountName: createdAccount.accountName,
          accountNumber: createdAccount.accountNumber,
          brandColor: createdAccount.brandColor,
          textColor: createdAccount.textColor,
          qrImageUrl: createdAccount.qrImageUrl,
          qrImageKey: createdAccount.qrImageKey,
          qrSha256: createdAccount.qrSha256,
          qrDecodedText: createdAccount.qrDecodedText,
          sortOrder: createdAccount.sortOrder,
          isActive: createdAccount.isActive,
          changeType: "CREATE",
          savedBy: req.user._id,
          savedAt: new Date(),
        },
      ],
      { session }
    );

    // Append-only audit log (S7)
    await SecurityAuditLog.create(
      [
        {
          action: "CREATE",
          entity: "paymentAccount",
          entityId: createdAccount._id,
          adminId: req.user._id,
          adminName: req.user.name,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
          after: createdAccount.toObject(),
          details: {
            provider,
            accountNumber,
            hasQr: Boolean(createdAccount.qrSha256),
          },
        },
      ],
      { session }
    );

    // Security Alert for all owners (S8)
    await SecurityAlert.create(
      [
        {
          type: "PAYMENT_ACCOUNT_CREATE",
          title: "Payment Account အသစ် ဖန်တီးပြီးစီးခြင်း",
          message: `Owner '${req.user.name}' မှ ${displayName} (${accountNumber}) အား စနစ်ထဲသို့ အသစ်ထည့်သွင်းခဲ့ပါသည်။`,
          severity: "warning",
          metadata: {
            accountId: createdAccount._id,
            provider,
            accountNumber,
            adminId: req.user._id,
          },
        },
      ],
      { session }
    );
  });

  await session.endSession();

  // Clear public cache immediately so customers see changes right away
  paymentAccountsCache.flushAll();

  res.status(201).json({
    success: true,
    message: "Payment account created successfully and is live immediately",
    data: createdAccount,
  });
});

/**
 * 4. PATCH /api/v1/payment-accounts/:id
 * Update account details and/or QR code with password verification. Live immediately (S3).
 */
export const updatePaymentAccount = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  const {
    password,
    displayName,
    accountName,
    accountNumber,
    brandColor,
    textColor,
    qrImageKey,
    qrChecked,
    sortOrder,
    isActive,
  } = req.body;

  // Reject client-provided QR URLs, hashes, or decoded text (Problem 1)
  if (
    req.body.qrImageUrl !== undefined ||
    req.body.qrSha256 !== undefined ||
    req.body.qrDecodedText !== undefined
  ) {
    return next(
      new CustomError(
        400,
        "Client cannot provide qrImageUrl, qrSha256, or qrDecodedText. Only qrImageKey is allowed."
      )
    );
  }

  await verifyPasswordOrThrow(req.user._id, password, req);

  const account = await PaymentAccount.findById(id);
  if (!account) {
    return next(new CustomError(404, "Payment account not found"));
  }

  const beforeSnapshot = account.toObject();

  // If QR image changed, enforce check confirmation (S4) and resolve strictly from R2 (Problem 1)
  let isQrChanged = false;
  let resolvedQr = null;

  if (qrImageKey !== undefined) {
    if (qrImageKey === null || qrImageKey === "") {
      if (account.qrImageKey !== null) {
        isQrChanged = true;
      }
    } else {
      if (qrImageKey !== account.qrImageKey) {
        isQrChanged = true;
        if (qrChecked !== true && qrChecked !== "true") {
          return next(
            new CustomError(
              400,
              "You must tick 'I checked the account in the decoded QR' before saving a new QR code"
            )
          );
        }
        resolvedQr = await verifyAndResolveQrKey(qrImageKey);
      }
    }
  }

  const nextVersion = account.version + 1;
  const session = await mongoose.startSession();
  let updatedAccount;

  await session.withTransaction(async () => {
    if (displayName !== undefined) account.displayName = displayName;
    if (accountName !== undefined) account.accountName = accountName;
    if (accountNumber !== undefined) account.accountNumber = accountNumber;
    if (brandColor !== undefined) account.brandColor = brandColor;
    if (textColor !== undefined) account.textColor = textColor;
    if (sortOrder !== undefined) account.sortOrder = Number(sortOrder);
    if (isActive !== undefined) account.isActive = Boolean(isActive);

    if (qrImageKey !== undefined) {
      if (qrImageKey === null || qrImageKey === "") {
        account.qrImageUrl = null;
        account.qrImageKey = null;
        account.qrSha256 = null;
        account.qrDecodedText = null;
      } else if (resolvedQr) {
        account.qrImageUrl = resolvedQr.url;
        account.qrImageKey = resolvedQr.key;
        account.qrSha256 = resolvedQr.sha256;
        account.qrDecodedText = resolvedQr.decodedText;
      }
    }

    account.version = nextVersion;
    account.updatedBy = req.user._id;

    updatedAccount = await account.save({ session });

    // Save immutable historical version snapshot (S3)
    await PaymentAccountVersion.create(
      [
        {
          paymentAccountId: updatedAccount._id,
          version: nextVersion,
          provider: updatedAccount.provider,
          displayName: updatedAccount.displayName,
          accountName: updatedAccount.accountName,
          accountNumber: updatedAccount.accountNumber,
          brandColor: updatedAccount.brandColor,
          textColor: updatedAccount.textColor,
          qrImageUrl: updatedAccount.qrImageUrl,
          qrImageKey: updatedAccount.qrImageKey,
          qrSha256: updatedAccount.qrSha256,
          qrDecodedText: updatedAccount.qrDecodedText,
          sortOrder: updatedAccount.sortOrder,
          isActive: updatedAccount.isActive,
          changeType: "UPDATE",
          savedBy: req.user._id,
          savedAt: new Date(),
        },
      ],
      { session }
    );

    // Append-only audit log (S7)
    await SecurityAuditLog.create(
      [
        {
          action: "UPDATE",
          entity: "paymentAccount",
          entityId: updatedAccount._id,
          adminId: req.user._id,
          adminName: req.user.name,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
          before: beforeSnapshot,
          after: updatedAccount.toObject(),
          details: {
            version: nextVersion,
            qrChanged: isQrChanged,
          },
        },
      ],
      { session }
    );

    // Security Alert for all owners (S8)
    await SecurityAlert.create(
      [
        {
          type: "PAYMENT_ACCOUNT_UPDATE",
          title: "Payment Account အချက်အလက် ပြင်ဆင်ပြီးစီးခြင်း",
          message: `Owner '${req.user.name}' မှ ${updatedAccount.displayName} အား ပြင်ဆင်ခဲ့ပါသည်။ (ဗားရှင်း ${nextVersion} သို့ တိုးမြှင့်ပြီး ချက်ချင်း အသက်ဝင်ပါသည်)`,
          severity: "warning",
          metadata: {
            accountId: updatedAccount._id,
            provider: updatedAccount.provider,
            version: nextVersion,
            adminId: req.user._id,
          },
        },
      ],
      { session }
    );
  });

  await session.endSession();

  // Clear public cache immediately (S3)
  paymentAccountsCache.flushAll();

  res.status(200).json({
    success: true,
    message: "Payment account updated successfully and is live immediately",
    data: updatedAccount,
  });
});

/**
 * 5. POST /api/v1/payment-accounts/:id/retire
 * Deactivates an account (hides from shop) with password verification.
 */
export const retirePaymentAccount = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  const { password } = req.body;

  await verifyPasswordOrThrow(req.user._id, password, req);

  const account = await PaymentAccount.findById(id);
  if (!account) {
    return next(new CustomError(404, "Payment account not found"));
  }

  const beforeSnapshot = account.toObject();
  const nextVersion = account.version + 1;
  const session = await mongoose.startSession();
  let updatedAccount;

  await session.withTransaction(async () => {
    account.isActive = false;
    account.version = nextVersion;
    account.updatedBy = req.user._id;
    updatedAccount = await account.save({ session });

    await PaymentAccountVersion.create(
      [
        {
          paymentAccountId: updatedAccount._id,
          version: nextVersion,
          provider: updatedAccount.provider,
          displayName: updatedAccount.displayName,
          accountName: updatedAccount.accountName,
          accountNumber: updatedAccount.accountNumber,
          brandColor: updatedAccount.brandColor,
          textColor: updatedAccount.textColor,
          qrImageUrl: updatedAccount.qrImageUrl,
          qrImageKey: updatedAccount.qrImageKey,
          qrSha256: updatedAccount.qrSha256,
          qrDecodedText: updatedAccount.qrDecodedText,
          sortOrder: updatedAccount.sortOrder,
          isActive: false,
          changeType: "RETIRE",
          savedBy: req.user._id,
          savedAt: new Date(),
        },
      ],
      { session }
    );

    await SecurityAuditLog.create(
      [
        {
          action: "RETIRE",
          entity: "paymentAccount",
          entityId: updatedAccount._id,
          adminId: req.user._id,
          adminName: req.user.name,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
          before: beforeSnapshot,
          after: updatedAccount.toObject(),
          details: { version: nextVersion },
        },
      ],
      { session }
    );

    await SecurityAlert.create(
      [
        {
          type: "PAYMENT_ACCOUNT_RETIRE",
          title: "Payment Account ပိတ်သိမ်း (Retire) ခြင်း",
          message: `Owner '${req.user.name}' မှ ${updatedAccount.displayName} အား အွန်လိုင်းဆိုင်မှ ခေတ္တပိတ်သိမ်းခဲ့ပါသည်။`,
          severity: "warning",
          metadata: {
            accountId: updatedAccount._id,
            version: nextVersion,
            adminId: req.user._id,
          },
        },
      ],
      { session }
    );
  });

  await session.endSession();
  paymentAccountsCache.flushAll();

  res.status(200).json({
    success: true,
    message: "Payment account retired successfully",
    data: updatedAccount,
  });
});

/**
 * 6. POST /api/v1/payment-accounts/:id/rollback
 * Restores a historical version with password verification (S3, immutable rollback).
 */
export const rollbackPaymentAccount = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  const { password, targetVersion } = req.body;

  await verifyPasswordOrThrow(req.user._id, password, req);

  if (!targetVersion || isNaN(Number(targetVersion))) {
    return next(new CustomError(400, "Valid targetVersion is required"));
  }

  const account = await PaymentAccount.findById(id);
  if (!account) {
    return next(new CustomError(404, "Payment account not found"));
  }

  const versionDoc = await PaymentAccountVersion.findOne({
    paymentAccountId: account._id,
    version: Number(targetVersion),
  });

  if (!versionDoc) {
    return next(
      new CustomError(
        404,
        `Historical version ${targetVersion} not found for this account`
      )
    );
  }

  const beforeSnapshot = account.toObject();
  const nextVersion = account.version + 1;
  const session = await mongoose.startSession();
  let updatedAccount;

  await session.withTransaction(async () => {
    account.displayName = versionDoc.displayName;
    account.accountName = versionDoc.accountName;
    account.accountNumber = versionDoc.accountNumber;
    account.brandColor = versionDoc.brandColor;
    account.textColor = versionDoc.textColor;
    account.qrImageUrl = versionDoc.qrImageUrl;
    account.qrImageKey = versionDoc.qrImageKey;
    account.qrSha256 = versionDoc.qrSha256;
    account.qrDecodedText = versionDoc.qrDecodedText;
    account.isActive = versionDoc.isActive;
    account.sortOrder = versionDoc.sortOrder;

    account.version = nextVersion;
    account.updatedBy = req.user._id;

    updatedAccount = await account.save({ session });

    await PaymentAccountVersion.create(
      [
        {
          paymentAccountId: updatedAccount._id,
          version: nextVersion,
          provider: updatedAccount.provider,
          displayName: updatedAccount.displayName,
          accountName: updatedAccount.accountName,
          accountNumber: updatedAccount.accountNumber,
          brandColor: updatedAccount.brandColor,
          textColor: updatedAccount.textColor,
          qrImageUrl: updatedAccount.qrImageUrl,
          qrImageKey: updatedAccount.qrImageKey,
          qrSha256: updatedAccount.qrSha256,
          qrDecodedText: updatedAccount.qrDecodedText,
          sortOrder: updatedAccount.sortOrder,
          isActive: updatedAccount.isActive,
          changeType: "ROLLBACK",
          savedBy: req.user._id,
          savedAt: new Date(),
        },
      ],
      { session }
    );

    await SecurityAuditLog.create(
      [
        {
          action: "ROLLBACK",
          entity: "paymentAccount",
          entityId: updatedAccount._id,
          adminId: req.user._id,
          adminName: req.user.name,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
          before: beforeSnapshot,
          after: updatedAccount.toObject(),
          details: {
            rolledBackToVersion: Number(targetVersion),
            newVersion: nextVersion,
          },
        },
      ],
      { session }
    );

    await SecurityAlert.create(
      [
        {
          type: "PAYMENT_ACCOUNT_ROLLBACK",
          title: "Payment Account မူလဗားရှင်းသို့ ပြန်လည်ပြောင်းလဲခြင်း (Rollback)",
          message: `Owner '${req.user.name}' မှ ${updatedAccount.displayName} အား ဗားရှင်း ${targetVersion} သို့ ပြန်လည် rollback လုပ်ခဲ့ပါသည်။ (ဗားရှင်းအသစ်: ${nextVersion})`,
          severity: "warning",
          metadata: {
            accountId: updatedAccount._id,
            rolledBackToVersion: Number(targetVersion),
            newVersion: nextVersion,
            adminId: req.user._id,
          },
        },
      ],
      { session }
    );
  });

  await session.endSession();
  paymentAccountsCache.flushAll();

  res.status(200).json({
    success: true,
    message: `Payment account rolled back to version ${targetVersion} successfully (saved as version ${nextVersion})`,
    data: updatedAccount,
  });
});

/**
 * 7. GET /api/v1/security-audit-log
 * Read-only security audit log for owners.
 */
export const getSecurityAuditLogs = asyncErrorHandler(async (req, res, next) => {
  const { entity = "paymentAccount", page = 1, limit = 50 } = req.query;

  const query = {};
  if (entity) query.entity = entity;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    SecurityAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("adminId", "name role"),
    SecurityAuditLog.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    message: "Security audit logs fetched successfully",
    data: logs,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  });
});

/**
 * 8. GET /api/v1/security-alerts
 * Fetch alerts for owner notification banner (S8).
 */
export const getSecurityAlerts = asyncErrorHandler(async (req, res, next) => {
  const unacknowledgedOnly = String(req.query.unacknowledgedOnly) === "true";
  const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));

  // "Unacknowledged" is per owner: alerts this owner has not acknowledged yet
  const notAckedByMe = { "acknowledgedBy.adminId": { $ne: req.user._id } };
  const filter = unacknowledgedOnly ? notAckedByMe : {};

  const [alerts, unacknowledgedCount] = await Promise.all([
    SecurityAlert.find(filter).sort({ createdAt: -1 }).limit(limitNum),
    SecurityAlert.countDocuments(notAckedByMe),
  ]);

  const adminIdStr = req.user._id.toString();

  const formatted = alerts.map((a) => {
    const isAcknowledged = (a.acknowledgedBy || []).some(
      (ack) => ack.adminId && ack.adminId.toString() === adminIdStr
    );
    return {
      ...a.toObject(),
      isAcknowledged,
    };
  });

  res.status(200).json({
    success: true,
    message: "Security alerts fetched successfully",
    unacknowledgedCount,
    data: formatted,
  });
});

/**
 * 9b. POST /api/v1/security-alerts/ack-all
 * Owner acknowledges every alert they have not acknowledged yet.
 * Needs the password again, so a stolen session cannot hide all alerts in one click.
 */
export const acknowledgeAllSecurityAlerts = asyncErrorHandler(
  async (req, res, next) => {
    await verifyPasswordOrThrow(req.user._id, req.body?.password, req);

    const notAckedByMe = { "acknowledgedBy.adminId": { $ne: req.user._id } };
    const pending = await SecurityAlert.find(notAckedByMe).select("_id type");

    if (pending.length > 0) {
      await SecurityAlert.updateMany(
        { _id: { $in: pending.map((a) => a._id) } },
        {
          $push: {
            acknowledgedBy: {
              adminId: req.user._id,
              adminName: req.user.name,
              acknowledgedAt: new Date(),
            },
          },
        }
      );

      await SecurityAuditLog.create({
        action: "ALERT_ACK",
        entity: "securityAlert",
        entityId: req.user._id,
        adminId: req.user._id,
        adminName: req.user.name,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        details: {
          bulk: true,
          count: pending.length,
          alertIds: pending.map((a) => a._id),
          alertTypes: [...new Set(pending.map((a) => a.type))],
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `${pending.length} security alert(s) acknowledged successfully`,
      data: { acknowledgedCount: pending.length },
    });
  }
);

/**
 * 9. POST /api/v1/security-alerts/:id/ack
 * Owner acknowledges a security alert.
 */
export const acknowledgeSecurityAlert = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;
    const alert = await SecurityAlert.findById(id);

    if (!alert) {
      return next(new CustomError(404, "Security alert not found"));
    }

    const adminIdStr = req.user._id.toString();
    const alreadyAcked = (alert.acknowledgedBy || []).some(
      (ack) => ack.adminId && ack.adminId.toString() === adminIdStr
    );

    if (!alreadyAcked) {
      alert.acknowledgedBy.push({
        adminId: req.user._id,
        adminName: req.user.name,
        acknowledgedAt: new Date(),
      });
      await alert.save();

      // Log alert acknowledgment
      await SecurityAuditLog.create({
        action: "ALERT_ACK",
        entity: "securityAlert",
        entityId: alert._id,
        adminId: req.user._id,
        adminName: req.user.name,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { alertType: alert.type, alertTitle: alert.title },
      });
    }

    res.status(200).json({
      success: true,
      message: "Security alert acknowledged successfully",
      data: {
        ...alert.toObject(),
        isAcknowledged: true,
      },
    });
  }
);

// =========================================================================
// PUBLIC E-COMMERCE ENDPOINT (No auth required, 60s cache, active only)
// =========================================================================

/**
 * 10. GET /api/v1/ecommerce/payment-accounts
 * Publicly accessible list of active payment accounts for online checkout.
 * Never leaks admin IDs, decoded QR text, or inactive accounts.
 */
export const getPublicPaymentAccounts = asyncErrorHandler(
  async (req, res, next) => {
    const cached = paymentAccountsCache.get(PUBLIC_CACHE_KEY);
    if (cached) {
      return res.status(200).json({
        status: "success",
        data: cached,
      });
    }

    const activeAccounts = await PaymentAccount.find({ isActive: true }).sort({
      sortOrder: 1,
      createdAt: 1,
    });

    const publicData = activeAccounts.map((a) => ({
      id: a.provider,
      provider: a.provider,
      displayName: a.displayName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      brandColor: a.brandColor,
      textColor: a.textColor,
      qrImageUrl: a.qrImageUrl,
      qrSha256: a.qrSha256,
      version: a.version,
    }));

    paymentAccountsCache.set(PUBLIC_CACHE_KEY, publicData, 60);

    res.status(200).json({
      status: "success",
      data: publicData,
    });
  }
);
