import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// 13 Designs provided by the client
const DESIGNS = [
  { id: 1, name: "ရွှေမီးအိမ်", code: "SME", desc: "ရွှေမီးအိမ်ပုံစံ လက်ရာမြောက် ရိုးရာပိုးချိတ်အဆင်" },
  { id: 2, name: "ဂန္ဓမာ", code: "GDM", desc: "ဂန္ဓမာပန်းပွင့်ပုံစံ နန်းဆန်သော ပိုးထည်ဒီဇိုင်း" },
  { id: 3, name: "ခရုပတ်", code: "KRP", desc: "ခရုပတ်ရစ်လိမ် အနုစိပ် လက်ယက်ပိုးချည်ထည်" },
  { id: 4, name: "ပန်းကနုတ်", code: "PKN", desc: "မြန်မာမှု ပန်းကနုတ်အဆင် အဆင့်မြင့်ပိုးစစ်စစ်" },
  { id: 5, name: "ထက်ထက်နှင်းဆီ", code: "HHN", desc: "ထက်ထက်နှင်းဆီ အထူးဒီဇိုင်း သဘာဝပိုးထည်" },
  { id: 6, name: "နှင်းဆီတန်း", code: "HST", desc: "နှင်းဆီတန်းစီ ချိတ်အဆင် ပိုးလုံချည်/ဝမ်းဆက်" },
  { id: 7, name: "နှင်းဆီဖူး", code: "HSP", desc: "နှင်းဆီဖူးပုံဖော် ရိုးရာရက်ကန်း ပိုးစစ်ထည်" },
  { id: 8, name: "ပန်းလိပ်ပြာ", code: "PLP", desc: "ပန်းလိပ်ပြာ လှပစွာ ပျံဝဲဟန် ချည်ပိုးအဆင်" },
  { id: 9, name: "နန်းသဇင်", code: "NTZ", desc: "နန်းသဇင်ခွေ နန်းတွင်းရိုးရာ မင်္ဂလာပိုးထည်" },
  { id: 10, name: "အနွယ်တော်", code: "ANT", desc: "အနွယ်တော် ရွှေချည်ထိုး အနုစိပ်ဒီဇိုင်းသစ်" },
  { id: 11, name: "နန်းသရဖူ", code: "NTP", desc: "နန်းသရဖူ ပုံဖော် ခန့်ညားထည်ဝါသော ပိုးထည်" },
  { id: 12, name: "ပန်းစကြာ", code: "PSK", desc: "ပန်းစကြာအလှဆင် ရိုးရာရက်ကန်းလက်ရာစစ်စစ်" },
  { id: 13, name: "ရွှေခြင်းလုံး", code: "SCL", desc: "ရွှေခြင်းလုံးပုံစံ အဆင်ဆန်း ပိုးဝမ်းဆက်ထည်" },
];

// 18 Colors provided by the client
const COLORS = [
  { name: "အစိမ်းရင့်", hex: "#1B4D24", code: "DGR" },
  { name: "အစိမ်းနု", hex: "#7EAA42", code: "LGR" },
  { name: "မြက်ခြောက်စိမ်း", hex: "#6D7C36", code: "OLV" },
  { name: "အစိမ်းပြာ", hex: "#167B78", code: "TEA" },
  { name: "နီညို", hex: "#6C262C", code: "MRN" },
  { name: "သျှား", hex: "#843C28", code: "CUT" },
  { name: "ပန်းရောင်", hex: "#D86382", code: "PNK" },
  { name: "ပန်းဆီရောင်", hex: "#C43E5E", code: "RSE" },
  { name: "ခရမ်း", hex: "#5C386E", code: "PUR" },
  { name: "ပန်းခရမ်းဆီ", hex: "#882A6E", code: "MAG" },
  { name: "နက်ပြာ", hex: "#121F36", code: "NVY" },
  { name: "ဘဲခေါင်းစိမ်း", hex: "#0E5142", code: "MAL" },
  { name: "မျှင်", hex: "#E2DDD0", code: "CRM" },
  { name: "ကောင်းကင်ပြာ", hex: "#4A92DE", code: "SKY" },
  { name: "အဝါ", hex: "#E8AE18", code: "YEL" },
  { name: "ရေညှိ", hex: "#4C5D24", code: "MOS" },
  { name: "အပြာရင့်", hex: "#14366A", code: "RBL" },
  { name: "ပိတောက်ခြောက်", hex: "#BA8323", code: "PAD" },
];

