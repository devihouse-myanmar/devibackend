import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import mongoose from "mongoose";
import dotenv from "dotenv";
import DeliveryTownship from "../models/deliveryTownship.model.js";

dotenv.config();

const yangonTownships = [
  "ကမာရွတ်",
  "ကြည့်မြင်တိုင်",
  "ကျောက်တံတား",
  "ကျောက်တန်း",
  "ကော့မှူး",
  "ကွမ်းခြံကုန်း",
  "ခရမ်း",
  "ဆိပ်ကမ်း",
  "ဆိပ်ကြီးခနောင်တို",
  "စမ်းချောင်း",
  "ဒဂုံ",
  "ဒဂုံမြို့သစ် (တောင်ပိုင်း)",
  "ဒဂုံမြို့သစ် (မြောက်ပိုင်း)",
  "ဒဂုံမြို့သစ် (အရှေ့ပိုင်း)",
  "ဒဂုံမြို့သစ် (ဆိပ်ကမ်း)",
  "ဒလ",
  "ဒေါပုံ",
  "တာမွေ",
  "တိုက်ကြီး",
  "တောင်ဥက္ကလာပ",
  "တွံတေး",
  "ထန်းတပင်",
  "သာကေတ",
  "သန်လျင်",
  "သင်္ဃန်းကျွန်း",
  "သုံးခွ",
  "ပုဇွန်တောင်",
  "ပန်းဘဲတန်း",
  "ဗိုလ်တထောင်",
  "ဗဟန်း",
  "မင်္ဂလာတောင်ညွန့်",
  "မင်္ဂလာဒုံ",
  "မရမ်းကုန်း",
  "မှော်ဘီ",
  "မြောက်ဥက္ကလာပ",
  "ရန်ကင်း",
  "ရွှေပြည်သာ",
  "လမ်းမတော်",
  "လသာ",
  "လှိုင်",
  "လှိုင်သာယာ",
  "လှည်းကူး",
  "အလုံ",
  "အင်းစိန်",
];

export async function seedDeliveryTownships() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set in environment");
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  console.log(`Starting idempotent seed of ${yangonTownships.length} townships...`);
  let insertedCount = 0;
  let existingCount = 0;

  for (let i = 0; i < yangonTownships.length; i++) {
    const t = yangonTownships[i];
    const res = await DeliveryTownship.updateOne(
      { township: t },
      {
        $setOnInsert: {
          township: t,
          city: "Yangon",
          fee: null,
          isActive: true,
          sortOrder: i,
        },
      },
      { upsert: true }
    );

    if (res.upsertedCount > 0) {
      insertedCount++;
    } else {
      existingCount++;
    }
  }

  console.log(`Seed completed: ${insertedCount} inserted, ${existingCount} already existed.`);
  return { insertedCount, existingCount, total: yangonTownships.length };
}

if (process.argv[1] && process.argv[1].endsWith("seedDeliveryTownships.js")) {
  seedDeliveryTownships()
    .then(() => {
      console.log("Township seed finished successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Township seed failed:", err);
      process.exit(1);
    });
}
