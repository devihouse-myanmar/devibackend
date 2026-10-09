# Devi House (OTAS POS) - Backend API Documentation

> **Base URL:** `http://localhost:5000/api/v1` (or your deployed server domain)  
> **Protocol:** HTTP / HTTPS  
> **Data Format:** JSON (`application/json`)  
> **Authentication:** Bearer JWT Token passed in `Authorization: Bearer <token>` header (except public endpoints).

---

## 📑 Table of Contents

1. [Authentication & User Management](#1-authentication--user-management)
2. [Master Inventory](#2-master-inventory)
3. [POS & Orders (Sales)](#3-pos--orders-sales)
4. [Credit Customer Profiles (Credit Persona)](#4-credit-customer-profiles-credit-persona)
5. [Credit Payment Records](#5-credit-payment-records)
6. [Storefront Profiles & Inventory](#6-storefront-profiles--inventory)
7. [Warehouse Profiles & Inventory](#7-warehouse-profiles--inventory)
8. [Location Profiles](#8-location-profiles)
9. [Stock Transfers](#9-stock-transfers)
10. [Supplier Profiles](#10-supplier-profiles)
11. [Purchasing & Purchase Orders](#11-purchasing--purchase-orders)
12. [Goods Received Note (GRN)](#12-goods-received-note-grn)
13. [Expense Management](#13-expense-management)
14. [Sales & Analytics Reports](#14-sales--analytics-reports)
15. [AI Sales Analytics](#15-ai-sales-analytics)
16. [AI Chat Assistant](#16-ai-chat-assistant)
17. [Daily Summary Reports](#17-daily-summary-reports)
18. [Stock Audit Logs](#18-stock-audit-logs)
19. [Shop Settings & Configuration](#19-shop-settings--configuration)

---

## 1. Authentication & User Management

**Base Path:** `/api/v1/admin`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/admin/login` | Public | Authenticate user with username/email & password. Returns JWT token and user info. |
| `POST` | `/admin/signup` | `owner`, `admin` | Register a new user/cashier account. |
| `GET` | `/admin` | `owner`, `admin` | Get all system users/accounts with pagination & filtering. |
| `GET` | `/admin/:accountId` | `owner`, `admin` | Retrieve account details by User ID. |
| `PATCH` | `/admin/:accountId` | `owner` | Update user details (name, username, role, etc.). |
| `PATCH` | `/admin/update-password/:accountId` | `owner` | Reset or update password for an account. |
| `PATCH` | `/admin/soft-delete/:accountId` | `owner` | Soft delete / deactivate user account. |
| `PATCH` | `/admin/restore/:accountId` | `owner` | Restore a soft-deleted user account. |
| `DELETE` | `/admin/:accountId` | `owner` | Permanently remove user account from database. |

---

## 2. Master Inventory

**Base Path:** `/api/v1/inventory`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/inventory` | `owner`, `admin` | Create a new master product in inventory catalog. |
| `GET` | `/inventory` | `owner`, `admin` | Get all master inventory items (supports `page`, `limit`, `category`, `status`, `search`, `supplierId`). |
| `GET` | `/inventory/categories` | `owner`, `admin`, `cashier` | Get list of all distinct product categories. |
| `GET` | `/inventory/:id` | `owner`, `admin` | Get master inventory item details by ID. |
| `PATCH` | `/inventory/:id` | `owner` | Update master inventory item details & prices. |
| `POST` | `/inventory/import-excel` | `owner`, `admin` | Bulk import products from Excel file (`.xlsx`, `.xls`, `.csv`). |
| `PATCH` | `/inventory/batch/expiry` | `owner`, `admin` | Update batch expiry dates for inventory items. |

---

## 3. POS & Orders (Sales)

**Base Path:** `/api/v1/order`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/order` | `owner`, `admin`, `cashier` | Create sale order, process payment (Cash, Mobile Pay, Credit, FOC), and deduct storefront stock. |
| `GET` | `/order` | `owner`, `admin`, `cashier` | Get paginated list of all sales orders with filters (date range, storefront, status, payment method). |
| `GET` | `/order/:orderId` | `owner`, `admin`, `cashier` | Get complete order invoice and receipt breakdown by Order ID. |
| `GET` | `/order/storefront/:storefrontId` | `owner`, `admin`, `cashier` | Get sales orders filtered by specific Storefront location. |
| `PATCH` | `/order/:orderId/credit-person` | `owner`, `admin`, `cashier` | Attach or update Credit Customer on a credit order. |
| `PATCH` | `/order/:orderId/paid-amount` | `owner` | Manually update paid amount on an existing order. |
| `PATCH` | `/order/:orderId/items/add` | `owner`, `admin`, `cashier` | Append additional product items to an existing order. |
| `PATCH` | `/order/:orderId/items/remove` | `owner`, `admin`, `cashier` | Remove product items from an existing order and refund stock. |
| `DELETE` | `/order/:orderId` | `owner` | Hard delete an order record from database. |

---

## 4. Credit Customer Profiles (Credit Persona)

**Base Path:** `/api/v1/credit-persona`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/credit-persona` | `owner`, `admin`, `cashier` | Register a new credit customer (name, phone, address, credit limit). |
| `GET` | `/credit-persona` | `owner`, `admin`, `cashier` | Get list of all credit customers with debt & balance status. |
| `GET` | `/credit-persona/:id` | `owner`, `admin`, `cashier` | Get single credit customer profile and account history. |
| `PATCH` | `/credit-persona/:id` | `owner` | Update customer details or blacklist status. |

---

## 5. Credit Payment Records

**Base Path:** `/api/v1/credit-record`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/credit-record` | `owner`, `admin`, `cashier` | Record debt payment / installment from a credit customer. |
| `GET` | `/credit-record` | `owner`, `admin`, `cashier` | Get all credit payment transaction history. |
| `GET` | `/credit-record/:id` | `owner`, `admin`, `cashier` | Get single credit payment record by ID. |
| `GET` | `/order/:orderId/credit-records` | `owner`, `admin`, `cashier` | Get all credit payment records made against a specific Order ID. |
| `GET` | `/credit-persona/:creditPersonId/credit-records` | `owner`, `admin`, `cashier` | Get all payment records for a specific Credit Customer. |
| `DELETE` | `/credit-record/:id` | `owner` | Permanently delete a credit payment transaction. |

---

## 6. Storefront Profiles & Inventory

**Base Path:** `/api/v1/storefront-profile` & `/api/v1/storefront-inventory`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/storefront-profile` | `owner`, `admin` | Create a new storefront shop location. |
| `GET` | `/storefront-profile` | `owner`, `admin`, `cashier` | List all storefront shop locations. |
| `GET` | `/storefront-profile/:id` | `owner`, `admin`, `cashier` | Get storefront profile by ID. |
| `PATCH` | `/storefront-profile/:id` | `owner` | Update storefront profile info. |
| `POST` | `/storefront-inventory` | `owner`, `admin` | Create or initialize stock item in storefront. |
| `GET` | `/storefront-inventory` | `owner`, `admin`, `cashier` | Get storefront stock list with quantities, low stock alerts, and search. |
| `GET` | `/storefront-inventory/:storefrontId/expiring-stock` | `owner`, `admin`, `cashier` | Check expiring batches for a storefront. |
| `GET` | `/storefront-inventory/:id` | `owner`, `admin`, `cashier` | Get storefront stock item by ID. |
| `PATCH` | `/storefront-inventory/:id/quantity` | `owner` | Manually adjust storefront stock quantity. |

---

## 7. Warehouse Profiles & Inventory

**Base Path:** `/api/v1/warehouse-profile` & `/api/v1/warehouse`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/warehouse-profile` | `owner`, `admin` | Create a new warehouse location profile. |
| `GET` | `/warehouse-profile` | `owner`, `admin`, `cashier` | List all warehouse locations. |
| `GET` | `/warehouse-profile/:id` | `owner`, `admin`, `cashier` | Get warehouse profile details by ID. |
| `PATCH` | `/warehouse-profile/:id` | `owner` | Update warehouse location details. |
| `POST` | `/warehouse` | `owner`, `admin` | Create or initialize warehouse stock item. |
| `GET` | `/warehouse` | `owner`, `admin`, `cashier` | Get list of stock in warehouse(s) with quantity & filters. |
| `GET` | `/warehouse/:warehouseId/expiring-stock` | `owner`, `admin`, `cashier` | Get expiring stock items in a specific warehouse. |
| `GET` | `/warehouse/:id` | `owner`, `admin`, `cashier` | Get single warehouse stock record by ID. |
| `PATCH` | `/warehouse/:id/quantity` | `owner` | Manually adjust warehouse stock quantity. |

---

## 8. Location Profiles

**Base Path:** `/api/v1/location-profile`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/location-profile` | `owner`, `admin`, `cashier` | Get unified list of all locations (both Warehouses & Storefronts). |
| `GET` | `/location-profile/:id` | `owner`, `admin`, `cashier` | Get single location profile by ID. |

---

## 9. Stock Transfers

**Base Path:** `/api/v1/transfer`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/transfer` | `owner`, `admin` | Create stock transfer request (e.g. Warehouse $\rightarrow$ Storefront). |
| `GET` | `/transfer` | `owner`, `admin` | List stock transfers with status (`pending`, `completed`, `cancelled`). |
| `GET` | `/transfer/:id` | `owner`, `admin` | Get transfer request details and line items. |
| `PATCH` | `/transfer/:id` | `owner` | Update transfer status (approve, receive stock, or cancel). |

---

## 10. Supplier Profiles

**Base Path:** `/api/v1/supplier-profile`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/supplier-profile` | `owner`, `admin` | Create a new vendor/supplier profile. |
| `GET` | `/supplier-profile` | `owner`, `admin` | List all suppliers with contact info and payment terms. |
| `GET` | `/supplier-profile/:id` | `owner`, `admin` | Get supplier profile details by ID. |
| `PATCH` | `/supplier-profile/:id` | `owner` | Update supplier profile. |
| `PATCH` | `/supplier-profile/:id/soft-delete` | `owner` | Soft delete supplier profile. |
| `PATCH` | `/supplier-profile/:id/restore` | `owner` | Restore soft-deleted supplier. |
| `DELETE` | `/supplier-profile/:id` | `owner` | Permanently delete supplier profile. |

---

## 11. Purchasing & Purchase Orders

**Base Path:** `/api/v1/purchase`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/purchase` | `owner`, `admin` | Create purchase order (PO) for suppliers. |
| `GET` | `/purchase` | `owner`, `admin` | List purchase orders with status, supplier, and date filtering. |
| `GET` | `/purchase/report` | `owner`, `admin` | Get purchase financial reports & outstanding payables summary. |
| `GET` | `/purchase/:id` | `owner`, `admin` | Get purchase order details and product line items by ID. |
| `PATCH` | `/purchase/:id/status` | `owner`, `admin` | Update PO status (`pending`, `received`, `cancelled`, etc.). |
| `POST` | `/purchase/:id/payments` | `owner`, `admin` | Record payment made to supplier against purchase order. |
| `GET` | `/purchase/:id/payments` | `owner`, `admin` | Get payment history for a purchase order. |
| `PATCH` | `/purchase/:id/due-date` | `owner`, `admin` | Update payment due date for purchase order. |
| `PATCH` | `/purchase/:id/soft-delete` | `owner` | Soft delete purchase order. |
| `PATCH` | `/purchase/:id/restore` | `owner` | Restore soft-deleted purchase order. |

---

## 12. Goods Received Note (GRN)

**Base Path:** `/api/v1/grn`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/grn` | `owner`, `admin` | Create GRN when physical items arrive at warehouse and update stock. |
| `GET` | `/grn` | `owner`, `admin` | List all Goods Received Notes. |
| `GET` | `/grn/:id` | `owner`, `admin` | Get GRN details, received quantities, and batch numbers. |
| `PATCH` | `/grn/:id/status` | `owner`, `admin` | Update GRN status (`draft`, `verified`, `completed`). |
| `PATCH` | `/grn/:id/line-items` | `owner`, `admin` | Update received items and quantities in GRN. |

---

## 13. Expense Management

**Base Path:** `/api/v1/expense`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/expense` | `cashier`, `admin`, `owner` | Log business operating expense (rent, utilities, salaries, etc.). |
| `GET` | `/expense` | `cashier`, `admin`, `owner` | Get list of expenses with category & date filtering. |
| `GET` | `/expense/:id` | `cashier`, `admin`, `owner` | Get single expense record by ID. |
| `PATCH` | `/expense/:id` | `owner` | Update expense record details. |
| `PATCH` | `/expense/:id/soft-delete` | `owner` | Soft delete expense record. |
| `PATCH` | `/expense/:id/restore` | `owner` | Restore soft-deleted expense record. |
| `DELETE` | `/expense/:id` | `owner` | Permanently delete expense record. |

---

## 14. Sales & Analytics Reports

**Base Path:** `/api/v1/sale-report`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/sale-report` | `owner`, `admin`, `cashier` | Comprehensive sales report (revenue, profit, discounts, orders). |
| `GET` | `/sale-report/paid-orders` | `owner`, `admin`, `cashier` | Payment method breakdown (Cash, KBZPay, WavePay, Bank Transfer, etc.). |
| `GET` | `/sale-report/credit-orders` | `owner`, `admin`, `cashier` | Credit sales and debt collection status report. |
| `GET` | `/sale-report/products` | `owner`, `admin`, `cashier` | Best selling & quantity sold statistics per product. |
| `GET` | `/sale-report/credit-persona-products` | `owner`, `admin`, `cashier` | Report of products purchased on credit by customers. |
| `GET` | `/sale-report/products-by-credit-person` | `owner`, `admin`, `cashier` | Analytics showing which credit customers bought which products. |

---

## 15. AI Sales Analytics

**Base Path:** `/api/v1/ai-sale-report`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/ai-sale-report/summary` | `owner`, `admin`, `cashier` | AI summarized revenue, top metrics, and performance insights. |
| `GET` | `/ai-sale-report/payment-methods` | `owner`, `admin`, `cashier` | AI breakdown analysis of payment channels and volume. |
| `GET` | `/ai-sale-report/credit-sales` | `owner`, `admin`, `cashier` | AI analysis on credit exposure, risk, and repayment trends. |
| `GET` | `/ai-sale-report/products/top` | `owner`, `admin`, `cashier` | Top products performance ranking and sales velocity. |
| `GET` | `/ai-sale-report/credit-persona-products` | `owner`, `admin`, `cashier` | AI analysis of credit buyer purchasing patterns. |
| `GET` | `/ai-sale-report/products-by-credit-person`| `owner`, `admin`, `cashier` | Deep dive into credit customer product preferences. |

---

## 16. AI Chat Assistant

**Base Path:** `/api/v1/sale-report/ai-chat`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/sale-report/ai-chat` | `owner`, `admin`, `cashier` | Ask natural language questions about sales, revenue, products, and inventory. |
| `GET` | `/sale-report/ai-chat/history` | `owner`, `admin`, `cashier` | Retrieve past AI assistant chat messages. |

---

## 17. Daily Summary Reports

**Base Path:** `/api/v1/daily-reports`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/daily-reports` | `owner`, `admin`, `cashier` | Get paginated list of automated daily sales & closing reports generated by cron. |
| `GET` | `/daily-reports/latest` | `owner`, `admin`, `cashier` | Get the most recent daily summary snapshot. |

---

## 18. Stock Audit Logs

**Base Path:** `/api/v1/stock-audit-logs`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/stock-audit-logs` | `owner`, `admin`, `cashier` | Get stock movement audit trail (sales deductions, transfers, manual adjustments). |
| `GET` | `/stock-audit-logs/:id` | `owner`, `admin`, `cashier` | Get specific audit log entry by ID. |

---

## 19. Shop Settings & Configuration

**Base Path:** `/api/v1/shop-settings`

| Method | Endpoint | Access / Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/shop-settings` | Public | Get active shop profile, currency, contact info, receipt header/footer settings. |
| `POST` | `/shop-settings` | `owner`, `admin` | Create or update shop profile and configuration. |
| `POST` | `/shop-settings/logo` | `owner`, `admin` | Upload shop logo image for receipt and invoice printing. |
| `DELETE` | `/shop-settings/logo` | `owner`, `admin` | Remove current shop logo. |
| `GET` | `/shop-settings/history` | `owner`, `admin` | View history of changes to shop settings. |
| `PUT` | `/shop-settings/cron-time` | `owner`, `admin` | Update the daily automated report cron trigger time. |

---

## 🛡️ Role-Based Access Control (RBAC) Summary

- **`Public`**: No token required (e.g. Login, Fetching public Shop Info).
- **`cashier`**: Can create orders, take payments, record expenses, view products, search customers, and view sales reports.
- **`admin`**: Full access to operational modules (Stock adjustments, Transfers, Purchases, GRN, Reports, Account viewing).
- **`owner`**: Full unrestricted administrative access (User role modification, Password reset, Hard delete, Manual override, Settings update).
