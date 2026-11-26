import LocationProfile from "../models/locationProfile.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import CustomError from "../utils/customError.js";

export const legacyOnlineStoreCode = "SF-ECOMMERCE";

export function configuredMainStoreCode() {
  return process.env.MAIN_STOREFRONT_CODE?.trim().toUpperCase() || "";
}

export async function findMainStorefront(code = configuredMainStoreCode(), session) {
  if (!code || code === legacyOnlineStoreCode) return null;
  return LocationProfile.findOne({
    type: "storefront", locationCode: code, status: "active", isDeleted: { $ne: true },
  }).session(session ?? null);
}

export async function requireMainStorefront(code, session) {
  const storefront = await findMainStorefront(code, session);
  if (!storefront) {
    throw new CustomError(503, "The shared Main Store is not set up. Contact the shop administrator.", "MAIN_STOREFRONT_UNAVAILABLE");
  }
  return storefront;
}

export async function getEcommerceStockSource() {
  return { storefront: await requireMainStorefront(), publishedOnly: true };
}

export function ecommerceInventoryFilter(publishedOnly, prefix = "") {
  return {
    [`${prefix}isDeleted`]: { $ne: true },
    ...(publishedOnly ? { [`${prefix}status`]: "active", [`${prefix}ecommercePublished`]: true } : {}),
  };
}

export async function deductStorefrontStock({ storefrontId, inventoryId, quantity, session, productLabel, status = 409 }) {
  const result = await StorefrontInventory.updateOne(
    { storefrontId, inventoryId, quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity }, $set: { lastUpdated: new Date() } },
    { session },
  );
  if (!result.matchedCount) {
    throw new CustomError(status, `Insufficient stock for ${productLabel}. Refresh stock and try again.`, "INSUFFICIENT_STOCK");
  }
}
