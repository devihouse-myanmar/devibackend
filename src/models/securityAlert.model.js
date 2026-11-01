import mongoose from "mongoose";

const securityAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "PAYMENT_ACCOUNT_CREATE",
        "PAYMENT_ACCOUNT_UPDATE",
        "PAYMENT_ACCOUNT_RETIRE",
        "PAYMENT_ACCOUNT_ROLLBACK",
        "PASSWORD_THRESHOLD",
        "PASSWORD_LOCKOUT",
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "warning",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    acknowledgedBy: [
      {
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
          required: true,
        },
        adminName: {
          type: String,
          default: null,
        },
        acknowledgedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

const SecurityAlert = mongoose.model("SecurityAlert", securityAlertSchema);

export default SecurityAlert;
