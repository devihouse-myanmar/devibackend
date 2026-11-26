# Inventory → Main Store → E-commerce

**ရက်စွဲ** 2026-11-26  
**အခြေအနေ** Implemented. Dashboard၊ website နဲ့ backend ကို ဆက်ပြင်မယ့် developer တွေအတွက် မှတ်တမ်း။

## လက်ရှိ flow

1. **Dashboard → Inventory → Add New Product** မှာ product variant ဖန်တီးပါ။
2. **Transfer to Main Store** နှိပ်၊ product ရွေးပြီး **Enter quantities** မှာ Main Store က လက်ခံရရှိတဲ့ အရေအတွက်ကို ထည့်ပါ။ Transfer အောင်မြင်ရင် dashboard က Main Store stock list ကို ဖွင့်ပေးပါတယ်။
3. **Main Store** stock list မှာ လက်ကျန်ရှိတဲ့ variant တွေကို ရွေးပြီး **Publish to E-commerce** နှိပ်ပါ။ Owner နဲ့ admin က **Unpublish** ကိုလည်း ဒီစာရင်းကနေ လုပ်နိုင်ပါတယ်။
4. Website မှာ active ဖြစ်ပြီး publish လုပ်ထားတဲ့ Main Store variants တွေကို လက်ကျန်အလိုက် ပြပါတယ်။ Website order နဲ့ Checkout (POS) order နှစ်ခုစလုံးက Main Store လက်ကျန်ထဲက ဖြတ်ပါတယ်။ POS က publish မလုပ်ရသေးတဲ့ Main Store stock ကိုလည်း ရောင်းနိုင်ပါတယ်။

Inventory က **Manage E-commerce** action ကို Main Store စာရင်းဆီ ရွှေ့ထားပါတယ်။ Initial stock receipt ကို Inventory ကနေ တိုက်ရိုက်လုပ်ပါတယ်။ Dashboard ရဲ့ `/purchasing` က Suppliers hub ဆီ redirect လုပ်ပြီး Supplier Detail မှာ **New Purchase Order** action ကို ဖျောက်ထားပါတယ်။

## Stock နဲ့ listing စည်းမျဉ်း

| Model / setting | အသုံးပြုပုံ |
| --- | --- |
| `Inventory` | Product variant ရဲ့ master record။ `ecommercePublished` က website listing ကို ထိန်းပြီး အသစ်ထည့်တဲ့ variant မှာ `false` ဖြစ်ပါတယ်။ |
| `LocationProfile` | `MAIN_STOREFRONT_CODE` နဲ့ အတိအကျ ကိုက်ညီတဲ့ active storefront ကို backend က Main Store အဖြစ် ရွေးပါတယ်။ |
| `StorefrontInventory` | `storefrontId + inventoryId` တစ်စုံလျှင် stock row တစ်ခုရှိပြီး `quantity` က shared stock ဖြစ်ပါတယ်။ |
| `Order` | POS နဲ့ website order အသစ်တွေက stock ဖြတ်ခဲ့တဲ့ `storefrontId` ကို သိမ်းပါတယ်။ Online order cancel လုပ်တဲ့အခါ order ထဲမှာ သိမ်းထားတဲ့ location ဆီ stock ပြန်ထည့်ပါတယ်။ |

- **Transfer to Main Store** က product အသစ်ရဲ့ initial stock ကို လက်ခံမှတ်တမ်းတင်တာပါ။ ရှိပြီးသား Main Store row ကို `alreadyInStore` အဖြစ် ကျော်ပါတယ်။ ထပ်ရောက်လာတဲ့ ပစ္စည်းအတွက် Main Store ရဲ့ **Increase Stock** action ကို သုံးပါ။ Warehouse စာရင်းထဲက stock ကို ရွှေ့ရမယ်ဆိုရင် source location ကနေ လက်ရှိ **stock transfer** flow ကို သုံးပါ။
- Initial receipt နဲ့ stock audit log ကို transaction တစ်ခုထဲ ရေးပါတယ်။ Publish/Unpublish က `ecommercePublished` flag တစ်ခုပဲ ရေးပါတယ်။ Publish လုပ်ဖို့ active variant နဲ့ အပေါင်းလက်ကျန်ရှိတဲ့ Main Store row လိုပါတယ်။ Main Store row ရှိရင် လက်ကျန် ၀ ဖြစ်ချိန်မှာလည်း Unpublish လုပ်နိုင်ပါတယ်။
- Checkout မှာ server က လက်ရှိ price နဲ့ stock ကို စစ်ပြီး order save တာနဲ့ stock ဖြတ်တာကို transaction တစ်ခုထဲ လုပ်ပါတယ်။ `quantity >= requested quantity` စစ်ပြီးမှ ဖြတ်တာမို့ website နဲ့ POS က နောက်ဆုံးတစ်ခုကို တစ်ပြိုင်တည်း ဝယ်ရင် တစ်ခုသာ အောင်မြင်ပါတယ်။

