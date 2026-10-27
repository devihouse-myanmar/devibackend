/**
 * pricing.utils.js
 * Single source of truth for unit pricing across POS, Ecommerce, and Orders.
 * Implements business rules R1 - R4 from STOREFRONT_DISCOUNT_PLAN.md.
 */

/**
 * Checks whether a discount object is currently effective (Rule R2).
 * @param {Object} discount
 * @param {Date} [now]
 * @returns {boolean}
 */
export const isDiscountEffective = (discount, now = new Date()) => {
  if (!discount || !discount.isActive) return false;
  const value = Number(discount.value) || 0;
  if (value <= 0) return false;

  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (discount.startDate) {
    const startTime = new Date(discount.startDate).getTime();
    if (currentTime < startTime) return false;
  }

  if (discount.endDate) {
    const endTime = new Date(discount.endDate).getTime();
    if (currentTime > endTime) return false;
  }

  return true;
};

/**
 * Calculates per-unit MMK discount amount (Rule R3).
 * @param {number} sellingPrice
 * @param {Object} discount
 * @returns {number} whole MMK amount, clamped to sellingPrice
 */
export const getDiscountAmount = (sellingPrice, discount) => {
  if (!discount || !isDiscountEffective(discount)) return 0;
  const price = Math.max(0, Number(sellingPrice) || 0);
  const value = Math.max(0, Number(discount.value) || 0);

  let rawDiscount = 0;
  if (discount.type === "fixed") {
    rawDiscount = value;
  } else {
    // default percentage
    rawDiscount = (price * value) / 100;
  }

  const rounded = Math.round(rawDiscount);
  return Math.min(price, Math.max(0, rounded));
};

/**
 * Checks wholesale tiers and returns eligible tier price, or null if none eligible.
 * Existing tier logic: highest quantity tier where qty >= tier.quantity
 * @param {Object} inventory
 * @param {number} qty
 * @returns {number|null}
 */
export const getWholesalePrice = (inventory, qty) => {
  if (
    !inventory ||
    !Array.isArray(inventory.wholesalePrices) ||
    inventory.wholesalePrices.length === 0
  ) {
    return null;
  }
  const quantity = Math.max(0, Number(qty) || 0);
  const eligibleTier = inventory.wholesalePrices
    .slice()
    .sort((a, b) => a.quantity - b.quantity)
    .filter((tier) => quantity >= tier.quantity)
    .pop();

  return eligibleTier && typeof eligibleTier.price === "number"
    ? eligibleTier.price
    : null;
};

/**
 * Master unit pricing resolver (Rules R3 + R4).
 * @param {Object} params
 * @param {Object} params.inventory - Inventory doc/object (must have sellingPrice)
 * @param {Object} [params.stockRecord] - StorefrontInventory doc/object (has discount)
 * @param {number} [params.quantity=1] - Order quantity
 * @param {Date} [params.now=new Date()]
 * @param {boolean} [params.applyWholesale=true] - Whether to apply wholesale tier pricing
 * @returns {{
 *   unitPrice: number,
 *   originalUnitPrice: number,
 *   itemDiscount: { type: string, value: number, amount: number } | null,
 *   priceSource: "retail" | "discount" | "wholesale"
 * }}
 */
export const resolveUnitPrice = ({
  inventory,
  stockRecord,
  quantity = 1,
  now = new Date(),
  applyWholesale = true,
}) => {
  const originalUnitPrice = Math.max(0, Number(inventory?.sellingPrice) || 0);
  const discountObj = stockRecord?.discount;
  const isEffective = isDiscountEffective(discountObj, now);

  let discountedPrice = originalUnitPrice;
  let discountAmount = 0;

  if (isEffective) {
    discountAmount = getDiscountAmount(originalUnitPrice, discountObj);
    discountedPrice = Math.max(0, Math.round(originalUnitPrice - discountAmount));
  }

  // Check wholesale tier price if enabled
  const wholesalePrice = applyWholesale
    ? getWholesalePrice(inventory, quantity)
    : null;

  // Rule R4: Wholesale tiers and discounts do not stack. Lower price wins.
  if (wholesalePrice !== null && wholesalePrice < discountedPrice) {
    return {
      unitPrice: wholesalePrice,
      originalUnitPrice,
      itemDiscount: null, // Wholesale won, so no item discount recorded
      priceSource: "wholesale",
    };
  }

  if (isEffective && discountAmount > 0) {
    return {
      unitPrice: discountedPrice,
      originalUnitPrice,
      itemDiscount: {
        type: discountObj.type || "percentage",
        value: Number(discountObj.value) || 0,
        amount: discountAmount,
      },
      priceSource: "discount",
    };
  }

  return {
    unitPrice: originalUnitPrice,
    originalUnitPrice,
    itemDiscount: null,
    priceSource: "retail",
  };
};
