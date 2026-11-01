import mongoose from "mongoose";

const deliveryTownshipSchema = new mongoose.Schema(
  {
    township: {
      type: String,
      required: [true, "Township name is required"],
      trim: true,
      unique: true,
    },
    city: {
      type: String,
      trim: true,
      default: "Yangon",
    },
    fee: {
      type: Number,
      min: [0, "Fee cannot be negative"],
      default: null, // null = not set -> feePending
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

deliveryTownshipSchema.index({ isActive: 1, sortOrder: 1 });

const DeliveryTownship = mongoose.model(
  "DeliveryTownship",
  deliveryTownshipSchema
);

export default DeliveryTownship;
