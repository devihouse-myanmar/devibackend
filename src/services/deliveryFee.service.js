import NodeCache from "node-cache";
import DeliveryTownship from "../models/deliveryTownship.model.js";
import ShopSetting from "../models/shopSetting.model.js";
import CreditPerson from "../models/creditPersona.model.js";
import HomeSection from "../models/homeSection.model.js";
import CustomError from "../utils/customError.js";
import { formatPhoneNumber } from "../utils/phoneValidation.utils.js";

const deliveryCache = new NodeCache({ stdTTL: 300 });
const PENDING_FEE = { fee: 0, feeSource: "pending", feePending: true };

export async function hasActiveFreeDeliveryEvent(session = null) {
  return Boolean(await HomeSection.exists({ isActive: true, deliveryFeeMode: "free" }).session(session));
}

export function deliveryTermsChanged() {
  return new CustomError(409, "Delivery terms changed. Review the updated checkout total before placing the order.", "DELIVERY_TERMS_CHANGED");
}

export function validateEcommerceDeliveryQuote(quote, paymentMethod, expectedDelivery) {
  const freeDeliveryEvent = quote.feeSource === "event";
  if (expectedDelivery === undefined) {
    if (freeDeliveryEvent && paymentMethod === "cash_down") throw deliveryTermsChanged();
    return;
  }

  let expected = expectedDelivery;
  try {
    if (typeof expected === "string") expected = JSON.parse(expected);
  } catch {
    throw new CustomError(400, "Invalid delivery quote");
  }
  if (!expected || !Number.isFinite(expected.fee) || typeof expected.feePending !== "boolean" ||
      typeof expected.freeDeliveryEvent !== "boolean") {
    throw new CustomError(400, "Invalid delivery quote");
  }
  if (expected.fee !== quote.fee || expected.feePending !== quote.feePending ||
      expected.freeDeliveryEvent !== freeDeliveryEvent) {
    throw deliveryTermsChanged();
  }
}

export const clearDeliveryCache = () => {
  deliveryCache.del("active_townships");
  deliveryCache.del("delivery_settings");
};

export const normalizePhoneExact = (phone) => {
  if (!phone) return "";
  const formatted = formatPhoneNumber(String(phone).trim());
  if (formatted) return formatted;
  const digits = String(phone).replace(/\D/g, "");
  return digits;
};

export const getCachedDeliverySettings = async () => {
  const cached = deliveryCache.get("delivery_settings");
  if (cached) return cached;

  const settingDoc = await ShopSetting.findOne({ isActive: true }).lean();
  const settings = {
    carGateFee: Number(settingDoc?.delivery?.carGateFee ?? 0),
    carGateNote:
      settingDoc?.delivery?.carGateNote ||
      "ဂိတ်မှ ခရီးဆုံးအထိ ကားခကို ပစ္စည်းရောက်ရှိချိန်တွင် ကားဂိတ်၌ ပေးချေရပါမည်",
  };
  deliveryCache.set("delivery_settings", settings);
  return settings;
};

export const getCachedActiveTownships = async () => {
  const cached = deliveryCache.get("active_townships");
  if (cached) return cached;

  const townships = await DeliveryTownship.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  deliveryCache.set("active_townships", townships);
  return townships;
};

/**
 * Resolves the delivery fee and snapshot metadata for an ecommerce order
 * @param {Object} params
 * @param {string} params.paymentMethod - 'cod' or 'cash_down'
 * @param {string} params.deliMethod - 'deli_service' or 'car_gate'
 * @param {string} [params.township] - Myanmar township name
 * @param {string} [params.phone] - Customer phone
 * @returns {Promise<{ fee: number, feeSource: string, feePending: boolean, freeDeliveryCustomerId?: string }>}
 */
export async function resolveDeliveryFee({
  paymentMethod,
  deliMethod,
  township,
  phone,
}) {
  if (await hasActiveFreeDeliveryEvent()) {
    return { fee: 0, feeSource: "event", feePending: false };
  }

  const normalizedPayment = (paymentMethod || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "_");

  const normalizedDeli = (deliMethod || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "_");
  const townshipName = typeof township === "string" ? township.trim() : "";
  const isCod = normalizedPayment === "cod" || normalizedPayment === "cash_on_delivery";

  // D6 & D10: Free-delivery customer check for cash-down orders (Exact normalized phone match only)
  if (!isCod && phone) {
    const rawTrimmed = String(phone).trim();
    const phoneCandidates = new Set([rawTrimmed]);

    // Use libphonenumber if valid
    const formattedE164 = formatPhoneNumber(rawTrimmed);
    if (formattedE164) {
      phoneCandidates.add(formattedE164);
      if (formattedE164.startsWith("+959")) {
        phoneCandidates.add("09" + formattedE164.slice(4));
      }
    }

    // Also handle standard Myanmar 09 vs +959/959 exact representations
    const digitsOnly = rawTrimmed.replace(/\D/g, "");
    if (digitsOnly.startsWith("959")) {
      phoneCandidates.add("+959" + digitsOnly.slice(3));
      phoneCandidates.add("09" + digitsOnly.slice(3));
    } else if (digitsOnly.startsWith("09")) {
      phoneCandidates.add("+959" + digitsOnly.slice(2));
      phoneCandidates.add("09" + digitsOnly.slice(2));
    } else if (digitsOnly.startsWith("9") && digitsOnly.length >= 8) {
      phoneCandidates.add("+95" + digitsOnly);
      phoneCandidates.add("0" + digitsOnly);
    }

    const phoneQueries = Array.from(phoneCandidates).map((p) => ({ phone: p }));

    const customer = await CreditPerson.findOne({
      $or: phoneQueries,
      freeDelivery: true,
    }).lean();

    if (customer && customer.freeDelivery === true) {
      return {
        fee: 0,
        feeSource: "freeCustomer",
        feePending: false,
        freeDeliveryCustomerId: customer._id.toString(),
      };
    }
  }

  // D5: Car gate method
  if (normalizedDeli === "car_gate") {
    if (isCod) return { fee: 0, feeSource: "cod", feePending: false };

    const settings = await getCachedDeliverySettings();
    return {
      fee: settings.carGateFee || 0,
      feeSource: "carGate",
      feePending: false,
    };
  }

  // Home delivery uses the configured township rate for both payment methods.
  if (normalizedDeli === "deli_service" && townshipName) {
    const townships = await getCachedActiveTownships();
    const matched = townships.find((t) => t.township === townshipName);

    if (Number.isFinite(matched?.fee) && matched.fee >= 0) {
      return {
        fee: matched.fee,
        feeSource: "township",
        feePending: false,
      };
    }
  }

  // No fee set or township not found / not active -> feePending
  return PENDING_FEE;
}
