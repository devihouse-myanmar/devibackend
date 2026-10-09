import mongoose from "mongoose";
import Order from "../models/orders.model.js";
import Inventory from "../models/inventory.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import LocationProfile from "../models/locationProfile.model.js";
import ShopSetting from "../models/shopSetting.model.js";
import { asyncErrorHandler } from "../utils/asyncErrorHandler.js";
import CustomError from "../utils/customError.js";
import {
  uploadToR2,
  generateR2Key,
} from "../configs/cloudflareR2.config.js";

// Helper to find or automatically create Ecommerce Storefront
export const getOrCreateEcommerceStorefront = async () => {
  let storefront = await LocationProfile.findOne({
    type: "storefront",
    $or: [{ isEcommerceDefault: true }, { locationCode: "SF-ECOMMERCE" }],
    isDeleted: false,
  });

  if (!storefront) {
    storefront = await LocationProfile.create({
      type: "storefront",
      locationCode: "SF-ECOMMERCE",
      locationName: "Ecommerce Online Store",
      locationAddress: "Devi Silk Online Shop, Yangon",
      locationPhone: "+959798938874",
      isEcommerceDefault: true,
      status: "active",
      description: "Dedicated storefront for Ecommerce online orders",
    });
  }

  return storefront;
};

// 1. Create Public E-commerce Order (Tokenless)
export const createEcommerceOrder = asyncErrorHandler(
  async (req, res, next) => {
    const {
      name,
      phone,
      address,
      township,
      city = "Yangon",
      deliMethod,
      gateName = "",
      paymentMethod,
      paymentProvider,
      items,
      note = "",
      deliFee = 0,
    } = req.body;

    // Validate Customer Info
    if (!name || !name.trim()) {
      return next(new CustomError(400, "Customer name is required"));
    }
    if (!phone || !phone.trim()) {
      return next(new CustomError(400, "Phone number is required"));
    }
    if (!address || !address.trim()) {
      return next(new CustomError(400, "Delivery address is required"));
    }
    if (!township || !township.trim()) {
      return next(new CustomError(400, "Township is required"));
    }

    // Validate Delivery Method
    const normalizedDeliMethod = (deliMethod || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]/g, "_");
    const validDeliMethods = ["deli_service", "car_gate"];
    if (!validDeliMethods.includes(normalizedDeliMethod)) {
      return next(
        new CustomError(
          400,
          "Invalid delivery method. Allowed values: deli_service, car_gate",
        ),
      );
    }

    if (normalizedDeliMethod === "car_gate" && (!gateName || !gateName.trim())) {
      return next(
        new CustomError(
          400,
          "Gate name (ကားဂိတ်အမည်) is required when delivery method is car-gate",
        ),
      );
    }

    // Validate Payment Method
    const rawPaymentMethod = (paymentMethod || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]/g, "_");
    let normalizedPaymentMethod = "";
    if (rawPaymentMethod === "cod" || rawPaymentMethod === "cash_on_delivery") {
      normalizedPaymentMethod = "cod";
    } else if (
      rawPaymentMethod === "cash_down" ||
      rawPaymentMethod === "cashdown" ||
      rawPaymentMethod === "prepaid"
    ) {
      normalizedPaymentMethod = "cash_down";
    } else {
      return next(
        new CustomError(
          400,
          "Invalid payment method. Allowed values: COD, cash_down",
        ),
      );
    }

    // Validate Payment Provider & Screenshot if Cash Down
    const validPaymentProviders = [
      "kpay",
      "aya",
      "wave",
      "uabpay",
      "cbpay",
      "bank_transfer",
    ];
    let normalizedPaymentProvider = null;
    let screenshotUrl = null;
    let screenshotKey = null;
    let paymentStatus = "unpaid";

    if (normalizedPaymentMethod === "cash_down") {
      normalizedPaymentProvider = (paymentProvider || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]/g, "");

      if (normalizedPaymentProvider === "uab") normalizedPaymentProvider = "uabpay";
      if (normalizedPaymentProvider === "cb") normalizedPaymentProvider = "cbpay";
      if (normalizedPaymentProvider === "banktransfer") normalizedPaymentProvider = "bank_transfer";

      if (!validPaymentProviders.includes(normalizedPaymentProvider)) {
        return next(
          new CustomError(
            400,
            `Payment provider is required for cash down. Allowed: ${validPaymentProviders.join(", ")}`,
          ),
        );
      }

      // Check payment screenshot file
      if (!req.file) {
        return next(
          new CustomError(
            400,
            "Payment slip screenshot (ငွေလွှဲပြေစာ) is required for cash down payment",
          ),
        );
      }

      try {
        const key = generateR2Key(req.file.originalname, "ecommerce-slips");
        screenshotUrl = await uploadToR2(req.file, key);
        screenshotKey = key;
        paymentStatus = "pending_verification";
      } catch (uploadError) {
        return next(
          new CustomError(
            500,
            `Failed to upload payment slip image: ${uploadError.message}`,
          ),
        );
      }
    }

    // Parse and Validate Order Items
    let parsedItems = items;
    if (typeof items === "string") {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        return next(new CustomError(400, "Invalid items format. Must be a valid JSON array"));
      }
    }

    if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
      return next(new CustomError(400, "Order must contain at least one product"));
    }

    // Retrieve or create Ecommerce Storefront
    const ecommerceStore = await getOrCreateEcommerceStorefront();

    // Verify products, check stock in Ecommerce Storefront, and calculate totals
    const ordersProducts = [];
    let subTotal = 0;

    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i];
      if (!item.inventoryId || !mongoose.Types.ObjectId.isValid(item.inventoryId)) {
        return next(new CustomError(400, `Item ${i + 1}: Valid inventoryId is required`));
      }
      const quantity = Number(item.quantity);
      if (!quantity || quantity < 1) {
        return next(new CustomError(400, `Item ${i + 1}: Quantity must be at least 1`));
      }

      const product = await Inventory.findById(item.inventoryId);
      if (!product || product.isDeleted) {
        return next(new CustomError(404, `Product not found: ${item.inventoryId}`));
      }

      // Check stock in Ecommerce Storefront
      const storeStock = await StorefrontInventory.findOne({
        storefrontId: ecommerceStore._id,
        inventoryId: product._id,
      });

      const availableStock = storeStock ? storeStock.quantity : 0;
      if (availableStock < quantity) {
        return next(
          new CustomError(
            400,
            `"${product.productName}" ပစ္စည်းအတွက် အွန်လိုင်းလက်ကျန် Stock မလုံလောက်ပါ (လက်ကျန်: ${availableStock} ထည်၊ မှာယူထားသော အရေအတွက်: ${quantity} ထည်)`,
          ),
        );
      }

      const unitPrice = product.sellingPrice;
      const lineSubTotal = unitPrice * quantity;
      subTotal += lineSubTotal;

      ordersProducts.push({
        inventoryId: product._id,
        quantity,
        unitPrice,
        buyingPrice: product.buyingPrice || null,
      });
    }

    const numericDeliFee = Math.max(0, Number(deliFee) || 0);
    const finalAmount = subTotal + numericDeliFee;

    // Deduct stock from Ecommerce Storefront for each product
    for (const item of ordersProducts) {
      await StorefrontInventory.updateOne(
        { storefrontId: ecommerceStore._id, inventoryId: item.inventoryId },
        { $inc: { quantity: -item.quantity } },
      );
    }

    // Generate Ecommerce Order Number (ECO-YYYY-MM-DD-NNNNNN)
    const orderNumber = await Order.generateOrderNumber(new Date(), "ECO");

    // Create Order Record
    const newOrder = await Order.create({
      orderNumber,
      orderSource: "ecommerce",
      storefrontId: ecommerceStore._id,
      ordersProducts,
      subTotal,
      tax: 0,
      discount: 0,
      finalAmount,
      paidAmount: normalizedPaymentMethod === "cash_down" ? finalAmount : 0,
      orderStatus: "pending",
      soldBy: null,
      customerInfo: {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        township: township.trim(),
        city: (city && city.trim()) || "Yangon",
      },
      deliveryInfo: {
        deliMethod: normalizedDeliMethod,
        gateName: (gateName && gateName.trim()) || "",
        deliFee: numericDeliFee,
      },
      paymentInfo: {
        paymentMethod: normalizedPaymentMethod,
        paymentProvider: normalizedPaymentProvider,
        paymentScreenshot: screenshotUrl,
        paymentScreenshotKey: screenshotKey,
        paymentStatus,
      },
      paymentType: "paid",
      paymentMethod: normalizedPaymentMethod,
      note: (note && note.trim()) || "",
    });

    // Populate order products for the response
    const populatedOrder = await Order.findById(newOrder._id).populate({
      path: "ordersProducts.inventoryId",
      select: "productName productCode color size category images sellingPrice",
    });

    res.status(201).json({
      status: "success",
      message: "E-commerce order created successfully",
      data: {
        orderId: populatedOrder._id,
        orderNumber: populatedOrder.orderNumber,
        customerInfo: populatedOrder.customerInfo,
        deliveryInfo: populatedOrder.deliveryInfo,
        paymentInfo: populatedOrder.paymentInfo,
        ordersProducts: populatedOrder.ordersProducts,
        subTotal: populatedOrder.subTotal,
        deliFee: numericDeliFee,
        finalAmount: populatedOrder.finalAmount,
        orderStatus: populatedOrder.orderStatus,
        createdAt: populatedOrder.createdAt,
      },
    });
  },
);

