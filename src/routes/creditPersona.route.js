import { Router } from "express";
import {
  createCreditPerson,
  getAllCreditPersons,
  getCreditPersonById,
  updateCreditPerson,
  updateCreditPersonFreeDelivery,
} from "../controllers/creditPersona.controller.js";
import { protect } from "../controllers/administrationPolicy.controller.js";
import { permissionGranted } from "../controllers/administrationPolicy.controller.js";

const router = Router();

router.post(
  "/credit-persona",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  createCreditPerson
);
router.get(
  "/credit-persona",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getAllCreditPersons
);
router.get(
  "/credit-persona/:id",
  protect,
  permissionGranted("owner", "admin", "cashier", "warehouse"),
  getCreditPersonById
);
router.patch(
  "/credit-persona/:id",
  protect,
  permissionGranted("owner", "warehouse"),
  updateCreditPerson
);
// Free delivery customer flag (owner and admin only - D9)
router.patch(
  "/credit-persona/:id/free-delivery",
  protect,
  permissionGranted("owner", "admin"),
  updateCreditPersonFreeDelivery
);
export default router;
