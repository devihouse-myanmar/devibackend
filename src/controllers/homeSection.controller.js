import mongoose from "mongoose";
import HomeSection from "../models/homeSection.model.js";
import { asyncErrorHandler } from "../utils/asyncErrorHandler.js";
import CustomError from "../utils/customError.js";
import {
  getEcommerceDesigns,
  getBestSellingDesigns,
} from "../services/ecommerceCatalog.service.js";
import { getOrCreateEcommerceStorefront } from "./ecommerce.controller.js";

const CARDS_PER_SECTION = 3;
const EDITABLE_FIELDS = [
  "title",
  "description",
  "buttonLabel",
  "slug",
  "source",
  "designs",
  "tag",
  "bestSellingDays",
  "isActive",
];

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// Myanmar titles have no latin letters, so fall back to a generated slug
const makeUniqueSlug = async (preferred, excludeId) => {
  const base = toSlug(preferred) || `section-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 2; await HomeSection.exists({ slug, _id: { $ne: excludeId } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
};

const pickEditable = (body) => {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (Array.isArray(data.designs)) {
    data.designs = [...new Set(data.designs.map((d) => String(d).trim()).filter(Boolean))];
  }
  return data;
};

// The designs a section shows, priced for the online shop
export const resolveSectionDesigns = async (
  section,
  { page = 1, limit = CARDS_PER_SECTION, pattern, size, q } = {},
) => {
  const ecommerceStore = await getOrCreateEcommerceStorefront();
  const base = {
    storefrontId: ecommerceStore._id,
    page,
    limit,
    ...(size && String(size).trim() ? { size: String(size).trim() } : {}),
    ...(q && String(q).trim() ? { search: String(q).trim() } : {}),
  };

  switch (section.source) {
    case "manual": {
      let categories = section.designs || [];
      if (Array.isArray(pattern) && pattern.length > 0) {
        const patternSet = new Set(pattern);
        categories = categories.filter((c) => patternSet.has(c));
      }
      return getEcommerceDesigns({ ...base, categories, order: "given" });
    }
    case "tag": {
      return getEcommerceDesigns({
        ...base,
        tag: section.tag,
        ...(Array.isArray(pattern) && pattern.length > 0 ? { categories: pattern } : {}),
      });
    }
    case "bestSelling": {
      let categories = await getBestSellingDesigns(section.bestSellingDays || 30);
      if (Array.isArray(pattern) && pattern.length > 0) {
        const patternSet = new Set(pattern);
        categories = categories.filter((c) => patternSet.has(c));
      }
      return getEcommerceDesigns({
        ...base,
        categories,
        order: "given",
      });
    }
    case "newest":
    default:
      return getEcommerceDesigns({
        ...base,
        ...(Array.isArray(pattern) && pattern.length > 0 ? { categories: pattern } : {}),
      });
  }
};

const toPublicSection = (section) => ({
  title: section.title,
  description: section.description,
  buttonLabel: section.buttonLabel,
  slug: section.slug,
  source: section.source,
});

// ---------- Public (tokenless) ----------

export const getPublicHomeSections = asyncErrorHandler(async (req, res, next) => {
  const sections = await HomeSection.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 });

  const resolved = await Promise.all(
    sections.map(async (section) => {
      const { data } = await resolveSectionDesigns(section);
      return { ...toPublicSection(section), designs: data };
    }),
  );

  res.status(200).json({
    status: "success",
    data: resolved.filter((s) => s.designs.length > 0),
  });
});

export const getPublicHomeSectionProducts = asyncErrorHandler(async (req, res, next) => {
  const section = await HomeSection.findOne({
    slug: String(req.params.slug || "").toLowerCase(),
    isActive: true,
  });
  if (!section) {
    return next(new CustomError(404, "Section not found"));
  }

  const { pattern, size, q } = req.query;
  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  let patternsArray = undefined;
  if (pattern && typeof pattern === "string") {
    patternsArray = pattern
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (patternsArray.length === 0) patternsArray = undefined;
  }

  const { total, data } = await resolveSectionDesigns(section, {
    page: pageNum,
    limit: limitNum,
    pattern: patternsArray,
    size: size && typeof size === "string" ? size.trim() : undefined,
    q: q && typeof q === "string" ? q.trim() : undefined,
  });

  res.status(200).json({
    status: "success",
    section: toPublicSection(section),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    data,
  });
});

// ---------- Admin (owner, admin) ----------

export const getAllHomeSections = asyncErrorHandler(async (req, res, next) => {
  const sections = await HomeSection.find()
    .sort({ sortOrder: 1, createdAt: 1 })
    .populate("updatedBy", "name role");

  res.status(200).json({ success: true, message: "Sections retrieved successfully", data: sections });
});

export const createHomeSection = asyncErrorHandler(async (req, res, next) => {
  const data = pickEditable(req.body);
  data.slug = await makeUniqueSlug(data.slug || data.title);
  data.updatedBy = req.user?._id || null;

  const last = await HomeSection.findOne().sort({ sortOrder: -1 }).select("sortOrder");
  data.sortOrder = (last?.sortOrder ?? -1) + 1;

  const section = await HomeSection.create(data);
  res.status(201).json({ success: true, message: "Section created successfully", data: section });
});

export const updateHomeSection = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new CustomError(400, "Invalid section ID"));
  }

  const section = await HomeSection.findById(id);
  if (!section) {
    return next(new CustomError(404, "Section not found"));
  }

  const data = pickEditable(req.body);
  if (data.slug !== undefined) {
    data.slug = await makeUniqueSlug(data.slug || section.title, section._id);
  }
  section.set(data);
  section.updatedBy = req.user?._id || null;
  await section.save();

  res.status(200).json({ success: true, message: "Section updated successfully", data: section });
});

export const reorderHomeSections = asyncErrorHandler(async (req, res, next) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    return next(new CustomError(400, "ids must be a non-empty array of section IDs"));
  }

  await HomeSection.bulkWrite(
    ids.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { $set: { sortOrder: index } } },
    })),
  );

  const sections = await HomeSection.find().sort({ sortOrder: 1, createdAt: 1 });
  res.status(200).json({ success: true, message: "Sections reordered successfully", data: sections });
});

export const deleteHomeSection = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new CustomError(400, "Invalid section ID"));
  }

  const section = await HomeSection.findByIdAndDelete(id);
  if (!section) {
    return next(new CustomError(404, "Section not found"));
  }

  res.status(200).json({ success: true, message: "Section deleted successfully" });
});

// Preview the cards an (unsaved) section would show, without storing it
export const previewHomeSection = asyncErrorHandler(async (req, res, next) => {
  const draft = new HomeSection({ ...pickEditable(req.body), slug: "preview" });
  try {
    await draft.validate();
  } catch (validationError) {
    const message =
      Object.values(validationError.errors || {})[0]?.message || "Invalid section";
    return next(new CustomError(400, message));
  }

  const { total, data } = await resolveSectionDesigns(draft);
  res.status(200).json({ success: true, message: "Preview generated", total, data });
});
