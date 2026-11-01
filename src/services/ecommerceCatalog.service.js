import NodeCache from "node-cache";
import Order from "../models/orders.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import { resolveUnitPrice } from "../utils/pricing.utils.js";

// Best-selling ranking is an aggregate over all orders, so keep it for 10 minutes
const bestSellingCache = new NodeCache({ stdTTL: 600 });

export const getBestSellingDesigns = async (days = 30) => {
  const cacheKey = `bestSelling:${days}`;
  const cached = bestSellingCache.get(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const ranked = await Order.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        orderStatus: { $ne: "cancelled" },
        createdAt: { $gte: since },
      },
    },
    { $unwind: "$ordersProducts" },
    {
      $lookup: {
        from: "inventories",
        localField: "ordersProducts.inventoryId",
        foreignField: "_id",
        as: "inventoryDoc",
      },
    },
    { $unwind: "$inventoryDoc" },
    {
      $group: {
        _id: "$inventoryDoc.category",
        soldQuantity: { $sum: "$ordersProducts.quantity" },
      },
    },
    { $sort: { soldQuantity: -1 } },
    { $limit: 50 },
  ]);

  const designs = ranked.map((r) => r._id).filter(Boolean);
  bestSellingCache.set(cacheKey, designs);
  return designs;
};

export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildDiscountLabel = (pricing, originalPrice) => {
  if (pricing.priceSource !== "discount" || !pricing.itemDiscount) return null;
  if (pricing.itemDiscount.type === "percentage") {
    return `-${pricing.itemDiscount.value}%`;
  }
  const pct =
    originalPrice > 0
      ? Math.round((pricing.itemDiscount.amount / originalPrice) * 100)
      : 0;
  return pct > 0
    ? `-${pct}%`
    : `-${pricing.itemDiscount.amount.toLocaleString()} MMK`;
};

// Online price for one SF-ECOMMERCE stock record (discount only, no wholesale)
export const resolveEcommercePrice = (sellingPrice, discount, now) => {
  const originalPrice = Number(sellingPrice) || 0;
  const pricing = resolveUnitPrice({
    inventory: { sellingPrice: originalPrice },
    stockRecord: { discount },
    quantity: 1,
    now,
    applyWholesale: false,
  });
  return {
    originalPrice,
    price: pricing.unitPrice,
    discountLabel: buildDiscountLabel(pricing, originalPrice),
    hasDiscount: pricing.priceSource === "discount" && Boolean(pricing.itemDiscount),
  };
};

// Turn one grouped design (raw aggregate row) into the public card shape
const toDesignCard = (d, now) => {
  let hasAnyDiscount = false;
  let minDiscountedPrice = Infinity;
  let repOriginalPrice = d.sellingPrice;
  let repDiscountLabel = null;

  const processedVariants = (d.variants || []).map((v) => {
    const { originalPrice, price, discountLabel, hasDiscount } =
      resolveEcommercePrice(v.sellingPrice, v.discount, now);
    if (hasDiscount) hasAnyDiscount = true;

    if (price < minDiscountedPrice) {
      minDiscountedPrice = price;
      repOriginalPrice = originalPrice;
      repDiscountLabel = discountLabel;
    }

    const { discount: _rawDiscount, ...cleanVariant } = v;
    return {
      ...cleanVariant,
      originalPrice,
      price,
      sellingPrice: price,
      discountLabel,
    };
  });

  const finalSellingPrice =
    minDiscountedPrice !== Infinity ? minDiscountedPrice : d.sellingPrice;

  return {
    ...d,
    _id: d.representativeId,
    id: d.representativeId,
    inventoryId: d.representativeId,
    image: d.image || d.images?.[0]?.url || "",
    originalPrice: repOriginalPrice,
    price: finalSellingPrice,
    sellingPrice: finalSellingPrice,
    hasDiscount: hasAnyDiscount,
    discountLabel: repDiscountLabel,
    variants: processedVariants,
  };
};

