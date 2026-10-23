import express from "express";
import uploadPaymentScreenshot from "../middlewares/multerSlipUpload.middleware.js";
import trackOrderRateLimiter from "../middlewares/trackOrderRateLimiter.middleware.js";
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

// 4. Track E-commerce Order by Order Number + Phone in JSON body
// (POST keeps the phone out of URLs and logs)
router.post("/ecommerce/orders/track", trackOrderRateLimiter, getEcommerceOrderTrack);

// 5. Get E-commerce Store Info & Supported Payment Providers
router.get("/ecommerce/store-info", getEcommerceStoreInfo);

export default router;