// 2. Track E-commerce Order by Order Number (Public Tokenless)
export const getEcommerceOrderTrack = asyncErrorHandler(
  async (req, res, next) => {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return next(new CustomError(400, "Order number is required"));
    }

    const order = await Order.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
      orderSource: "ecommerce",
      isDeleted: false,
    }).populate({
      path: "ordersProducts.inventoryId",
      select: "productName productCode color size category images sellingPrice",
    });

    if (!order) {
      return next(new CustomError(404, "Order not found with the provided order number"));
    }

    res.status(200).json({
      status: "success",
      data: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        customerInfo: {
          name: order.customerInfo?.name,
          phone: order.customerInfo?.phone,
          township: order.customerInfo?.township,
          city: order.customerInfo?.city,
        },
        deliveryInfo: order.deliveryInfo,
        paymentInfo: {
          paymentMethod: order.paymentInfo?.paymentMethod,
          paymentProvider: order.paymentInfo?.paymentProvider,
          paymentStatus: order.paymentInfo?.paymentStatus,
          paymentScreenshot: order.paymentInfo?.paymentScreenshot,
        },
        items: order.ordersProducts.map((p) => ({
          productName: p.inventoryId?.productName,
          productCode: p.inventoryId?.productCode,
          color: p.inventoryId?.color,
          size: p.inventoryId?.size,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          image: p.inventoryId?.images?.[0]?.url || null,
        })),
        subTotal: order.subTotal,
        deliFee: order.deliveryInfo?.deliFee || 0,
        finalAmount: order.finalAmount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  },
);

