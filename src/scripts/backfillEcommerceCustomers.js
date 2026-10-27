import Db from "../configs/db.config.js";
import Order from "../models/orders.model.js";
import CreditPerson from "../models/creditPersona.model.js";
import { formatPhoneNumber } from "../utils/phoneValidation.utils.js";

async function run() {
  await Db();
  console.log("Connected to DB");

  const orders = await Order.find({ orderSource: "ecommerce", creditPersonId: null });
  console.log("Found unlinked ecommerce orders:", orders.length);

  for (const order of orders) {
    const rawPhone = order.customerInfo?.phone?.trim();
    const rawName = order.customerInfo?.name?.trim();
    if (!rawPhone || !rawName) continue;

    const address = [order.customerInfo.address, order.customerInfo.township, order.customerInfo.city]
      .filter(Boolean)
      .join(", ");
    const normalizedPhone = formatPhoneNumber(rawPhone) || rawPhone.replace(/\D/g, "");
    const rawDigits = rawPhone.replace(/\D/g, "");

    const phoneConditions = [{ phone: rawPhone }];
    if (normalizedPhone && normalizedPhone !== rawPhone) {
      phoneConditions.push({ phone: normalizedPhone });
    }
    if (rawDigits.length >= 7) {
      phoneConditions.push({ phone: { $regex: rawDigits.slice(-7) + "$" } });
    }

    let cp = await CreditPerson.findOne({ $or: phoneConditions });
    if (!cp) {
      cp = await CreditPerson.create({
        name: rawName,
        phone: rawPhone,
        address: address,
      });
      console.log(`Created CreditPerson for: ${rawName} (${rawPhone})`);
    } else {
      console.log(`Found existing CreditPerson for: ${rawName} (${rawPhone})`);
    }

    order.creditPersonId = cp._id;
    await order.save();
    console.log(`Linked order ${order.orderNumber} to CreditPerson ${cp._id}`);
  }

  console.log("Backfill completed!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
