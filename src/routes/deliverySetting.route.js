import express from "express";
import {
  getDeliverySettings,
  updateDeliverySettings,
} from "../controllers/deliverySetting.controller.js";
import {
  protect,
  permissionGranted,
} from "../controllers/administrationPolicy.controller.js";

const router = express.Router();

router.get(
  "/delivery-settings",
  protect,
  permissionGranted("owner", "admin"),
  getDeliverySettings
);

router.patch(
  "/delivery-settings",
  protect,
  permissionGranted("owner", "admin"),
  updateDeliverySettings
);

export default router;
