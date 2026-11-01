import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import mongoose from "mongoose";
import dotenv from "dotenv";
import PaymentAccount from "../models/paymentAccount.model.js";
import PaymentAccountVersion from "../models/paymentAccountVersion.model.js";

dotenv.config();

const INITIAL_ACCOUNTS = [
  {
    provider: "kpay",
    displayName: "KBZ Pay",
    accountName: "ဒေါ်ဒေဝီ",
    accountNumber: "09798938874",
    brandColor: "#0A4A9F",
    textColor: "#FFFFFF",
    sortOrder: 1,
    isActive: true,
  },
  {
    provider: "wave",
    displayName: "WavePay",
    accountName: "ဒေါ်ဒေဝီ",
    accountNumber: "09798938874",
    brandColor: "#F6C500",
    textColor: "#1F1D1A",
    sortOrder: 2,
    isActive: true,
  },
  {
    provider: "aya",
    displayName: "AYA Pay",
    accountName: "ဒေါ်ဒေဝီ",
    accountNumber: "09798938874",
    brandColor: "#C8102E",
    textColor: "#FFFFFF",
    sortOrder: 3,
    isActive: true,
  },
];

async function seedPaymentAccounts() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in environment");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB for payment accounts seeding");

  let insertedCount = 0;
  let existingCount = 0;

  for (const acc of INITIAL_ACCOUNTS) {
    const existing = await PaymentAccount.findOne({ provider: acc.provider });
    if (!existing) {
      const created = await PaymentAccount.create({
        ...acc,
        qrImageUrl: null,
        qrImageKey: null,
        qrSha256: null,
        qrDecodedText: null,
        version: 1,
      });

      await PaymentAccountVersion.create({
        paymentAccountId: created._id,
        version: 1,
        provider: created.provider,
        displayName: created.displayName,
        accountName: created.accountName,
        accountNumber: created.accountNumber,
        brandColor: created.brandColor,
        textColor: created.textColor,
        qrImageUrl: null,
        qrImageKey: null,
        qrSha256: null,
        qrDecodedText: null,
        sortOrder: created.sortOrder,
        isActive: true,
        changeType: "INITIAL_SEED",
        savedBy: null,
        savedAt: new Date(),
      });

      console.log(`✓ Seeded payment account: ${created.displayName} (${created.provider})`);
      insertedCount++;
    } else {
      // Ensure initial version exists for existing account
      const existingVersion = await PaymentAccountVersion.findOne({
        paymentAccountId: existing._id,
        version: 1,
      });
      if (!existingVersion) {
        await PaymentAccountVersion.create({
          paymentAccountId: existing._id,
          version: 1,
          provider: existing.provider,
          displayName: existing.displayName,
          accountName: existing.accountName,
          accountNumber: existing.accountNumber,
          brandColor: existing.brandColor,
          textColor: existing.textColor,
          qrImageUrl: null,
          qrImageKey: null,
          qrSha256: null,
          qrDecodedText: null,
          sortOrder: existing.sortOrder,
          isActive: true,
          changeType: "INITIAL_SEED",
          savedBy: null,
          savedAt: new Date(),
        });
        console.log(`✓ Added missing version 1 snapshot for existing account: ${existing.displayName}`);
      }
      console.log(`- Account for provider '${acc.provider}' already exists (ID: ${existing._id}). Skipping.`);
      existingCount++;
    }
  }

  console.log(`\nSeeding completed: ${insertedCount} inserted, ${existingCount} already existed.`);
  await mongoose.disconnect();
}

seedPaymentAccounts().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