## API များ

အောက်ပါ routes တွေက `/api/v1` အောက်မှာ ရှိပါတယ်။

| Endpoint | Access | လုပ်ဆောင်ချက် |
| --- | --- | --- |
| `POST /inventory` | Owner, admin, cashier, warehouse | Product variant ဖန်တီး။ |
| `GET /storefront-profile` | Staff | `sharedStock.mainStorefront` ကနေ Main Store ID နဲ့ profile ယူ။ |
| `POST /storefront-inventory/main-store/receive` | Owner, admin, warehouse | Initial stock လက်ခံ။ Response data မှာ `received` နဲ့ `alreadyInStore` ပါ။ |
| `GET /storefront-inventory?storefrontId=<id>` | Staff | Main Store stock နဲ့ variant ရဲ့ publication flag ဖတ်။ |
| `PATCH /storefront-inventory/:id/quantity` | Owner, warehouse | ရှိပြီးသား stock အရေအတွက် ချိန်ညှိ။ |
| `PATCH /inventory/ecommerce-publication` | Owner, admin | ရွေးထားတဲ့ variants တွေကို Publish/Unpublish လုပ်။ |
| `GET /ecommerce/products?groupBy=design` နှင့် `GET /ecommerce/products/:id` | Public | Published Main Store catalog နဲ့ product detail ဖတ်။ Catalog က ပုံမှန်အားဖြင့် လက်ကျန်ရှိတဲ့ variants တွေပဲ ပြန်ပေးပါတယ်။ |
| `POST /ecommerce/orders` | Guest သို့မဟုတ် customer account | Website order တင်ပြီး Main Store stock ဖြတ်။ |
| `POST /order` | Owner, admin, cashier | POS order တင်။ POS request ရဲ့ `storefrontId` က Main Store ID ဖြစ်ရပါမယ်။ |
| `PATCH /order/:orderId/status` | Owner, admin, cashier | Online order status ပြောင်း။ Cancel ဖြစ်ရင် မူလ stock location ဆီ ပြန်ထည့်။ |

**Initial receipt request body** တွင် active variants ၁ ခုမှ ၁၀၀ အထိ လက်ခံပြီး quantity က အပေါင်းကိန်းပြည့် ဖြစ်ရပါမယ်။ ဥပမာ IDs ကို ကိုယ့် database ထဲက IDs နဲ့ အစားထိုးပါ။

```json
{
  "storefrontId": "111111111111111111111111",
  "items": [{ "inventoryId": "222222222222222222222222", "quantity": 10 }]
}
```

**Publication request body** တွင် variant IDs ၁ ခုမှ ၁၀၀ အထိ လက်ခံပါတယ်။ Unpublish အတွက် `published: false` ပို့ပါ။

```json
{
  "storefrontId": "111111111111111111111111",
  "inventoryIds": ["222222222222222222222222"],
  "published": true
}
```

### Online Home Sections

**New Section → Picked designs** က `GET /home-sections/designs?page=1&search=` နဲ့ Main Store designs ယူပါတယ်။ Owner နဲ့ admin အတွက် တစ်မျက်နှာ ၃ ခုစီ ပြပြီး unpublished နဲ့ လက်ကျန် ၀ ဖြစ်တဲ့ design ကိုလည်း ကြိုရွေးသိမ်းနိုင်ပါတယ်။ Design တွေကို `Inventory.category` အလိုက် စုထားပါတယ်။ Manual section ရဲ့ public output နဲ့ preview က publish လုပ်ပြီး လက်ကျန်ရှိတဲ့ design တွေကို ရွေးထားတဲ့အစီအစဉ်အတိုင်း ပြပါတယ်။

