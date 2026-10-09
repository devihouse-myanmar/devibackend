import WarehouseStock from "../models/warehouse.model.js";
import Inventory from "../models/inventory.model.js";
import LocationProfile from "../models/locationProfile.model.js";
import { asyncErrorHandler } from "../utils/asyncErrorHandler.js";
import CustomError from "../utils/customError.js";
import mongoose from "mongoose";
import {
  createStockAuditLog,
  determineActionType,
} from "../services/stockAuditLog.service.js";

export const createWarehouseStock = asyncErrorHandler(
  async (req, res, next) => {
    const { inventoryIds, warehouseId, quantity = 0 } = req.body;

    // Validate warehouseId
    if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
      return next(new CustomError(400, "Invalid warehouse ID format"));
    }

    // Validate inventoryIds - should be an array
    if (!Array.isArray(inventoryIds) || inventoryIds.length === 0) {
      return next(
        new CustomError(
          400,
          "inventoryIds must be a non-empty array of inventory IDs",
        ),
      );
    }

    // Validate quantity
    if (quantity < 0) {
      return next(new CustomError(400, "Quantity cannot be negative"));
    }

    // Validate all inventoryIds are valid MongoDB ObjectIds
    const invalidIds = inventoryIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidIds.length > 0) {
      return next(
        new CustomError(
          400,
          `Invalid inventory ID format(s): ${invalidIds.join(", ")}`,
        ),
      );
    }

    // Check if warehouse exists
    const warehouse = await LocationProfile.findOne({
      _id: warehouseId,
      type: "warehouse",
    });
    if (!warehouse) {
      return next(new CustomError(404, "Warehouse not found"));
    }

    // Check if warehouse is deleted
    if (warehouse.isDeleted) {
      return next(new CustomError(404, "Warehouse is deleted"));
    }

    // Check if all inventories exist
    const inventories = await Inventory.find({
      _id: { $in: inventoryIds },
    });
    const foundInventoryIds = inventories.map((inv) => inv._id.toString());
    const missingInventoryIds = inventoryIds.filter(
      (id) => !foundInventoryIds.includes(id.toString()),
    );
    if (missingInventoryIds.length > 0) {
      return next(
        new CustomError(
          404,
          `Inventory not found for ID(s): ${missingInventoryIds.join(", ")}`,
        ),
      );
    }

    // Check which combinations already exist
    const existingRecords = await WarehouseStock.find({
      inventoryId: { $in: inventoryIds },
      warehouseId,
    });

    const existingInventoryIds = existingRecords.map((record) =>
      record.inventoryId.toString(),
    );
    const newInventoryIds = inventoryIds.filter(
      (id) => !existingInventoryIds.includes(id.toString()),
    );

    // Create new records for inventoryIds that don't exist
    // Use Promise.allSettled to handle each creation individually
    const createdRecords = [];
    const duplicateRecords = [];

    if (newInventoryIds.length > 0) {
      const createPromises = newInventoryIds.map(async (inventoryId) => {
        try {
          const record = await WarehouseStock.create({
            inventoryId,
            warehouseId,
            quantity,
          });
          await record.populate("inventoryId", "productName productCode");
          await record.populate("warehouseId", "locationName locationCode");
          return { status: "created", record };
        } catch (error) {
          // Handle duplicate key error (unique constraint violation - error code 11000)
          if (error.code === 11000) {
            // If duplicate, fetch the existing record
            const existingRecord = await WarehouseStock.findOne({
              inventoryId,
              warehouseId,
            });
            if (existingRecord) {
              await existingRecord.populate(
                "inventoryId",
                "productName productCode",
              );
              await existingRecord.populate(
                "warehouseId",
                "locationName locationCode",
              );
              return { status: "duplicate", record: existingRecord };
            }
          }
          // For other errors, rethrow to be handled by asyncErrorHandler
          throw error;
        }
      });

      const results = await Promise.allSettled(createPromises);

      // Process results - collect created and duplicate records
      for (const result of results) {
        if (result.status === "fulfilled") {
          const { status, record } = result.value;
          if (status === "created") {
            createdRecords.push(record);
          } else if (status === "duplicate") {
            duplicateRecords.push(record);
          }
        } else {
          // If creation failed for unexpected reasons, throw to be handled by asyncErrorHandler
          throw result.reason;
        }
      }
    }

    // Combine existing records with duplicates found during creation
    const allExistingRecords = [...existingRecords, ...duplicateRecords];

    // Populate existing records for response (if not already populated)
    for (const record of existingRecords) {
      if (!record.populated("inventoryId")) {
        await record.populate("inventoryId", "productName productCode");
        await record.populate("warehouseId", "locationName locationCode");
      }
    }

    res.status(201).json({
      success: true,
      message: `Processed ${inventoryIds.length} inventory record(s)`,
      data: {
        created: createdRecords,
        alreadyExists: allExistingRecords,
        summary: {
          total: inventoryIds.length,
          created: createdRecords.length,
          alreadyExists: allExistingRecords.length,
        },
      },
    });
  },
);

