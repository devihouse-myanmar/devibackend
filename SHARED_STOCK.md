# Main Store stock for POS and E-commerce

Website and POS orders both use the active storefront configured by `MAIN_STOREFRONT_CODE`. Set it to the exact store code shown in **Inventory → Storefront**. The Devi House development Main Store uses `SF001`. Restart or redeploy the backend after changing this setting. Checkout and stock receipt require MongoDB transactions.

## Receive and publish products

1. Add the product in **Inventory**. Select **Transfer to Main Store**, choose the product and enter the physical quantity received at the shop. The dashboard opens the Main Store stock list after receipt.
2. From the **Main Store** stock list, an owner or admin selects in-stock variants and clicks **Publish to E-commerce**. The website shows published products while stock is available. Use **Unpublish** to remove a listing. POS also sells unpublished stock.
3. Use stock adjustment to add more units to an existing Main Store stock record. Repeating the initial transfer for an existing item leaves its quantity intact.

## Review legacy stock

Run the reconciliation report with a read-only MongoDB connection in `MONGODB_URI` and the intended Main Store code.

```sh
node src/scripts/reportSharedStock.js SF001 > shared-stock-review.json
```

Review each variant's stock, discounts and listing status alongside legacy orders awaiting fulfilment. Historical orders and cancellations use the stock location saved on the order. Reconcile physical counts before recording transfers from an old location.
