import mongoose from "mongoose";
import dotenv from "dotenv";
import Inventory from "../models/inventory.model.js";
import LocationProfile from "../models/locationProfile.model.js";
import Order from "../models/orders.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import { configuredMainStoreCode, findMainStorefront, legacyOnlineStoreCode } from "../services/sharedStock.service.js";

dotenv.config({ quiet: true });

async function reportSharedStock() {
  const code = (process.argv[2] || configuredMainStoreCode() || "SF-001").trim().toUpperCase();
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI to a read-only connection before running the report.");
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false });
  const main = await findMainStorefront(code);
  if (!main) {
    console.error(`Could not find an active Main Store for code ${code}.`);
    process.exitCode = 1;
    return;
  }
  const legacy = await LocationProfile.find({ type: "storefront", _id: { $ne: main._id },
    $or: [{ locationCode: legacyOnlineStoreCode }, { isEcommerceDefault: true }] }).select("locationCode").lean();
  const codes = new Map(legacy.map((location) => [String(location._id), location.locationCode]));
  const [stocks, staged, legacyOrdersByStatus] = await Promise.all([
    StorefrontInventory.find({ storefrontId: { $in: [main._id, ...legacy.map(({ _id }) => _id)] } })
      .select("inventoryId storefrontId quantity discount").lean(),
    Inventory.find({ ecommercePublished: true }).select("_id").lean(),
    Order.aggregate([
      { $match: { orderSource: "ecommerce", storefrontId: { $in: legacy.map(({ _id }) => _id) }, isDeleted: { $ne: true } } },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]),
  ]);

  const rows = new Map();
  const rowFor = (id) => {
    const key = String(id);
    if (!rows.has(key)) rows.set(key, { inventoryId: key, mainQuantity: 0, mainDiscount: null, legacy: [] });
    return rows.get(key);
  };
  for (const stock of stocks) {
    const row = rowFor(stock.inventoryId);
    if (main._id.equals(stock.storefrontId)) {
      row.mainQuantity = stock.quantity;
      row.mainDiscount = stock.discount?.isActive ? stock.discount : null;
    } else {
      row.legacy.push({ code: codes.get(String(stock.storefrontId)), quantity: stock.quantity,
        discount: stock.discount?.isActive ? stock.discount : null });
    }
  }
  for (const { _id } of staged) rowFor(_id);
  const products = await Inventory.find({ _id: { $in: [...rows.keys()] } })
    .select("productCode productName color size sellingPrice status ecommercePublished isDeleted").lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const items = Array.from(rows.values(), (row) => {
    const product = byId.get(row.inventoryId);
    return { ...row, productCode: product?.productCode ?? null, productName: product?.productName ?? null,
      color: product?.color, size: product?.size, sellingPrice: product?.sellingPrice,
      status: product?.isDeleted ? "deleted" : product?.status ?? "missing", published: product?.ecommercePublished === true,
      availableAfterCutover: product?.status === "active" && !product?.isDeleted && product?.ecommercePublished === true && row.mainQuantity > 0 };
  }).sort((a, b) => (a.productCode ?? a.inventoryId).localeCompare(b.productCode ?? b.inventoryId));
  console.log(JSON.stringify({ mainStore: { code, name: main.locationName }, legacyStoreCodes: [...codes.values()], legacyOrdersByStatus, items }, null, 2));
}

try {
  await reportSharedStock();
} catch (error) {
  console.error(`Could not prepare shared stock report (${error.name}).`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
