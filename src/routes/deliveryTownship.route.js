import express from "express";
import {
  getAllDeliveryTownships,
  createDeliveryTownship,
  updateDeliveryTownship,
  bulkUpdateDeliveryTownships,
  deleteDeliveryTownship,
} from "../controllers/deliveryTownship.controller.js";
import {
  protect,
  permissionGranted,
} from "../controllers/administrationPolicy.controller.js";

const router = express.Router();

// All township management endpoints are restricted to owner & admin (D9)
router.get(
  "/delivery-townships",
  protect,
  permissionGranted("owner", "admin"),
  getAllDeliveryTownships
);

router.post(
  "/delivery-townships",
  protect,
  permissionGranted("owner", "admin"),
  createDeliveryTownship
);

router.patch(
  "/delivery-townships/bulk",
  protect,
  permissionGranted("owner", "admin"),
  bulkUpdateDeliveryTownships
);

router.patch(
  "/delivery-townships/:id",
  protect,
  permissionGranted("owner", "admin"),
  updateDeliveryTownship
);

router.delete(
  "/delivery-townships/:id",
  protect,
  permissionGranted("owner", "admin"),
  deleteDeliveryTownship
);

export default router;