// 3. Get E-commerce Store & Payment Info (Public Tokenless)
export const getEcommerceStoreInfo = asyncErrorHandler(
  async (req, res, next) => {
    const storefront = await getOrCreateEcommerceStorefront();
    const settings = await ShopSetting.findOne({ isActive: true });

    res.status(200).json({
      status: "success",
      data: {
        storeName: storefront.locationName,
        phone: storefront.locationPhone,
        address: storefront.locationAddress,
        deliveryMethods: [
          { id: "deli_service", name: "အိမ်အရောက်ပို့ (Delivery Service)" },
          { id: "car_gate", name: "ကားဂိတ်ပို့ (Car-Gate)" },
        ],
        paymentMethods: [
          {
            id: "cod",
            name: "Cash on Delivery (ပစ္စည်းရောက်မှ ငွေချေ)",
            requiresSlip: false,
          },
          {
            id: "cash_down",
            name: "ကြိုတင်ငွေလွှဲ (Prepaid / Cash Down)",
            requiresSlip: true,
            providers: [
              { id: "kpay", name: "KBZPay" },
              { id: "wave", name: "WavePay" },
              { id: "aya", name: "AYA Pay" },
              { id: "uabpay", name: "UAB Pay" },
              { id: "cbpay", name: "CB Pay" },
              { id: "bank_transfer", name: "Bank Transfer" },
            ],
          },
        ],
        businessHours: settings?.businessHours || null,
        socialMedia: settings?.socialMedia || null,
      },
    });
  },
);
