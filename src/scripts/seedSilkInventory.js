import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import mongoose from "mongoose";

import Inventory from "../models/inventory.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import WarehouseStock from "../models/warehouse.model.js";
import LocationProfile from "../models/locationProfile.model.js";
import SupplierProfile from "../models/supplierProfile.model.js";

// 15 Traditional Myanmar & Asian Silk Fabric Designs
const silkDesigns = [
  {
    name: "မန္တလေး ရွှေချည်ထိုး ပိုးထည်",
    codePrefix: "MDY-GLD",
    category: "ရွှေချည်ထိုး ပိုး",
    subCategory: "မန္တလေးရိုးရာ",
    description: "မန္တလေး ရိုးရာ ရွှေချည်ငွေချည်ထိုး အဆင့်မြင့်ပိုးစစ်စစ် လက်ယက်ထည်။",
    image: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&auto=format&fit=crop",
    price1Yd: { buying: 20000, selling: 32000, wholesale: 28000 },
    price2Yd: { buying: 38000, selling: 60000, wholesale: 52000 },
  },
  {
    name: "အင်းလေး ရိုးရာပိုး ချိတ်လုံချည်",
    codePrefix: "INL-CHT",
    category: "အင်းလေးချိတ်ပိုး",
    subCategory: "ရှမ်းရိုးရာ",
    description: "အင်းလေးကန်ဒေသထွက် သဘာဝဆိုးဆေးသုံး ရိုးရာချိတ်ပိုးထည်။",
    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop",
    price1Yd: { buying: 18000, selling: 28000, wholesale: 24000 },
    price2Yd: { buying: 35000, selling: 54000, wholesale: 46000 },
  },
  {
    name: "ရွှေတောင် ပိုးစစ်စစ်",
    codePrefix: "STG-SLK",
    category: "ရွှေတောင်ပိုး",
    subCategory: "ပဲခူးရိုးရာ",
    description: "ရွှေတောင်မြို့ထွက် နူးညံ့ချောမွေ့သော ပိုးသားစစ်စစ် အရည်အသွေးမြင့်အထည်။",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&auto=format&fit=crop",
    price1Yd: { buying: 22000, selling: 35000, wholesale: 30000 },
    price2Yd: { buying: 42000, selling: 66000, wholesale: 58000 },
  },
  {
    name: "အမရပူရ နန်းတွင်းချိတ်ပိုး",
    codePrefix: "AMP-ROY",
    category: "နန်းတွင်းချိတ်",
    subCategory: "နန်းတွင်းရိုးရာ",
    description: "အမရပူရ နန်းတွင်းသုံး လွန်းရာချိတ်ပုံစံ ရိုးရာလက်ယက်ပိုးထည်။",
    image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop",
    price1Yd: { buying: 25000, selling: 40000, wholesale: 35000 },
    price2Yd: { buying: 48000, selling: 78000, wholesale: 68000 },
  },
  {
    name: "ကချင် ရိုးရာပန်းထိုးပိုး",
    codePrefix: "KCH-FLR",
    category: "ကချင်ပိုး",
    subCategory: "တိုင်းရင်းသားရိုးရာ",
    description: "ကချင်ရိုးရာ အဆင်ဒီဇိုင်း ပန်းထိုးပိုးသားအထည်။",
    image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop",
    price1Yd: { buying: 19000, selling: 30000, wholesale: 26000 },
    price2Yd: { buying: 36000, selling: 58000, wholesale: 50000 },
  },
  {
    name: "ချင်း ရိုးရာ ရက်ကန်းပိုး",
    codePrefix: "CHN-WVN",
    category: "ချင်းရိုးရာပိုး",
    subCategory: "တိုင်းရင်းသားရိုးရာ",
    description: "ချင်းတောင်တန်း ရိုးရာလက်ယက်ရက်ကန်း ပိုးထည်ဆန်း။",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop",
    price1Yd: { buying: 21000, selling: 33000, wholesale: 29000 },
    price2Yd: { buying: 40000, selling: 63000, wholesale: 55000 },
  },
  {
    name: "မော်လမြိုင် ဇာပိုးထည်",
    codePrefix: "MLM-LCE",
    category: "မော်လမြိုင်ပိုး",
    subCategory: "မွန်ရိုးရာ",
    description: "မော်လမြိုင် ပိုးဇာ အနားကွပ် အထူးပိုးထည်။",
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop",
    price1Yd: { buying: 17000, selling: 27000, wholesale: 23000 },
    price2Yd: { buying: 33000, selling: 52000, wholesale: 44000 },
  },
  {
    name: "ပုသိမ် ပိုးစစ် အထည်",
    codePrefix: "PTH-SLK",
    category: "ပုသိမ်ပိုး",
    subCategory: "ဧရာဝတီရိုးရာ",
    description: "ပုသိမ်ဒေသထွက် အေးမြသော ပိုးသားချော။",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop",
    price1Yd: { buying: 16000, selling: 25000, wholesale: 22000 },
    price2Yd: { buying: 31000, selling: 48000, wholesale: 42000 },
  },
  {
    name: "ထိုင်းပိုး ချည်ရော အထည်",
    codePrefix: "THI-SLK",
    category: "ထိုင်းပိုး",
    subCategory: "နိုင်ငံတကာပိုး",
    description: "ထိုင်းပိုးစစ်စစ် ပြောင်ချော အသားကောင်း ရောင်စုံအထည်။",
    image: "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=600&auto=format&fit=crop",
    price1Yd: { buying: 15000, selling: 24000, wholesale: 21000 },
    price2Yd: { buying: 29000, selling: 46000, wholesale: 40000 },
  },
  {
    name: "အိန္ဒိယ ရွှေချည်လွန်းရာ",
    codePrefix: "IND-BRO",
    category: "လွန်းရာပိုး",
    subCategory: "နိုင်ငံတကာပိုး",
    description: "အိန္ဒိယ ရိုးရာ ဘာနာရက်စ် ပိုးသား ရွှေချည်ကနုတ်ထိုး အထည်။",
    image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=600&auto=format&fit=crop",
    price1Yd: { buying: 24000, selling: 38000, wholesale: 33000 },
    price2Yd: { buying: 46000, selling: 74000, wholesale: 64000 },
  },
  {
    name: "တောင်ကြီး ပန်းကြွပိုး",
    codePrefix: "TG-EMB",
    category: "ပန်းကြွပိုး",
    subCategory: "ရှမ်းရိုးရာ",
    description: "တောင်ကြီး ရိုးရာ ပန်းကြွအဆင် လက်ရာမြောက် ပိုးထည်။",
    image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop",
    price1Yd: { buying: 18000, selling: 29000, wholesale: 25000 },
    price2Yd: { buying: 35000, selling: 56000, wholesale: 48000 },
  },
  {
    name: "ပျဉ်းမနား ချည်ပိုး",
    codePrefix: "PMN-CTN",
    category: "ချည်ပိုး",
    subCategory: "အလယ်ပိုင်းရိုးရာ",
    description: "ဝတ်ဆင်ရ ပေါ့ပါးအေးမြသော ပျဉ်းမနား ချည်ရောပိုးထည်။",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&auto=format&fit=crop",
    price1Yd: { buying: 14000, selling: 22000, wholesale: 19000 },
    price2Yd: { buying: 27000, selling: 42000, wholesale: 36000 },
  },
  {
    name: "ပခုက္ကူ ရက်ကန်းချိတ်ပိုး",
    codePrefix: "PKU-WVN",
    category: "ပခုက္ကူပိုး",
    subCategory: "ရက်ကန်းရိုးရာ",
    description: "ပခုက္ကူ လက်ယက် ရက်ကန်း ချိတ်အဆင်စုံ ပိုးထည်။",
    image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop",
    price1Yd: { buying: 19000, selling: 31000, wholesale: 27000 },
    price2Yd: { buying: 37000, selling: 59000, wholesale: 51000 },
  },
  {
    name: "ပဲခူး ရိုးရာပိုးထည်",
    codePrefix: "BGO-TRD",
    category: "ပဲခူးပိုး",
    subCategory: "ပဲခူးရိုးရာ",
    description: "ဟံသာဝတီ ပဲခူး ရိုးရာစတိုင် ချိတ်နှင့် ပိုးရောအထည်။",
    image: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&auto=format&fit=crop",
    price1Yd: { buying: 17000, selling: 27000, wholesale: 24000 },
    price2Yd: { buying: 33000, selling: 52000, wholesale: 45000 },
  },
  {
    name: "ကျိုင်းတုံ ရှမ်းပိုးထည်",
    codePrefix: "KTN-SHN",
    category: "ရှမ်းပိုး",
    subCategory: "ရှမ်းရိုးရာ",
    description: "ကျိုင်းတုံ ရှမ်းနီ ရှမ်းဗမာ ရိုးရာလက်ယက် ပိုးထည်။",
    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop",
    price1Yd: { buying: 20000, selling: 32000, wholesale: 28000 },
    price2Yd: { buying: 39000, selling: 61000, wholesale: 53000 },
  },
];