## ပြင်ဖို့ အဓိက code နေရာများ

- **Backend** Main Store lookup နဲ့ stock deduction အတွက် [sharedStock.service.js](../src/services/sharedStock.service.js)၊ order transaction အတွက် [ecommerceOrderStock.service.js](../src/services/ecommerceOrderStock.service.js) နဲ့ [order.controller.js](../src/controllers/order.controller.js)။
- **Backend** Initial receipt အတွက် [storefrontInventory.controller.js](../src/controllers/storefrontInventory.controller.js)၊ publication အတွက် [inventory.controller.js](../src/controllers/inventory.controller.js)၊ website catalog အတွက် [ecommerce.controller.js](../src/controllers/ecommerce.controller.js) နဲ့ [ecommerceCatalog.service.js](../src/services/ecommerceCatalog.service.js)။
- **Backend** Home Section picker နဲ့ public section resolution အတွက် [homeSection.controller.js](../src/controllers/homeSection.controller.js)။
- **Dashboard** `devidashboard/pages/Inventory.tsx` မှာ initial receipt UI၊ `devidashboard/pages/StorefrontDetail.tsx` မှာ publish/unpublish UI၊ `devidashboard/pages/POS.tsx` မှာ Main Store stock သုံးပါတယ်။
- **Website** `deviPortfolio/src/pages/Products.jsx` နဲ့ `deviPortfolio/src/services/ecommerceApi.js` မှာ catalog သုံးပြီး `deviPortfolio/src/pages/Checkout.jsx` က order တင်ပါတယ်။

## Setup နဲ့ စစ်ဆေးရန်

1. Backend ရဲ့ environment မှာ active Main Store code ကို သတ်မှတ်ပြီး backend ကို restart လုပ်ပါ။ Local development မှာ `MAIN_STOREFRONT_CODE=SF001` ဖြစ်ပါတယ်။ Code မှားရင် သို့မဟုတ် active Main Store ရှာမတွေ့ရင် API က `503 MAIN_STOREFRONT_UNAVAILABLE` ပြန်ပေးပါတယ်။ Receipt၊ publication နဲ့ checkout transactions အတွက် MongoDB replica set သို့မဟုတ် sharded cluster လိုပါတယ်။
2. Test database မှာ product အသစ်ကို stock ၁၀ ခုနဲ့ transfer လုပ်ပြီး request ထပ်ပို့ပါ။ ဒုတိယ request က `alreadyInStore` ပြန်ပြီး လက်ကျန် ၁၀ ဖြစ်ရပါမယ်။ Publish ပြီးရင် website catalog မှာ ပေါ်ရပါမယ်။
3. Website မှာ ၃ ခု၊ POS မှာ ၂ ခု ဝယ်ပြီး Main Store မှာ ၅ ခု ကျန်တာ စစ်ပါ။ နောက်ဆုံးတစ်ခုအတွက် checkout နှစ်ခု တစ်ပြိုင်တည်း စမ်းပါ။ မလုံလောက်ရင် `409 INSUFFICIENT_STOCK` ပြန်ရပါမယ်။ Online order cancel ပြီးရင် အဲဒီ order ရဲ့ location ဆီ stock ပြန်ဝင်တာ စစ်ပါ။
4. Unpublish လုပ်ပြီး catalog ကနေ ပျောက်တာနဲ့ POS မှာ ဆက်ရောင်းလို့ရတာ စစ်ပါ။ Website မှာ item ရှာမတွေ့ရင် Main Store profile၊ variant active status၊ publication flag နဲ့ quantity ကို အစဉ်လိုက် စစ်ပါ။

Legacy `SF-ECOMMERCE` stock နဲ့ order ဟောင်းတွေကို စစ်ဖို့ read-only reconciliation report သုံးနိုင်ပါတယ်။ Physical count ကို စစ်ပြီးမှ stock transfer သွင်းပါ။ [SHARED_STOCK.md](../SHARED_STOCK.md)
