import mongoose from "mongoose";
import Order from "../models/orders.model.js";
import Inventory from "../models/inventory.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import LocationProfile from "../models/locationProfile.model.js";
import ShopSetting from "../models/shopSetting.model.js";
import { asyncErrorHandler } from "../utils/asyncErrorHandler.js";
import CustomError from "../utils/customError.js";
import { formatPhoneNumber } from "../utils/phoneValidation.utils.js";
import {
  uploadToR2,
  generateR2Key,
} from "../configs/cloudflareR2.config.js";

// Phones are stored as typed at checkout, so compare in E.164 when parseable, else digits-only
const normalizePhoneForMatch = (phone) =>
  formatPhoneNumber(phone) || String(phone || "").replace(/\D/g, "");

// Keep first 2 and last 3 digits visible, e.g. 09*****123
const maskPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length <= 5) return "*".repeat(digits.length);
  return `${digits.slice(0, 2)}${"*".repeat(digits.length - 5)}${digits.slice(-3)}`;
};

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

      // Check stock strictly in Ecommerce Storefront (SF-ECOMMERCE)
      const storeStock = await StorefrontInventory.findOne({
        storefrontId: ecommerceStore._id,
        inventoryId: product._id,
      });

      const availableStock = storeStock ? storeStock.quantity : 0;
      if (availableStock < quantity) {
        return next(
          new CustomError(
            400,
            `"${product.productName}" ပစ္စည်းအတွက် အွန်လိုင်းဆိုင်ခွဲ (SF-ECOMMERCE) တွင် လက်ကျန် Stock မလုံလောက်ပါ (လက်ကျန်: ${availableStock} ထည်၊ မှာယူထားသော အရေအတွက်: ${quantity} ထည်)`,
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

    // Deduct stock strictly for SF-ECOMMERCE storefront
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

// 2. Track E-commerce Order by Order Number + Phone (Public Tokenless)
export const getEcommerceOrderTrack = asyncErrorHandler(
  async (req, res, next) => {
    const { orderNumber, phone } = req.body || {};

    if (typeof orderNumber !== "string" || !orderNumber.trim()) {
      return next(new CustomError(400, "Order number is required"));
    }
    if (typeof phone !== "string" || !phone.trim()) {
      return next(new CustomError(400, "Phone number is required"));
    }

    const order = await Order.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
      orderSource: "ecommerce",
      isDeleted: false,
    }).populate({
      path: "ordersProducts.inventoryId",
      select: "productName productCode color size category images sellingPrice",
    });

    // Same response for unknown order and wrong phone, so order numbers can't be probed
    const providedPhone = normalizePhoneForMatch(phone);
    if (
      !order ||
      !providedPhone ||
      normalizePhoneForMatch(order.customerInfo?.phone) !== providedPhone
    ) {
      return next(
        new CustomError(404, "Order not found with the provided order number and phone"),
      );
    }

    res.status(200).json({
      status: "success",
      data: {
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        customerInfo: {
          name: order.customerInfo?.name,
          phone: maskPhone(order.customerInfo?.phone),
          township: order.customerInfo?.township,
          city: order.customerInfo?.city,
        },
        deliveryInfo: {
          deliMethod: order.deliveryInfo?.deliMethod,
          gateName: order.deliveryInfo?.gateName,
        },
        paymentInfo: {
          paymentMethod: order.paymentInfo?.paymentMethod,
          paymentProvider: order.paymentInfo?.paymentProvider,
          paymentStatus: order.paymentInfo?.paymentStatus,
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

// 4. Get Public E-commerce Products with Stock & Design-Level Grouping (Tokenless)
export const getEcommerceProducts = asyncErrorHandler(
  async (req, res, next) => {
    const { category, search, inStockOnly = "true", groupBy = "design", page = 1, limit = 12 } = req.query;

    const ecommerceStore = await getOrCreateEcommerceStorefront();

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);

    // Match ONLY stock records in SF-ECOMMERCE with quantity > 0 (unless inStockOnly === 'false')
    const matchConditions = {
      storefrontId: ecommerceStore._id,
    };
    if (inStockOnly !== "false") {
      matchConditions.quantity = { $gt: 0 };
    }

    // Build Category-First Aggregation Pipeline
    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "inventories",
          localField: "inventoryId",
          foreignField: "_id",
          as: "inventoryDoc",
        },
      },
      { $unwind: "$inventoryDoc" },
      {
        $match: {
          "inventoryDoc.isDeleted": { $ne: true },
          ...(category && category.trim()
            ? { "inventoryDoc.category": new RegExp(category.trim(), "i") }
            : {}),
          ...(search && search.trim()
            ? {
                $or: [
                  { "inventoryDoc.productName": new RegExp(search.trim(), "i") },
                  { "inventoryDoc.productCode": new RegExp(search.trim(), "i") },
                  { "inventoryDoc.category": new RegExp(search.trim(), "i") },
                ],
              }
            : {}),
        },
      },
    ];

    if (groupBy === "design") {
      pipeline.push(
        {
          $group: {
            _id: "$inventoryDoc.category",
            representativeId: { $first: "$inventoryDoc._id" },
            category: { $first: "$inventoryDoc.category" },
            designName: { $first: "$inventoryDoc.category" },
            subCategory: { $first: "$inventoryDoc.subCategory" },
            brand: { $first: "$inventoryDoc.brand" },
            description: { $first: "$inventoryDoc.description" },
            unitOfMeasure: { $first: "$inventoryDoc.unitOfMeasure" },
            sellingPrice: { $min: "$inventoryDoc.sellingPrice" },
            image: { $first: { $arrayElemAt: ["$inventoryDoc.images.url", 0] } },
            images: { $first: "$inventoryDoc.images" },
            totalAvailableStock: { $sum: "$quantity" },
            colors: { $addToSet: "$inventoryDoc.color" },
            sizes: { $addToSet: "$inventoryDoc.size" },
            variants: {
              $push: {
                _id: "$inventoryDoc._id",
                id: "$inventoryDoc._id",
                inventoryId: "$inventoryDoc._id",
                productName: "$inventoryDoc.productName",
                productCode: "$inventoryDoc.productCode",
                color: "$inventoryDoc.color",
                size: "$inventoryDoc.size",
                price: "$inventoryDoc.sellingPrice",
                sellingPrice: "$inventoryDoc.sellingPrice",
                image: { $arrayElemAt: ["$inventoryDoc.images.url", 0] },
                availableStock: "$quantity",
              },
            },
            createdAt: { $max: "$inventoryDoc.createdAt" },
          },
        },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [
              { $sort: { createdAt: -1 } },
              { $skip: (pageNum - 1) * limitNum },
              { $limit: limitNum },
            ],
          },
        },
      );

      const [result] = await StorefrontInventory.aggregate(pipeline);
      const totalCount = result?.metadata?.[0]?.total || 0;
      const paginatedDesigns = (result?.data || []).map((d) => ({
        ...d,
        _id: d.representativeId,
        id: d.representativeId,
        inventoryId: d.representativeId,
        image: d.image || d.images?.[0]?.url || "",
      }));

      return res.status(200).json({
        status: "success",
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        data: paginatedDesigns,
      });
    }

    // Default flat list if not grouped
    pipeline.push(
      {
        $project: {
          _id: "$inventoryDoc._id",
          id: "$inventoryDoc._id",
          productName: "$inventoryDoc.productName",
          productCode: "$inventoryDoc.productCode",
          category: "$inventoryDoc.category",
          subCategory: "$inventoryDoc.subCategory",
          brand: "$inventoryDoc.brand",
          color: "$inventoryDoc.color",
          size: "$inventoryDoc.size",
          images: "$inventoryDoc.images",
          description: "$inventoryDoc.description",
          sellingPrice: "$inventoryDoc.sellingPrice",
          unitOfMeasure: "$inventoryDoc.unitOfMeasure",
          availableStock: "$quantity",
          createdAt: "$inventoryDoc.createdAt",
        },
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: (pageNum - 1) * limitNum },
            { $limit: limitNum },
          ],
        },
      },
    );

    const [flatResult] = await StorefrontInventory.aggregate(pipeline);
    const totalCount = flatResult?.metadata?.[0]?.total || 0;
    const paginatedProducts = flatResult?.data || [];

    res.status(200).json({
      status: "success",
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      data: paginatedProducts,
    });
  },
);