export const getAllWarehouseStock = asyncErrorHandler(
  async (req, res, next) => {
    const {
      page,
      limit,
      warehouseId,
      inventoryId,
      isLowStock,
      search,
      category,
      batchNumber,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    if (warehouseId) {
      if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
        return next(new CustomError(400, "Invalid warehouse ID format"));
      }
      query.warehouseId = new mongoose.Types.ObjectId(warehouseId);
    }

    if (inventoryId) {
      if (!mongoose.Types.ObjectId.isValid(inventoryId)) {
        return next(new CustomError(400, "Invalid inventory ID format"));
      }
      query.inventoryId = new mongoose.Types.ObjectId(inventoryId);
    }

    // Build aggregation pipeline to filter by status (since status is in Inventory model)
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "inventories",
          localField: "inventoryId",
          foreignField: "_id",
          as: "inventoryId",
        },
      },
      { $unwind: "$inventoryId" },
      { $match: { "inventoryId.status": "active" } },
    ];
  
    if (category) {
      pipeline.push({ $match: { "inventoryId.category": category } });
    }
  
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "inventoryId.productName": { $regex: search, $options: "i" } },
            { "inventoryId.productCode": { $regex: search, $options: "i" } },
            { "inventoryId.barcode": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // GROUP BY PRODUCT (inventoryId) - Summing up quantities of different batches
    pipeline.push(
      {
        $group: {
          _id: {
            inventoryId: "$inventoryId._id",
            warehouseId: "$warehouseId"
          },
          stockRecordId: { $first: "$_id" },
          quantity: { $sum: "$quantity" },
          isLowStock: { $max: "$isLowStock" }, // If any batch is low stock or overall is low stock
          lastUpdated: { $max: "$lastUpdated" },
          createdAt: { $min: "$createdAt" },
          updatedAt: { $max: "$updatedAt" },
          inventoryId: { $first: "$inventoryId" } // Keep reference to original unwound product
        }
      },
      {
        $lookup: {
          from: "locationprofiles",
          localField: "_id.warehouseId",
          foreignField: "_id",
          as: "warehouseId",
        },
      },
      { $unwind: "$warehouseId" },
      {
        $project: {
          _id: "$_id.inventoryId", // Set _id as the inventory ID for consistency
          stockRecordId: 1,
          quantity: 1,
          isLowStock: 1,
          lastUpdated: 1,
          createdAt: 1,
          updatedAt: 1,
          inventoryId: 1,
          warehouseId: {
            _id: "$warehouseId._id",
            locationName: "$warehouseId.locationName",
            locationCode: "$warehouseId.locationCode"
          }
        }
      }
    );


    // Build query chain using aggregate for status filtering and summary statistics
    const summaryPipeline = [
      ...pipeline,
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalAmount: {
            $sum: { $multiply: ["$quantity", "$inventoryId.sellingPrice"] },
          },
        },
      },
    ];

    const summaryResult = await WarehouseStock.aggregate(summaryPipeline);
    const summary =
      summaryResult.length > 0
        ? {
            totalProducts: summaryResult[0].totalProducts,
            totalQuantity: summaryResult[0].totalQuantity,
            totalAmount: summaryResult[0].totalAmount,
          }
        : {
            totalProducts: 0,
            totalQuantity: 0,
            totalAmount: 0,
          };

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    pipeline.push({ $sort: sort });

    // Apply pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const usePagination = page !== undefined || limit !== undefined;
    if (usePagination) {
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });
    }

    // Execute aggregate query
    const stock = await WarehouseStock.aggregate(pipeline);

    const response = {
      success: true,
      message:
        "Warehouse stock retrieved successfully (Active products only)",
      summary,
      data: stock,
    };

    if (usePagination) {
      response.pagination = {
        currentPage: pageNum,
        totalPages: Math.ceil(summary.totalProducts / limitNum),
        totalItems: summary.totalProducts,
        itemsPerPage: limitNum,
      };
    }

    res.status(200).json(response);
  },
);

