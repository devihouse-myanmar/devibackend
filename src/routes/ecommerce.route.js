import express from "express";
import uploadPaymentScreenshot from "../middlewares/multerSlipUpload.middleware.js";
import {
  createEcommerceOrder,
  getEcommerceOrderTrack,
  getEcommerceStoreInfo,
  getEcommerceProducts,
  getEcommerceProductById,
} from "../controllers/ecommerce.controller.js";

const router = express.Router();

// Public Tokenless Endpoints for E-commerce Client / Mobile App

// 1. Get E-commerce Products Catalog with Stock
router.get("/ecommerce/products", getEcommerceProducts);

// 2. Get Single E-commerce Product by ID
router.get("/ecommerce/products/:id", getEcommerceProductById);

// 3. Create E-commerce Order with optional slip screenshot upload
router.post(
  "/ecommerce/orders",
  uploadPaymentScreenshot.single("paymentScreenshot"),
  createEcommerceOrder,
);

// 4. Track E-commerce Order by Order Number (e.g. ECO-2026-10-02-000001)
router.get("/ecommerce/orders/track/:orderNumber", getEcommerceOrderTrack);

// 5. Get E-commerce Store Info & Supported Payment Providers
router.get("/ecommerce/store-info", getEcommerceStoreInfo);

export default router;
