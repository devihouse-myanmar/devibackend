import express from "express";
import {
  createOrder,
  getOrders,
  getOrdersByStorefrontId,
  getAllOrders,
  updateOrderCreditPersonId,
  updateOrderPaidAmount,
  addOrderItems,
  removeOrderItems,
  hardDeleteOrder,
  updateEntireOrder,
  updateOrderStatusAndPayment,
} from "../controllers/order.controller.js";

const router = express.Router();
import { protect } from "../controllers/administrationPolicy.controller.js";
import { permissionGranted } from "../controllers/administrationPolicy.controller.js";

// Create new order
router.post(
  "/order",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  createOrder
);
router.get(
  "/order",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  getAllOrders
);
router.get(
  "/order/:orderId",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  getOrders
);
// Update entire order (full POS-style edit)
router.patch(
  "/order/:orderId",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  updateEntireOrder
);
// Update order status & payment verification status (e.g. for ecommerce)
router.patch(
  "/order/:orderId/status",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  updateOrderStatusAndPayment
);
router.get(
  "/order/storefront/:storefrontId",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  getOrdersByStorefrontId
);

// Update/add credit person ID to an order
router.patch(
  "/order/:orderId/credit-person",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  updateOrderCreditPersonId
);

// Update order paid amount
router.patch(
  "/order/:orderId/paid-amount",
  protect,
  permissionGranted("owner"),
  updateOrderPaidAmount
);

// Add order items to existing order
router.patch(
  "/order/:orderId/items/add",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  addOrderItems
);

// Remove order items from existing order
router.patch(
  "/order/:orderId/items/remove",
  protect,
  permissionGranted("owner", "admin", "cashier"),
  removeOrderItems
);

// Hard delete order
router.delete("/order/:orderId", hardDeleteOrder);

export default router;
