import mongoose from "mongoose";

const paymentAccountSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: [true, "Payment provider is required"],
      enum: {
        values: ["kpay", "wave", "aya", "uabpay", "cbpay", "bank_transfer"],
        message: "{VALUE} is not a supported payment provider",
      },
      trim: true,
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
    },
    accountName: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      trim: true,
    },
    brandColor: {
      type: String,
      trim: true,
      default: "#0B0B45",
    },
    textColor: {
      type: String,
      trim: true,
      default: "#FFFFFF",
    },
    qrImageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    qrImageKey: {
      type: String,
      default: null,
      trim: true,
    },
    qrSha256: {
      type: String,
      default: null,
      trim: true,
    },
    qrDecodedText: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentAccountSchema.index({ provider: 1, isActive: 1 });

const PaymentAccount = mongoose.model("PaymentAccount", paymentAccountSchema);

export default PaymentAccount;
