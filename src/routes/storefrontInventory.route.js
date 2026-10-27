import express from "express";
import {
  createStorefrontInventory,
  getAllStorefrontInventory,
  getStorefrontInventoryById,
  updateStorefrontInventoryQuantity,
  getExpiringStorefrontInventory,
  updateStorefrontInventoryDiscount,
  bulkUpdateStorefrontDiscount,
} from "../controllers/storefrontInventory.controller.js";
import { protect } from "../controllers/administrationPolicy.controller.js";
import { permissionGranted } from "../controllers/administrationPolicy.controller.js";
const router = express.Router();

// Create new storefront inventory
router.post(
  "/storefront-inventory",
  protect,
  permissionGranted("owner", "admin", "warehouse"),
  createStorefrontInventory
);

// Get all storefront inventory (with filtering, pagination, sorting)
router.get(
  "/storefront-inventory",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getAllStorefrontInventory
);

// Bulk update discount for storefront inventory items (MUST be registered before /:id routes)
router.patch(
  "/storefront-inventory/discount/bulk",
  protect,
  permissionGranted("owner", "admin"),
  bulkUpdateStorefrontDiscount
);

// Update discount for a single storefront inventory item
router.patch(
  "/storefront-inventory/:id/discount",
  protect,
  permissionGranted("owner", "admin"),
  updateStorefrontInventoryDiscount
);

// Get expiring stock for storefront
router.get(
  "/storefront-inventory/:storefrontId/expiring-stock",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getExpiringStorefrontInventory
);

// Get storefront inventory by ID
router.get(
  "/storefront-inventory/:id",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getStorefrontInventoryById
);

// Update storefront inventory quantity
router.patch(
  "/storefront-inventory/:id/quantity",
  protect,
  permissionGranted("owner", "warehouse"),
  updateStorefrontInventoryQuantity
);

export default router;
