import express from "express";
import {
  getAllHomeSections,
  createHomeSection,
  updateHomeSection,
  reorderHomeSections,
  deleteHomeSection,
  previewHomeSection,
} from "../controllers/homeSection.controller.js";
import { protect } from "../controllers/administrationPolicy.controller.js";
import { permissionGranted } from "../controllers/administrationPolicy.controller.js";

const router = express.Router();

// Online shop home page sections (owner/admin)
router.get(
  "/home-sections",
  protect,
  permissionGranted("owner", "admin"),
  getAllHomeSections,
);

router.post(
  "/home-sections",
  protect,
  permissionGranted("owner", "admin"),
  createHomeSection,
);

// Registered before /:id so "reorder" and "preview" are not read as ids
router.patch(
  "/home-sections/reorder",
  protect,
  permissionGranted("owner", "admin"),
  reorderHomeSections,
);

router.post(
  "/home-sections/preview",
  protect,
  permissionGranted("owner", "admin"),
  previewHomeSection,
);

router.patch(
  "/home-sections/:id",
  protect,
  permissionGranted("owner", "admin"),
  updateHomeSection,
);

router.delete(
  "/home-sections/:id",
  protect,
  permissionGranted("owner", "admin"),
  deleteHomeSection,
);

export default router;