// High quality silk textiles photos from Unsplash
const FABRIC_IMAGES = [
  "https://images.unsplash.com/photo-1583292650898-7d22cd27ca6f?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1594938298603-c8148c4b4545?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1610189844649-58a7d45d2a9b?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1520367445093-50dc08a59d9d?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1551803091-e20673f15770?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1542295669297-4d352b042bca?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1617297621877-e6cc8d4d7dbd?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1536766768598-e09213fdcf22?w=800&q=85&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1588117260148-b47818741c74?w=800&q=85&fit=crop&auto=format",
];

const SIZES = [
  {
    key: "3m",
    name: "၃ မီတာ",
    label: "ဝမ်းဆက်ကွင်း",
    subCategory: "ဝမ်းဆက်ကွင်း",
    buyingPrice: 95000,
    sellingPrice: 159000,
    discountAmount: 24000, // 159,000 - 24,000 = 135,000 MMK (15% promo)
    wholesalePrices: [
      { quantity: 5, price: 145000 },
      { quantity: 10, price: 138000 },
    ],
  },
  {
    key: "2m",
    name: "၂ မီတာ",
    label: "ထမိန်ကွင်း",
    subCategory: "ထမိန်ကွင်း",
    buyingPrice: 65000,
    sellingPrice: 106000,
    discountAmount: 16000, // 106,000 - 16,000 = 90,000 MMK (15.09% promo)
    wholesalePrices: [
      { quantity: 5, price: 98000 },
      { quantity: 10, price: 92000 },
    ],
  },
];

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected successfully!");

  const db = mongoose.connection.db;

  // 1. Fetch locations
  const locations = await db.collection("locationprofiles").find({}).toArray();
  const ecommerceStore = locations.find((l) => l.locationCode === "SF-ECOMMERCE" || l.isEcommerceDefault);
  const mainStore = locations.find((l) => l.locationCode === "SF-001");
  const warehouse = locations.find((l) => l.type === "warehouse");
  const supplier = await db.collection("supplierprofiles").findOne({});

  if (!ecommerceStore) throw new Error("SF-ECOMMERCE location not found!");
  console.log("Ecommerce Store ID:", ecommerceStore._id);
  console.log("Main Store ID:", mainStore ? mainStore._id : "N/A");
  console.log("Warehouse ID:", warehouse ? warehouse._id : "N/A");

  // 2. Delete existing products, inventories, and old test orders
  console.log("Deleting old products, stocks, and test orders...");
  const delInv = await db.collection("inventories").deleteMany({});
  const delSf = await db.collection("storefrontinventories").deleteMany({});
  const delWh = await db.collection("warehousestocks").deleteMany({});
  const delOrd = await db.collection("orders").deleteMany({});
  console.log(`Deleted: ${delInv.deletedCount} inventories, ${delSf.deletedCount} storefront stocks, ${delWh.deletedCount} warehouse stocks, ${delOrd.deletedCount} orders.`);

  // 3. Prepare new records
  const inventoryDocs = [];
  const storefrontDocs = [];
  const warehouseDocs = [];

  // Promotion dates: active now through end of Oct 2026 (client noted promo ends 26th)
  const promoStart = new Date("2026-10-01T00:00:00.000Z");
  const promoEnd = new Date("2026-10-27T23:59:59.999Z"); // Covers through 26th

  let barcodeCounter = 885200000001;

  for (let dIdx = 0; dIdx < DESIGNS.length; dIdx++) {
    const design = DESIGNS[dIdx];
    const designImg = FABRIC_IMAGES[dIdx % FABRIC_IMAGES.length];

    for (let sIdx = 0; sIdx < SIZES.length; sIdx++) {
      const size = SIZES[sIdx];

      for (let cIdx = 0; cIdx < COLORS.length; cIdx++) {
        const color = COLORS[cIdx];
        const invId = new mongoose.Types.ObjectId();

        const productCode = `DEV-${design.code}-${size.key.toUpperCase()}-${color.code}`;
        const saleCode = `S-${productCode}`;
        const sku = `SKU-${productCode}`;
        const barcode = String(barcodeCounter++);

        const productName = `${design.name} - ${color.name} (${size.name})`;
        const description = `${design.desc}။ ပိုးစစ်စစ်ဖြင့် ရက်လုပ်ထားသော ဒေဝီ ရိုးရာပိုးထည် [${design.name}] အဆင်။ အရောင်: ${color.name}၊ အတိုင်းအတာ: ${size.label} (${size.name})။`;

        const invDoc = {
          _id: invId,
          productName,
          productCode,
          saleCode,
          SKU: sku,
          barcode,
          category: design.name, // Category is design name for grouping
          subCategory: size.subCategory,
          brand: "Devi Silk",
          color: color.name,
          size: size.name,
          images: [
            {
              url: designImg,
              color: color.name,
              isPrimary: true,
            },
          ],
          description,
          buyingPrice: size.buyingPrice,
          sellingPrice: size.sellingPrice,
          wholesalePrices: size.wholesalePrices,
          unitOfMeasure: "ကွင်း",
          reorderPoint: 5,
          reorderQuantity: 20,
          taxRate: 0,
          status: "active",
          tags: [design.name, color.name, size.label, "ပိုးထည်", "သီတင်းကျွတ်ပရိုမိုးရှင်း"],
          note: `ဒီဇိုင်း: ${design.name} | အရောင်: ${color.name} | အရွယ်အစား: ${size.label}`,
          supplierIds: supplier ? [supplier._id] : [],
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inventoryDocs.push(invDoc);

        // Storefront Stock for SF-ECOMMERCE
        storefrontDocs.push({
          storefrontId: ecommerceStore._id,
          inventoryId: invId,
          quantity: 25, // In-stock for ecommerce
          isLowStock: false,
          lastUpdated: new Date(),
          discount: {
            type: "fixed",
            value: size.discountAmount, // 24,000 for 3m (135,000), 16,000 for 2m (90,000)
            startDate: promoStart,
            endDate: promoEnd,
            isActive: true,
            updatedBy: null,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Storefront Stock for Main Store (SF-001) if present
        if (mainStore) {
          storefrontDocs.push({
            storefrontId: mainStore._id,
            inventoryId: invId,
            quantity: 15,
            isLowStock: false,
            lastUpdated: new Date(),
            discount: {
              type: "fixed",
              value: 0,
              startDate: null,
              endDate: null,
              isActive: false,
              updatedBy: null,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Warehouse Stock for WH-001 if present
        if (warehouse) {
          warehouseDocs.push({
            warehouseId: warehouse._id,
            inventoryId: invId,
            quantity: 50,
            isLowStock: false,
            lastUpdated: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  console.log(`Inserting ${inventoryDocs.length} inventories...`);
  await db.collection("inventories").insertMany(inventoryDocs);

  console.log(`Inserting ${storefrontDocs.length} storefront inventory records...`);
  await db.collection("storefrontinventories").insertMany(storefrontDocs);

  if (warehouseDocs.length > 0) {
    console.log(`Inserting ${warehouseDocs.length} warehouse stock records...`);
    await db.collection("warehousestocks").insertMany(warehouseDocs);
  }

  console.log("=== Seed Completed Successfully! ===");
  console.log(`Total Designs: ${DESIGNS.length}`);
  console.log(`Total Variants: ${inventoryDocs.length}`);
  console.log(`3M Set Price: Original 159,000 MMK -> Promo 135,000 MMK`);
  console.log(`2M Htamein Price: Original 106,000 MMK -> Promo 90,000 MMK`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
