import mongoose from "mongoose";

const securityAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "RETIRE",
        "ROLLBACK",
        "PASSWORD_FAILURE",
        "PASSWORD_LOCKOUT",
        "ALERT_ACK",
      ],
      index: true,
    },
    entity: {
      type: String,
      default: "paymentAccount",
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    adminName: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Immutability hooks: strictly prevent update or delete operations on security audit logs
const throwImmutableError = function () {
  throw new Error("Security audit logs are append-only and cannot be modified or deleted.");
};

securityAuditLogSchema.pre("updateOne", throwImmutableError);
securityAuditLogSchema.pre("findOneAndUpdate", throwImmutableError);
securityAuditLogSchema.pre("updateMany", throwImmutableError);
securityAuditLogSchema.pre("deleteOne", throwImmutableError);
securityAuditLogSchema.pre("deleteMany", throwImmutableError);
securityAuditLogSchema.pre("findOneAndDelete", throwImmutableError);
securityAuditLogSchema.pre("findOneAndRemove", throwImmutableError);

securityAuditLogSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error(
      "Security audit logs are append-only and cannot be modified once created."
    );
  }
});

const SecurityAuditLog = mongoose.model("SecurityAuditLog", securityAuditLogSchema);

export default SecurityAuditLog;
