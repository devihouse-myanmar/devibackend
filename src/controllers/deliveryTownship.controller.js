import DeliveryTownship from "../models/deliveryTownship.model.js";
import { asyncErrorHandler } from "../utils/asyncErrorHandler.js";
import CustomError from "../utils/customError.js";
import { clearDeliveryCache } from "../services/deliveryFee.service.js";

// GET /delivery-townships - List all townships for admin dashboard
export const getAllDeliveryTownships = asyncErrorHandler(
  async (req, res, next) => {
    const townships = await DeliveryTownship.find()
      .populate("updatedBy", "name role")
      .sort({ sortOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: townships.length,
      data: townships,
    });
  }
);

// POST /delivery-townships - Create a new township
export const createDeliveryTownship = asyncErrorHandler(
  async (req, res, next) => {
    const { township, city = "Yangon", fee, isActive = true, sortOrder = 0 } = req.body;

    if (!township || !township.trim()) {
      return next(new CustomError(400, "Township name is required"));
    }

    const existing = await DeliveryTownship.findOne({
      township: township.trim(),
    });
    if (existing) {
      return next(new CustomError(400, `Township "${township.trim()}" already exists`));
    }

    let parsedFee = null;
    if (fee !== null && fee !== undefined && fee !== "") {
      const num = Number(fee);
      if (isNaN(num) || num < 0) {
        return next(new CustomError(400, "Fee must be a non-negative number"));
      }
      parsedFee = num;
    }

    const newTownship = await DeliveryTownship.create({
      township: township.trim(),
      city: (city && city.trim()) || "Yangon",
      fee: parsedFee,
      isActive: Boolean(isActive),
      sortOrder: Number(sortOrder) || 0,
      updatedBy: req.user._id,
    });

    clearDeliveryCache();

    res.status(201).json({
      success: true,
      message: "Township created successfully",
      data: newTownship,
    });
  }
);

// PATCH /delivery-townships/:id - Update single township
export const updateDeliveryTownship = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;
    const { township, city, fee, isActive, sortOrder } = req.body;

    const townshipDoc = await DeliveryTownship.findById(id);
    if (!townshipDoc) {
      return next(new CustomError(404, "Delivery township not found"));
    }

    if (township && township.trim()) {
      const conflict = await DeliveryTownship.findOne({
        township: township.trim(),
        _id: { $ne: id },
      });
      if (conflict) {
        return next(
          new CustomError(400, `Township "${township.trim()}" already exists`)
        );
      }
      townshipDoc.township = township.trim();
    }

    if (city !== undefined) townshipDoc.city = city.trim();
    if (isActive !== undefined) townshipDoc.isActive = Boolean(isActive);
    if (sortOrder !== undefined) townshipDoc.sortOrder = Number(sortOrder) || 0;

    if (fee !== undefined) {
      if (fee === null || fee === "") {
        townshipDoc.fee = null;
      } else {
        const num = Number(fee);
        if (isNaN(num) || num < 0) {
          return next(new CustomError(400, "Fee must be a non-negative number or null"));
        }
        townshipDoc.fee = num;
      }
    }

    townshipDoc.updatedBy = req.user._id;
    await townshipDoc.save();

    clearDeliveryCache();

    res.status(200).json({
      success: true,
      message: "Delivery township updated successfully",
      data: townshipDoc,
    });
  }
);

// PATCH /delivery-townships/bulk - Bulk update fees and active state
export const bulkUpdateDeliveryTownships = asyncErrorHandler(
  async (req, res, next) => {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return next(new CustomError(400, "An array of updates is required"));
    }

    const modified = [];
    for (const item of updates) {
      const filter = (item.id || item._id)
        ? { _id: item.id || item._id }
        : item.township
        ? { township: item.township }
        : null;
      if (!filter) continue;

      const updateFields = { updatedBy: req.user._id };
      if (item.fee !== undefined) {
        if (item.fee === null || item.fee === "") {
          updateFields.fee = null;
        } else {
          const num = Number(item.fee);
          if (!isNaN(num) && num >= 0) {
            updateFields.fee = num;
          }
        }
      }
      if (item.isActive !== undefined) updateFields.isActive = Boolean(item.isActive);
      if (item.sortOrder !== undefined) updateFields.sortOrder = Number(item.sortOrder) || 0;

      const resDoc = await DeliveryTownship.findOneAndUpdate(
        filter,
        { $set: updateFields },
        { new: true }
      );
      if (resDoc) modified.push(resDoc);
    }

    clearDeliveryCache();

    res.status(200).json({
      success: true,
      message: `Bulk updated ${modified.length} townships successfully`,
      data: modified,
    });
  }
);

// DELETE /delivery-townships/:id - Delete a township
export const deleteDeliveryTownship = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;

    const townshipDoc = await DeliveryTownship.findByIdAndDelete(id);
    if (!townshipDoc) {
      return next(new CustomError(404, "Delivery township not found"));
    }

    clearDeliveryCache();

    res.status(200).json({
      success: true,
      message: "Delivery township deleted successfully",
      data: null,
    });
  }
);
