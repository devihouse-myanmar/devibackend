import mongoose from "mongoose";
import Inventory from "../models/inventory.model.js";
import Order from "../models/orders.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import CustomError from "../utils/customError.js";
import { resolveUnitPrice } from "../utils/pricing.utils.js";
import { deductStorefrontStock, ecommerceInventoryFilter, requireMainStorefront } from "./sharedStock.service.js";
import { deliveryTermsChanged, hasActiveFreeDeliveryEvent } from "./deliveryFee.service.js";

export function parseEcommerceItems(input) {
  let items = input;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      throw new CustomError(400, "Invalid items format. Must be a valid JSON array.");
    }
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new CustomError(400, "Order must contain at least one product.");
  }

  // Combining repeated variants makes the availability check reflect the actual requested total.
  const quantities = new Map();
  for (const [index, item] of items.entries()) {
    if (typeof item?.inventoryId !== "string" || !/^[a-f0-9]{24}$/i.test(item.inventoryId)) {
      throw new CustomError(400, `Item ${index + 1}: Valid inventoryId is required.`);
    }
    const id = item.inventoryId.toLowerCase();
    const quantity = Number(item.quantity);
    const combined = quantity + (quantities.get(id) ?? 0);
    if (!Number.isFinite(combined) || quantity < 1 || combined > Number.MAX_SAFE_INTEGER) {
      throw new CustomError(400, `Item ${index + 1}: Quantity must be a valid number of at least 1.`);
    }
    quantities.set(id, combined);
  }
  return Array.from(quantities, ([inventoryId, quantity]) => ({ inventoryId, quantity }));
}

async function resolveEcommerceLines(items, { storefront, publishedOnly }, session) {
  const ids = items.map(({ inventoryId }) => inventoryId);
  const products = await Inventory.find({ _id: { $in: ids }, ...ecommerceInventoryFilter(publishedOnly) }).session(session ?? null).lean();
  const stocks = await StorefrontInventory.find({ storefrontId: storefront._id, inventoryId: { $in: ids } }).session(session ?? null).lean();
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const stocksById = new Map(stocks.map((stock) => [String(stock.inventoryId), stock]));
  return items.map(({ inventoryId, quantity }) => {
    const product = productsById.get(inventoryId);
    if (!product) {
      throw new CustomError(publishedOnly ? 409 : 404, "An item is no longer available online. Please update your cart.", "ECOMMERCE_ITEM_UNAVAILABLE");
    }
    const stock = stocksById.get(inventoryId);
    const available = stock?.quantity ?? 0;
    if (available < quantity) {
      throw new CustomError(publishedOnly ? 409 : 400, `${product.productName} has only ${available} in stock. Please update your cart.`, "INSUFFICIENT_STOCK");
    }
    const pricing = resolveUnitPrice({ inventory: product, stockRecord: stock, quantity, applyWholesale: false });
    return {
      label: product.productName,
      line: { inventoryId: product._id, quantity, unitPrice: pricing.unitPrice,
        originalUnitPrice: pricing.originalUnitPrice, itemDiscount: pricing.itemDiscount, buyingPrice: product.buyingPrice || null },
    };
  });
}

export async function checkEcommerceItems(items, stockSource) {
  await resolveEcommerceLines(items, stockSource);
}

export async function createEcommerceOrderWithStock({ items, stockSource, deliveryFee, orderData }) {
  const date = new Date();
  const { storefront, publishedOnly } = stockSource;
  for (let attempt = 1; ; attempt += 1) {
    const orderNumber = await Order.generateOrderNumber(date, "ECO");
    try {
      return await mongoose.connection.transaction(async (session) => {
        const freeDeliveryEvent = await hasActiveFreeDeliveryEvent(session);
        if (freeDeliveryEvent !== (orderData.deliveryInfo.feeSource === "event")) {
          throw deliveryTermsChanged();
        }
        if (publishedOnly) await requireMainStorefront(storefront.locationCode, session);
        const priced = await resolveEcommerceLines(items, stockSource, session);
        for (const { line, label } of priced) {
          await deductStorefrontStock({ storefrontId: storefront._id, inventoryId: line.inventoryId, quantity: line.quantity,
            session, productLabel: label, status: publishedOnly ? 409 : 400 });
        }
        const ordersProducts = priced.map(({ line }) => line);
        const subTotal = ordersProducts.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
        const finalAmount = subTotal + deliveryFee;
        const [order] = await Order.create([{
          ...orderData, orderNumber, storefrontId: storefront._id, ordersProducts, subTotal, finalAmount,
          paidAmount: orderData.paymentMethod === "cash_down" ? finalAmount : 0,
        }], { session });
        return order;
      });
    } catch (error) {
      const orderNumberConflict = error.code === 11000 && (error.keyPattern?.orderNumber || error.keyValue?.orderNumber);
      if (!orderNumberConflict) throw error;
      if (attempt === 3) throw new CustomError(409, "Please try placing your order again.", "ECO_ORDER_NUMBER_CONFLICT");
    }
  }
}
