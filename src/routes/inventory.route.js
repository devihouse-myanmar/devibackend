import express from "express";
import multer from "multer";
import {
  createInventory,
  uploadProductImages,
  getAllInventory,
  getInventoryById,
  updateInventory,
  importInventoryFromExcel,
  getAllCategories,
  updateBatchExpiryDate,
} from "../controllers/inventory.controller.js";
import { protect } from "../controllers/administrationPolicy.controller.js";
import { permissionGranted } from "../controllers/administrationPolicy.controller.js";
import multerProductImagesUpload from "../middlewares/multerProductImagesUpload.middleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (
      allowedMimes.includes(file.mimetype) ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls") ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls, .csv) are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Bulk import inventory from Excel
router.post(
  "/inventory/import-excel",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  upload.single("file"),
  importInventoryFromExcel,
);

// Get all unique categories
router.get(
  "/inventory/categories",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getAllCategories,
);

// Create new inventory item
router.post(
  "/inventory",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  createInventory,
);

// Upload product images (max 5 images, max 5MB each)
router.post(
  "/inventory/images",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  multerProductImagesUpload("images", 5),
  uploadProductImages,
);

// Get all inventory items
router.get(
  "/inventory",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getAllInventory,
);

// Get inventory item by ID
router.get(
  "/inventory/:id",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getInventoryById,
);

// Update inventory metadata
router.patch(
  "/inventory/:id",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  updateInventory,
);

// Update batch expiry date
router.patch(
  "/inventory/batch/expiry",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  updateBatchExpiryDate,
);

export default router;