// Get warehouse stock by ID
export const getWarehouseStockById = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new CustomError(400, "Invalid warehouse stock ID format"));
    }

    let stock = await WarehouseStock.findById(id)
      .populate(
        "inventoryId",
        "productName productCode SKU category buyingPrice sellingPrice barcode status",
      )
      .populate("warehouseId", "locationName locationCode locationAddress");

    if (!stock) {
      // Fallback search by inventoryId
      stock = await WarehouseStock.findOne({ inventoryId: id })
        .populate(
          "inventoryId",
          "productName productCode SKU category buyingPrice sellingPrice barcode status",
        )
        .populate("warehouseId", "locationName locationCode locationAddress");
    }

    if (!stock) {
      return next(new CustomError(404, "Warehouse stock not found"));
    }

    res.status(200).json({
      success: true,
      message: "Warehouse stock retrieved successfully",
      data: stock,
    });
  },
);

// Update warehouse stock quantity with ACID properties
// Uses quantityChange: positive number = add, negative number = subtract
export const updateWarehouseStockQuantity = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;
    const { quantityChange, reason, warehouseId } = req.body;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new CustomError(400, "Invalid warehouse stock ID format"));
    }

    // Validate quantityChange
    if (
      typeof quantityChange !== "number" ||
      quantityChange === 0 ||
      !Number.isFinite(quantityChange)
    ) {
      return next(
        new CustomError(
          400,
          "A valid non-zero numeric 'quantityChange' is required. Use positive number to add, negative number to subtract.",
        ),
      );
    }

    // Get admin ID from authenticated user
    const adminId = req.user?._id;
    if (!adminId) {
      return next(
        new CustomError(401, "Authentication required. Admin ID not found."),
      );
    }

    // Start MongoDB session for transaction (ACID properties)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the stock before the update to get the current quantity
      // Support finding by WarehouseStock document _id or product inventoryId
      let stockToUpdate = await WarehouseStock.findById(id)
        .populate("inventoryId", "productName productCode SKU barcode")
        .populate("warehouseId", "locationName locationCode type isDeleted")
        .session(session);

      if (!stockToUpdate) {
        const query = { inventoryId: id };
        const reqWarehouseId = warehouseId || req.query.warehouseId;
        if (reqWarehouseId && mongoose.Types.ObjectId.isValid(reqWarehouseId)) {
          query.warehouseId = reqWarehouseId;
        }
        stockToUpdate = await WarehouseStock.findOne(query)
          .populate("inventoryId", "productName productCode SKU barcode")
          .populate("warehouseId", "locationName locationCode type isDeleted")
          .session(session);
      }

      if (!stockToUpdate && (warehouseId || req.query.warehouseId) && quantityChange > 0) {
        const targetWarehouseId = warehouseId || req.query.warehouseId;
        if (mongoose.Types.ObjectId.isValid(targetWarehouseId)) {
          const newStock = await WarehouseStock.findOrCreateStock(
            id,
            targetWarehouseId,
            "__LEGACY__"
          );
          stockToUpdate = await WarehouseStock.findById(newStock._id)
            .populate("inventoryId", "productName productCode SKU barcode")
            .populate("warehouseId", "locationName locationCode type isDeleted")
            .session(session);
        }
      }

      if (!stockToUpdate) {
        await session.abortTransaction();
        session.endSession();
        return next(new CustomError(404, "Warehouse stock not found"));
      }

      // Validate warehouse exists and is not deleted
      if (stockToUpdate.warehouseId?.isDeleted) {
        await session.abortTransaction();
        session.endSession();
        return next(new CustomError(404, "Warehouse is deleted"));
      }

      // Validate location type
      if (stockToUpdate.warehouseId?.type !== "warehouse") {
        await session.abortTransaction();
        session.endSession();
        return next(new CustomError(400, "Location is not a warehouse"));
      }

      const beforeQuantity = stockToUpdate.quantity || 0;
      const afterQuantity = beforeQuantity + quantityChange;

      // Validate that the new quantity won't be negative
      if (afterQuantity < 0) {
        await session.abortTransaction();
        session.endSession();
        return next(
          new CustomError(
            400,
            `Cannot update stock quantity. Current quantity: ${beforeQuantity}, requested change: ${quantityChange}. This would result in a negative quantity (${afterQuantity}).`,
          ),
        );
      }

      // Perform the update using findByIdAndUpdate with $inc for atomic operation
      const updatedStock = await WarehouseStock.findByIdAndUpdate(
        stockToUpdate._id,
        {
          $inc: { quantity: quantityChange },
          $set: { lastUpdated: new Date() },
        },
        { new: true, runValidators: true, session },
      )
        .populate(
          "inventoryId",
          "productName productCode SKU category barcode status",
        )
        .populate("warehouseId", "locationName locationCode");

      // Create audit log entry
      const action = determineActionType(quantityChange, false);
      await createStockAuditLog({
        inventoryId: stockToUpdate.inventoryId._id,
        adminId: adminId,
        locationId: stockToUpdate.warehouseId._id,
        locationType: "warehouse",
        stockRecordId: stockToUpdate._id,
        beforeQuantity: beforeQuantity,
        afterQuantity: afterQuantity,
        quantityChange: quantityChange,
        action: action,
        reason: reason || null,
        relatedTransactionId: null,
        relatedTransactionType: null,
        session: session,
      });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      // Determine action type for response message
      const actionType = quantityChange > 0 ? "add" : "remove";
      const actionMessage =
        quantityChange > 0
          ? `increased by ${Math.abs(quantityChange)}`
          : `decreased by ${Math.abs(quantityChange)}`;

      res.status(200).json({
        success: true,
        message: `Warehouse stock quantity ${actionMessage} successfully. New quantity: ${updatedStock.quantity}`,
        data: updatedStock,
        operation: {
          type: actionType,
          previousQuantity: beforeQuantity,
          newQuantity: updatedStock.quantity,
          quantityChange: quantityChange,
        },
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();

      // If it's already a CustomError, pass it through
      if (error instanceof CustomError) {
        return next(error);
      }

      // Otherwise, create a new error
      return next(
        new CustomError(
          500,
          `Failed to update warehouse stock quantity: ${error.message}`,
        ),
      );
    }
  },
);

export const getExpiringWarehouseStock = asyncErrorHandler(
  async (req, res, next) => {
    const { warehouseId } = req.params;
    const { days = 30 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
      return next(new CustomError(400, "Invalid warehouse ID format"));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + parseInt(days));
    thresholdDate.setHours(23, 59, 59, 999);

    const expiringStock = await WarehouseStock.find({
      warehouseId,
      expiryDate: { $gte: today, $lte: thresholdDate },
      quantity: { $gt: 0 }
    })
      .populate("inventoryId")
      .sort({ expiryDate: 1 });

    res.status(200).json({
      success: true,
      message: "Expiring stock retrieved successfully",
      data: expiringStock
    });
  }
);
