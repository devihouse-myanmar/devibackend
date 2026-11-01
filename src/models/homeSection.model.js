import mongoose from "mongoose";

export const HOME_SECTION_SOURCES = ["manual", "tag", "newest", "bestSelling"];

const homeSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Section title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    buttonLabel: {
      type: String,
      trim: true,
      maxlength: [60, "Button label cannot exceed 60 characters"],
      default: "ဒီဇိုင်းအားလုံး ကြည့်ရှုပါ",
    },
    // Used by the online shop in /products?section=<slug>
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [80, "Slug cannot exceed 80 characters"],
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug may only contain lowercase letters, numbers and dashes",
      ],
    },
    source: {
      type: String,
      enum: {
        values: HOME_SECTION_SOURCES,
        message: "Source must be manual, tag, newest or bestSelling",
      },
      default: "manual",
    },
    // source=manual: design (Inventory.category) names in display order
    designs: [{ type: String, trim: true }],
    // source=tag: matches Inventory.tags
    tag: { type: String, trim: true, default: "" },
    // source=bestSelling: look-back window
    bestSellingDays: {
      type: Number,
      min: [1, "Best-selling days must be at least 1"],
      max: [365, "Best-selling days cannot exceed 365"],
      default: 30,
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

homeSectionSchema.pre("validate", function () {
  if (this.source === "manual" && (!this.designs || this.designs.length === 0)) {
    this.invalidate("designs", "Pick at least one design for a manual section");
  }
  if (this.source === "tag" && !this.tag) {
    this.invalidate("tag", "Tag is required for a tag section");
  }
});

homeSectionSchema.index({ isActive: 1, sortOrder: 1 });

const HomeSection = mongoose.model("HomeSection", homeSectionSchema);
export default HomeSection;
