import dns from "node:dns";
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import mongoose from "mongoose";

import Inventory from "../models/inventory.model.js";
import StorefrontInventory from "../models/storefrontInventory.model.js";
import WarehouseStock from "../models/warehouse.model.js";
import LocationProfile from "../models/locationProfile.model.js";
import SupplierProfile from "../models/supplierProfile.model.js";

const sampleClothes = [
  {
    productName: "Oversized Streetwear Graphic T-Shirt",
    productCode: "TSH-WHT-001",
    SKU: "SKU-TSH-WHT-001",
    barcode: "885100010001",
    category: "T-Shirt",
    subCategory: "Graphic Tees",
    brand: "Devi Streetwear",
    color: "White",
    size: "L",
    description: "Premium heavyweight 240gsm 100% combed cotton oversized graphic t-shirt.",
    buyingPrice: 12000,
    sellingPrice: 22000,
    wholesalePrices: [
      { quantity: 5, price: 18000 },
      { quantity: 10, price: 16000 },
    ],
    unitOfMeasure: "piece",
    reorderPoint: 5,
    reorderQuantity: 20,
    status: "active",
    images: [
      {
        url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop",
        color: "White",
        isPrimary: true,
      },
    ],
    tags: ["cotton", "streetwear", "graphic", "oversized"],
    shopStock: 25,
    warehouseStock: 60,
  },
  {
    productName: "Vintage Acid Wash Heavyweight Tee",
    productCode: "TSH-BLK-002",
    SKU: "SKU-TSH-BLK-002",
    barcode: "885100010002",
    category: "T-Shirt",
    subCategory: "Basic Tees",
    brand: "Devi Streetwear",
    color: "Washed Black",
    size: "XL",
    description: "Drop-shoulder vintage washed black cotton tee with reinforced rib collar.",
    buyingPrice: 14000,
    sellingPrice: 25000,
    wholesalePrices: [
      { quantity: 5, price: 20000 },
      { quantity: 12, price: 18000 },
    ],
    unitOfMeasure: "piece",
    reorderPoint: 5,
    reorderQuantity: 20,
    status: "active",
    images: [
      {
        url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop",
        color: "Washed Black",
        isPrimary: true,
      },
    ],
    tags: ["vintage", "acid wash", "heavyweight"],
    shopStock: 18,
    warehouseStock: 45,
  },
  {
    productName: "Classic Linen Mandarin Collar Shirt",
    productCode: "SHT-BEI-003",
    SKU: "SKU-SHT-BEI-003",
    barcode: "885100010003",
    category: "Shirt",
    subCategory: "Casual Shirts",
    brand: "Urban Cotton",
    color: "Beige",
    size: "M",
    description: "Breathable 100% natural linen long-sleeve button-down shirt with mandarin collar.",
    buyingPrice: 22000,
    sellingPrice: 38000,
    wholesalePrices: [
      { quantity: 3, price: 32000 },
      { quantity: 10, price: 28000 },
    ],
    unitOfMeasure: "piece",
    reorderPoint: 3,
    reorderQuantity: 15,
    status: "active",
    images: [
      {
        url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop",
        color: "Beige",
        isPrimary: true,
      },
    ],
    tags: ["linen", "casual", "mandarin collar"],
    shopStock: 14,
    warehouseStock: 30,
  },
  {
    productName: "Wide-Leg Vintage Washed Denim Jeans",
    productCode: "JNS-BLU-004",
    SKU: "SKU-JNS-BLU-004",
    barcode: "885100010004",
    category: "Pants / Jeans",
    subCategory: "Denim",
    brand: "Devi Denim",
    color: "Light Blue",
    size: "32",
    description: "Relaxed baggy fit 13.5oz durable denim with vintage whisker wash.",
    buyingPrice: 28000,
    sellingPrice: 48000,
    wholesalePrices: [
      { quantity: 5, price: 40000 },
      { quantity: 10, price: 36000 },
    ],
    unitOfMeasure: "piece",
    reorderPoint: 4,
    reorderQuantity: 20,
    status: "active",
    images: [
      {
        url: "https://images.unsplash.com/photo-1542272604-780c96856592?w=600&auto=format&fit=crop",
        color: "Light Blue",
        isPrimary: true,
      },
    ],
    tags: ["denim", "wide leg", "baggy", "jeans"],
    shopStock: 15,
    warehouseStock: 35,
  },
  {
    productName: "French Floral Print Summer Midi Dress",
    productCode: "DRS-NVY-005",
    SKU: "SKU-DRS-NVY-005",
    barcode: "885100010005",
    category: "Dress / Skirt",
    subCategory: "Casual Dresses",
    brand: "Elegance Collection",
    color: "Navy Floral",
    size: "Free Size",
    description: "Lightweight chiffon floral midi dress with elasticated waist and ruffled hem.",
    buyingPrice: 24000,
    sellingPrice: 42000,
    wholesalePrices: [
      { quantity: 3, price: 35000 },
      { quantity: 8, price: 31000 },
    ],
    unitOfMeasure: "piece",
    reorderPoint: 3,
    reorderQuantity: 15,
    status: "active",
    images: [
      {
        url: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&auto=format&fit=crop",
        color: "Navy Floral",
        isPrimary: true,
      },
    ],
    tags: ["dress", "floral", "midi", "chiffon"],
    shopStock: 10,
    warehouseStock: 25,
  },
  {
    productName: "Heavyweight Zip-Up French Terry Hoodie",
    productCode: "HOD-GRY-006",
    SKU: "SKU-HOD-GRY-006",
    barcode: "885100010006",
    category: "Hoodie / Sweater",
    subCategory: "Hoodies",
    brand: "Devi Streetwear",
    color: "Heather Gray",
    size: "L",
    description: "420gsm thick french terry cotton zip hoodie with custom YKK zipper and double-layer hood.",
    buyingPrice: 35000,
    sellingPrice: 58000,
    wholesalePrices: [
      { quantity: 3, price: 50000 },
      { quantity: 10, price: 45000 },
    ],
    unitOfMeasure: "piece",
    reorderPoint: 2,
    reorderQuantity: 10,
    status: "active",
    images: [
      {
        url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop",
        color: "Heather Gray",
        isPrimary: true,
      },
    ],
    tags: ["hoodie", "fleece", "heavyweight", "streetwear"],
    shopStock: 8,
    warehouseStock: 25,
  },
  {
    productName: "Traditional Handwoven Cotton Fabric Roll (ပိတ်စ)",
    productCode: "FAB-IND-007",
    SKU: "SKU-FAB-IND-007",
    barcode: "885100010007",
    category: "Fabric / ပိတ်စ",
    subCategory: "Cotton Rolls",
    brand: "Amarapura Looms",
    color: "Indigo Pattern",
    size: "Standard Yard Roll",
    description: "Authentic Myanmar handloom cotton pattern fabric roll. Soft touch, vibrant natural dye.",
    buyingPrice: 15000,
    sellingPrice: 26000,
    wholesalePrices: [
      { quantity: 5, price: 21000 },
      { quantity: 15, price: 18000 },
    ],
    unitOfMeasure: "ကိုက်",
    reorderPoint: 5,
    reorderQuantity: 30,
    status: "active",
    images: [
      {
        url: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop",
        color: "Indigo Pattern",
        isPrimary: true,
      },
    ],
    tags: ["fabric", "handloom", "traditional", "cotton"],
    shopStock: 35,
    warehouseStock: 120,
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in .env");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected successfully!");

  // 1. Get or create Supplier
  let supplier = await SupplierProfile.findOne({ supplierName: "Mandalay Garment & Textile Supply" });
  if (!supplier) {
    supplier = await SupplierProfile.create({
      supplierName: "Mandalay Garment & Textile Supply",
      contactNumber: "+959791234567",
    });
    console.log(`Created supplier: ${supplier.supplierName} (${supplier._id})`);
  } else {
    console.log(`Using existing supplier: ${supplier.supplierName} (${supplier._id})`);
  }

  // 2. Get or create Storefront
  let storefront = await LocationProfile.findOne({ type: "storefront", isDeleted: false });
  if (!storefront) {
    storefront = await LocationProfile.create({
      type: "storefront",
      locationCode: "SF-001",
      locationName: "Main Store",
      locationAddress: "No. 123, Bogyoke Aung San Road, Yangon",
      locationPhone: "+959798938874",
      managerName: "Store Manager",
      status: "active",
      description: "Primary retail storefront",
    });
    console.log(`Created storefront: ${storefront.locationName} (${storefront._id})`);
  } else {
    console.log(`Using storefront: ${storefront.locationName} (${storefront._id})`);
  }

  // 3. Get or create Warehouse
  let warehouse = await LocationProfile.findOne({ type: "warehouse", isDeleted: false });
  if (!warehouse) {
    warehouse = await LocationProfile.create({
      type: "warehouse",
      locationCode: "WH-001",
      locationName: "Central Warehouse",
      locationAddress: "Industrial Zone 1, Hlaing Tharyar, Yangon",
      locationPhone: "+959791112233",
      managerName: "Warehouse Supervisor",
      status: "active",
      description: "Central distribution and storage warehouse",
    });
    console.log(`Created warehouse: ${warehouse.locationName} (${warehouse._id})`);
  } else {
    console.log(`Using warehouse: ${warehouse.locationName} (${warehouse._id})`);
  }

  // 4. Seed Clothing Inventory & Stocks
  for (const item of sampleClothes) {
    const { shopStock, warehouseStock, ...inventoryData } = item;
    inventoryData.supplierIds = [supplier._id];

    let product = await Inventory.findOne({ productCode: inventoryData.productCode });
    if (!product) {
      product = await Inventory.create(inventoryData);
      console.log(`[+] Created Product: ${product.productName} (${product.productCode})`);
    } else {
      Object.assign(product, inventoryData);
      await product.save();
      console.log(`[*] Updated Product: ${product.productName} (${product.productCode})`);
    }

    // Upsert Storefront Stock (for POS)
    await StorefrontInventory.findOneAndUpdate(
      {
        storefrontId: storefront._id,
        inventoryId: product._id,
        batchNumber: "__LEGACY__",
      },
      {
        storefrontId: storefront._id,
        inventoryId: product._id,
        batchNumber: "__LEGACY__",
        quantity: shopStock,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    // Upsert Warehouse Stock (for Warehouse & Transfer management)
    await WarehouseStock.findOneAndUpdate(
      {
        warehouseId: warehouse._id,
        inventoryId: product._id,
        batchNumber: "__LEGACY__",
      },
      {
        warehouseId: warehouse._id,
        inventoryId: product._id,
        batchNumber: "__LEGACY__",
        quantity: warehouseStock,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );
  }

  console.log("\n✅ Finished seeding sample cloth products and stock successfully!");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