// 5. Get Single Public E-commerce Product & All its Color Variants by ID (Tokenless)
export const getEcommerceProductById = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return next(new CustomError(400, "Invalid product ID format"));
    }

    const ecommerceStore = await getOrCreateEcommerceStorefront();

    // 1. Fetch requested product from Inventory
    const requestedProduct = await Inventory.findOne({
      _id: id,
      isDeleted: { $ne: true },
    }).lean();

    if (!requestedProduct) {
      return next(new CustomError(404, "Product not found"));
    }

    // 2. Find all inventory items in the same category
    const categoryInventory = await Inventory.find({
      category: requestedProduct.category,
      isDeleted: { $ne: true },
    })
      .select(
        "productName productCode category subCategory brand color size images description sellingPrice unitOfMeasure createdAt",
      )
      .lean();

    const categoryItemIds = categoryInventory.map((i) => i._id);

    // 3. Strictly query stocks available in SF-ECOMMERCE
    const ecoStocks = await StorefrontInventory.find({
      storefrontId: ecommerceStore._id,
      inventoryId: { $in: categoryItemIds },
      quantity: { $gt: 0 },
    }).lean();

    if (!ecoStocks || ecoStocks.length === 0) {
      return next(
        new CustomError(
          404,
          "ဤပစ္စည်းသည် အွန်လိုင်းဆိုင်ခွဲ (SF-ECOMMERCE) တွင် လက်ရှိ ရောင်းချရန် မရှိသေးပါ",
        ),
      );
    }

    const stockMap = new Map();
    for (const s of ecoStocks) {
      stockMap.set(s.inventoryId.toString(), s.quantity || 0);
    }

    // Only include variants that exist in SF-ECOMMERCE with quantity > 0
    const availableVariants = categoryInventory
      .filter((item) => stockMap.has(item._id.toString()))
      .map((s) => ({
        _id: s._id,
        id: s._id,
        inventoryId: s._id,
        productName: s.productName,
        productCode: s.productCode,
        color: s.color,
        size: s.size,
        price: s.sellingPrice,
        sellingPrice: s.sellingPrice,
        image: s.images?.[0]?.url || "",
        images: s.images || [],
        availableStock: stockMap.get(s._id.toString()) || 0,
      }));

    if (availableVariants.length === 0) {
      return next(
        new CustomError(
          404,
          "ဤပစ္စည်းသည် အွန်လိုင်းဆိုင်ခွဲ (SF-ECOMMERCE) တွင် ပစ္စည်းပြတ်နေပါသည်",
        ),
      );
    }

    // Determine the active product record (use requested if available, or first available variant)
    const activeProduct =
      availableVariants.find((v) => v._id.toString() === id) ||
      availableVariants[0];

    const fullActiveDoc =
      categoryInventory.find(
        (i) => i._id.toString() === activeProduct._id.toString(),
      ) || requestedProduct;

    const uniqueColors = Array.from(
      new Set(availableVariants.map((s) => s.color).filter(Boolean)),
    );
    const uniqueSizes = Array.from(
      new Set(availableVariants.map((s) => s.size).filter(Boolean)),
    );

    res.status(200).json({
      status: "success",
      data: {
        _id: fullActiveDoc._id,
        id: fullActiveDoc._id,
        inventoryId: fullActiveDoc._id,
        productName: fullActiveDoc.productName,
        productCode: fullActiveDoc.productCode,
        category: fullActiveDoc.category,
        subCategory: fullActiveDoc.subCategory,
        brand: fullActiveDoc.brand,
        color: fullActiveDoc.color,
        size: fullActiveDoc.size,
        colors: uniqueColors,
        sizes: uniqueSizes,
        images: fullActiveDoc.images || [],
        description: fullActiveDoc.description,
        sellingPrice: activeProduct.price,
        unitOfMeasure: fullActiveDoc.unitOfMeasure,
        availableStock: activeProduct.availableStock,
        variants: availableVariants,
        createdAt: fullActiveDoc.createdAt,
      },
    });
  },
);