const colorsList = ["ရွှေဝါ", "ကြက်သွေး", "မြစိမ်း", "အပြာနု", "ခရမ်းနု"];
const colorCodeMap = {
  "ရွှေဝါ": "GLD",
  "ကြက်သွေး": "CRIM",
  "မြစိမ်း": "EMR",
  "အပြာနု": "LBLU",
  "ခရမ်းနု": "PRP",
};

async function seedSilk() {
  console.log("Connecting to MongoDB...");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI not set in .env");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected successfully to DB!");

  // 1. Get or create Silk Supplier
  let supplier = await SupplierProfile.findOne({ supplierName: "မန္တလေး ပိုးရက်ကန်း ပင်ရင်းဒိုင်" });
  if (!supplier) {
    supplier = await SupplierProfile.create({
      supplierName: "မန္တလေး ပိုးရက်ကန်း ပင်ရင်းဒိုင်",
      contactPerson: "ဒေါ်ခင်စန်းဝင်း",
      contactNumber: "+959798889999",
      address: "အမရပူရမြို့နယ်၊ မန္တလေးတိုင်းဒေသကြီး",
    });
    console.log(`[+] Created Supplier: ${supplier.supplierName}`);
  } else {
    console.log(`[*] Using existing Supplier: ${supplier.supplierName}`);
  }

  // 2. Get Storefront and Warehouse locations
  let storefront = await LocationProfile.findOne({ type: "storefront", isDeleted: false });
  if (!storefront) {
    storefront = await LocationProfile.create({
      type: "storefront",
      locationCode: "SF-001",
      locationName: "Main Silk Storefront",
      locationAddress: "Bogyoke Market, Yangon",
      locationPhone: "+959798938874",
      status: "active",
    });
  }

  let warehouse = await LocationProfile.findOne({ type: "warehouse", isDeleted: false });
  if (!warehouse) {
    warehouse = await LocationProfile.create({
      type: "warehouse",
      locationCode: "WH-001",
      locationName: "Central Silk Warehouse",
      locationAddress: "Industrial Zone, Yangon",
      locationPhone: "+959791112233",
      status: "active",
    });
  }

  let ecommerceStore = await LocationProfile.findOne({
    type: "storefront",
    $or: [{ isEcommerceDefault: true }, { locationCode: "SF-ECOMMERCE" }],
    isDeleted: false,
  });
  if (!ecommerceStore) {
    ecommerceStore = await LocationProfile.create({
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

  console.log(`\n🧹 Cleaning old inventory and stocks and dropping old indexes...`);
  try {
    await StorefrontInventory.collection.dropIndexes();
    await WarehouseStock.collection.dropIndexes();
  } catch (e) {
    console.log("Indexes dropped or not found:", e.message);
  }
  const delStore = await StorefrontInventory.deleteMany({});
  const delWh = await WarehouseStock.deleteMany({});
  const delInv = await Inventory.deleteMany({});
  console.log(`Deleted ${delInv.deletedCount} products, ${delStore.deletedCount} shop stocks, ${delWh.deletedCount} warehouse stocks.`);

  console.log(`\n🧵 Generating Silk Fabric datasets (15 designs x 5 colors x 2 units = 150 variants)...`);
  let barcodeCounter = 885200000001;
  let totalCreated = 0;

  for (let dIdx = 0; dIdx < silkDesigns.length; dIdx++) {
    const design = silkDesigns[dIdx];
    const designNum = String(dIdx + 1).padStart(2, "0");

    for (const color of colorsList) {
      const cCode = colorCodeMap[color] || "STD";

      // 1 Yard Unit
      const code1Yd = `${design.codePrefix}-${cCode}-1YD`;
      const name1Yd = `${design.name} - ${color} (၁ ကိုက်)`;
      const barcode1Yd = String(barcodeCounter++);

      const inv1 = await Inventory.create({
        productName: name1Yd,
        productCode: code1Yd,
        saleCode: `S-${code1Yd}`,
        SKU: `SKU-${code1Yd}`,
        barcode: barcode1Yd,
        category: design.name,
        subCategory: design.subCategory,
        brand: "ရိုးရာပိုးထည်",
        color: color,
        size: "၁ ကိုက်",
        description: design.description,
        buyingPrice: design.price1Yd.buying,
        sellingPrice: design.price1Yd.selling,
        wholesalePrices: [
          { quantity: 5, price: design.price1Yd.wholesale },
          { quantity: 10, price: design.price1Yd.wholesale - 2000 },
        ],
        unitOfMeasure: "ကိုက်",
        reorderPoint: 5,
        reorderQuantity: 20,
        status: "active",
        images: [{ url: design.image, color: color, isPrimary: true }],
        supplierIds: [supplier._id],
      });

      await StorefrontInventory.create({
        storefrontId: storefront._id,
        inventoryId: inv1._id,
        quantity: Math.floor(Math.random() * 20) + 10, // 10 to 30 yards
        availableQuantity: Math.floor(Math.random() * 20) + 10,
        lastUpdated: new Date(),
      });

      await StorefrontInventory.create({
        storefrontId: ecommerceStore._id,
        inventoryId: inv1._id,
        quantity: Math.floor(Math.random() * 15) + 5, // 5 to 20 yards for online
        availableQuantity: Math.floor(Math.random() * 15) + 5,
        lastUpdated: new Date(),
      });

      await WarehouseStock.create({
        warehouseId: warehouse._id,
        inventoryId: inv1._id,
        quantity: Math.floor(Math.random() * 50) + 50, // 50 to 100 yards
        lastUpdated: new Date(),
      });

      totalCreated++;

      // 2 Yards Unit
      const code2Yd = `${design.codePrefix}-${cCode}-2YD`;
      const name2Yd = `${design.name} - ${color} (၂ ကိုက်)`;
      const barcode2Yd = String(barcodeCounter++);

      const inv2 = await Inventory.create({
        productName: name2Yd,
        productCode: code2Yd,
        saleCode: `S-${code2Yd}`,
        SKU: `SKU-${code2Yd}`,
        barcode: barcode2Yd,
        category: design.name,
        subCategory: design.subCategory,
        brand: "ရိုးရာပိုးထည်",
        color: color,
        size: "၂ ကိုက်",
        description: design.description,
        buyingPrice: design.price2Yd.buying,
        sellingPrice: design.price2Yd.selling,
        wholesalePrices: [
          { quantity: 5, price: design.price2Yd.wholesale },
          { quantity: 10, price: design.price2Yd.wholesale - 3000 },
        ],
        unitOfMeasure: "ကိုက်",
        reorderPoint: 5,
        reorderQuantity: 20,
        status: "active",
        images: [{ url: design.image, color: color, isPrimary: true }],
        supplierIds: [supplier._id],
      });

      await StorefrontInventory.create({
        storefrontId: storefront._id,
        inventoryId: inv2._id,
        quantity: Math.floor(Math.random() * 15) + 8, // 8 to 23 pieces
        availableQuantity: Math.floor(Math.random() * 15) + 8,
        lastUpdated: new Date(),
      });

      await StorefrontInventory.create({
        storefrontId: ecommerceStore._id,
        inventoryId: inv2._id,
        quantity: Math.floor(Math.random() * 12) + 5, // 5 to 17 pieces for online
        availableQuantity: Math.floor(Math.random() * 12) + 5,
        lastUpdated: new Date(),
      });

      await WarehouseStock.create({
        warehouseId: warehouse._id,
        inventoryId: inv2._id,
        quantity: Math.floor(Math.random() * 40) + 40, // 40 to 80 pieces
        lastUpdated: new Date(),
      });

      totalCreated++;
    }

    console.log(`[✔] Seeded Design ${dIdx + 1}/15: ${design.name} (10 variants)`);
  }

  console.log(`\n🎉 Successfully seeded ${totalCreated} Silk Fabric items into Inventory, Storefront, and Warehouse!`);
  await mongoose.disconnect();
}

seedSilk().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
