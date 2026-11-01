import mongoose from "mongoose";

const paymentAccountVersionSchema = new mongoose.Schema(
  {
    paymentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentAccount",
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    brandColor: {
      type: String,
      default: "#0B0B45",
    },
    textColor: {
      type: String,
      default: "#FFFFFF",
    },
    qrImageUrl: {
      type: String,
      default: null,
    },
    qrImageKey: {
      type: String,
      default: null,
    },
    qrSha256: {
      type: String,
      default: null,
    },
    qrDecodedText: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    changeType: {
      type: String,
      enum: ["CREATE", "UPDATE", "RETIRE", "ROLLBACK", "INITIAL_SEED"],
      default: "UPDATE",
    },
    savedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    savedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
  }
);

paymentAccountVersionSchema.index(
  { paymentAccountId: 1, version: -1 },
  { unique: true }
);

// Immutability: prevent updating or deleting historical versions
const preventMutation = function () {
  throw new Error("PaymentAccountVersion records are immutable historical snapshots.");
};

paymentAccountVersionSchema.pre("updateOne", preventMutation);
paymentAccountVersionSchema.pre("findOneAndUpdate", preventMutation);
paymentAccountVersionSchema.pre("updateMany", preventMutation);
paymentAccountVersionSchema.pre("deleteOne", preventMutation);
paymentAccountVersionSchema.pre("deleteMany", preventMutation);
paymentAccountVersionSchema.pre("findOneAndDelete", preventMutation);
paymentAccountVersionSchema.pre("findOneAndRemove", preventMutation);

paymentAccountVersionSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error("PaymentAccountVersion records cannot be updated once saved.");
  }
});

const PaymentAccountVersion = mongoose.model(
  "PaymentAccountVersion",
  paymentAccountVersionSchema
);

export default PaymentAccountVersion;
