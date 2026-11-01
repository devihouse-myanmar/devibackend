import Admin from "../models/admin.model.js";
import SecurityAuditLog from "../models/securityAuditLog.model.js";
import SecurityAlert from "../models/securityAlert.model.js";
import CustomError from "../utils/customError.js";

/**
 * Step-Up Authentication Service (S2, S7, S8)
 * Verifies the owner's current password for sensitive payment account operations.
 * Enforces a 30-minute lockout in MongoDB after 5 consecutive failures.
 * Raises security alerts for owners after 3 failures and upon lockout.
 *
 * @param {string|ObjectId} adminId
 * @param {string} password
 * @param {object} req - Express request object for IP and User-Agent capture
 */
export const verifyPasswordOrThrow = async (adminId, password, req) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  if (!password || typeof password !== "string" || !password.trim()) {
    throw new CustomError(400, "Current password is required for this action");
  }

  const admin = await Admin.findById(adminId).select("+password");
  if (!admin) {
    throw new CustomError(404, "Admin account not found");
  }

  // Check 30-minute lockout (survives backend restart via MongoDB persistence)
  if (admin.stepUpLockedUntil && admin.stepUpLockedUntil > new Date()) {
    const remainingMs = admin.stepUpLockedUntil.getTime() - Date.now();
    const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
    throw new CustomError(
      423,
      `Account locked due to 5 consecutive password failures. Please try again in ${remainingMins} minutes.`
    );
  }

  const isMatch = await admin.comparePasswordInDb(password, admin.password);

  if (!isMatch) {
    const currentFailures = (admin.stepUpFailures || 0) + 1;

    // Log the failed attempt in immutable SecurityAuditLog (S2, S7)
    await SecurityAuditLog.create({
      action: "PASSWORD_FAILURE",
      entity: "paymentAccount",
      entityId: admin._id,
      adminId: admin._id,
      adminName: admin.name,
      ip,
      userAgent,
      details: {
        attemptNumber: currentFailures,
        maxAttempts: 5,
        targetEndpoint: req.originalUrl,
      },
    });

    if (currentFailures >= 5) {
      // 5 Failures → 30-minute lockout
      const lockDurationMs = 30 * 60 * 1000;
      const lockedUntil = new Date(Date.now() + lockDurationMs);

      admin.stepUpFailures = currentFailures;
      admin.stepUpLockedUntil = lockedUntil;
      await admin.save();

      // Log lockout in audit log
      await SecurityAuditLog.create({
        action: "PASSWORD_LOCKOUT",
        entity: "paymentAccount",
        entityId: admin._id,
        adminId: admin._id,
        adminName: admin.name,
        ip,
        userAgent,
        details: {
          consecutiveFailures: currentFailures,
          lockedUntil,
        },
      });

      // Raise Critical Alert for all owners (S8)
      await SecurityAlert.create({
        type: "PASSWORD_LOCKOUT",
        title: "အကောင့် လုံခြုံရေးအရ ခေတ္တပိတ်ဆို့ခံရခြင်း",
        message: `အကောင့် '${admin.name}' သည် စကားဝှက် ၅ ကြိမ် ဆက်တိုက် မှားယွင်းသဖြင့် Payment Account စီမံခန့်ခွဲခွင့်ကို မိနစ် ၃၀ ကြာ ပိတ်ဆို့ထားပါသည်။`,
        severity: "critical",
        metadata: {
          adminId: admin._id,
          adminName: admin.name,
          lockedUntil,
          ip,
        },
      });

      throw new CustomError(
        423,
        "စကားဝှက် ၅ ကြိမ် ဆက်တိုက် မှားယွင်းသဖြင့် ဤလုပ်ဆောင်ချက်ကို မိနစ် ၃၀ ကြာ ပိတ်ဆို့ထားပါသည်။ (Locked out for 30 minutes)"
      );
    } else {
      admin.stepUpFailures = currentFailures;
      await admin.save();

      // Raise Warning Alert after 3 failures (S8)
      if (currentFailures >= 3) {
        await SecurityAlert.create({
          type: "PASSWORD_THRESHOLD",
          title: "စကားဝှက် အကြိမ်ကြိမ် မှားယွင်းမှု သတိပေးချက်",
          message: `အကောင့် '${admin.name}' သည် Payment Account စီမံခန့်ခွဲရာတွင် စကားဝှက် ${currentFailures} ကြိမ်တိုင် မှားယွင်းခဲ့ပါသည်။`,
          severity: "warning",
          metadata: {
            adminId: admin._id,
            adminName: admin.name,
            failures: currentFailures,
            ip,
          },
        });
      }

      throw new CustomError(
        401,
        `စကားဝှက် မှားယွင်းနေပါသည်။ (ကြိုးစားမှု ${currentFailures} / ၅)`
      );
    }
  }

  // Password matched successfully - reset failure count and lockout
  if (admin.stepUpFailures > 0 || admin.stepUpLockedUntil) {
    admin.stepUpFailures = 0;
    admin.stepUpLockedUntil = null;
    await admin.save();
  }

  return true;
};