/**
 * Designs (products grouped by Inventory.category) that have stock in the
 * given storefront, priced with that storefront's discounts.
 *
 * order "newest" sorts by the newest variant; "given" keeps the order of
 * `categories`. Returns { total, data }.
 */
export const getEcommerceDesigns = async ({
  storefrontId,
  category,
  search,
  categories,
  tag,
  size,
  inStockOnly = true,
  order = "newest",
  sort = "newest",
  page = 1,
  limit = 12,
}) => {
  const matchConditions = { storefrontId };
  if (inStockOnly) {
    matchConditions.quantity = { $gt: 0 };
  }

  const inventoryMatch = { "inventoryDoc.isDeleted": { $ne: true } };
  if (size && String(size).trim()) {
    inventoryMatch["inventoryDoc.size"] = String(size).trim();
  }
  if (category && category.trim()) {
    inventoryMatch["inventoryDoc.category"] = new RegExp(category.trim(), "i");
  }
  if (Array.isArray(categories)) {
    inventoryMatch["inventoryDoc.category"] = { $in: categories };
  }
  if (tag && tag.trim()) {
    inventoryMatch["inventoryDoc.tags"] = new RegExp(
      `^${escapeRegex(tag.trim())}$`,
      "i",
    );
  }
  if (search && search.trim()) {
    inventoryMatch.$or = [
      { "inventoryDoc.productName": new RegExp(search.trim(), "i") },
      { "inventoryDoc.productCode": new RegExp(search.trim(), "i") },
      { "inventoryDoc.category": new RegExp(search.trim(), "i") },
    ];
  }

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
    { $match: inventoryMatch },
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
            discount: "$discount",
          },
        },
        createdAt: { $max: "$inventoryDoc.createdAt" },
      },
    },
  ];

  const now = new Date();

  if (order === "given" && Array.isArray(categories)) {
    // Few designs per section, so sort and page in memory
    const rows = await StorefrontInventory.aggregate(pipeline);
    const position = new Map(categories.map((c, i) => [c, i]));
    rows.sort((a, b) => (position.get(a._id) ?? Infinity) - (position.get(b._id) ?? Infinity));
    const start = (page - 1) * limit;
    return {
      total: rows.length,
      data: rows.slice(start, start + limit).map((d) => toDesignCard(d, now)),
    };
  }

  const validSorts = ["newest", "discount", "popular", "priceAsc", "priceDesc"];
  const effectiveSort = validSorts.includes(sort) ? sort : "newest";

  if (effectiveSort === "newest") {
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
      },
    });

    const [result] = await StorefrontInventory.aggregate(pipeline);
    return {
      total: result?.metadata?.[0]?.total || 0,
      data: (result?.data || []).map((d) => toDesignCard(d, now)),
    };
  }

  // For custom sorts (discount, popular, priceAsc, priceDesc), run pipeline without facet and price first
  const rows = await StorefrontInventory.aggregate(pipeline);
  let priced = rows.map((d) => toDesignCard(d, now));

  if (effectiveSort === "discount") {
    // keep only designs with hasDiscount === true, ordered by highest discount first, then newest
    priced = priced.filter((d) => d.hasDiscount === true);
    priced.sort((a, b) => {
      const discDiff = (b.originalPrice - b.price) - (a.originalPrice - a.price);
      if (discDiff !== 0) return discDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else if (effectiveSort === "popular") {
    const popularCategories = await getBestSellingDesigns(30);
    const rankMap = new Map(popularCategories.map((c, i) => [c, i]));
    priced.sort((a, b) => {
      const rankA = rankMap.has(a._id) ? rankMap.get(a._id) : Infinity;
      const rankB = rankMap.has(b._id) ? rankMap.get(b._id) : Infinity;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else if (effectiveSort === "priceAsc") {
    priced.sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } else if (effectiveSort === "priceDesc") {
    priced.sort((a, b) => {
      if (b.price !== a.price) return b.price - a.price;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  const start = (page - 1) * limit;
  return {
    total: priced.length,
    data: priced.slice(start, start + limit),
  };
};
