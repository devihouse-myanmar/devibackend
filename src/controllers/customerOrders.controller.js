import Order from '../models/orders.model.js';
import CustomError from '../utils/customError.js';

const ownerFilter = (req) => ({
  customerId: req.customerAuth.customer._id, orderSource: 'ecommerce', isDeleted: false,
});
const fields = 'orderNumber createdAt orderStatus finalAmount ordersProducts.quantity ordersProducts.unitPrice ordersProducts.inventoryId';
const withProducts = (query) => query.select(fields).populate('ordersProducts.inventoryId', 'productName').lean();

function orderSummary(order) {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    status: order.orderStatus,
    total: order.finalAmount,
    items: order.ordersProducts.map(({ inventoryId, quantity, unitPrice }) => ({
      productName: inventoryId?.productName || null, quantity, unitPrice,
    })),
  };
}

export async function listCustomerOrders(req, res) {
  const rawPage = req.query.page ?? '1';
  if (typeof rawPage !== 'string' || !/^[1-9]\d{0,3}$/.test(rawPage)) {
    throw new CustomError(400, 'Invalid page.');
  }
  const page = Number(rawPage);
  const pageSize = 12;
  const orders = await withProducts(Order.find(ownerFilter(req)))
    .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize + 1);
  res.json({ orders: orders.slice(0, pageSize).map(orderSummary), page, hasMore: orders.length > pageSize });
}

export async function getCustomerOrder(req, res) {
  const orderNumber = req.params.orderNumber.trim().toUpperCase();
  const order = await withProducts(Order.findOne({ ...ownerFilter(req), orderNumber }));
  if (!order) throw new CustomError(404, 'Order not found.', 'CUSTOMER_ORDER_NOT_FOUND');
  res.json({ order: orderSummary(order) });
}
