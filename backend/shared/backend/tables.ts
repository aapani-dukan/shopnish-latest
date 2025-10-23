// backend/src/shared/backend/tables.ts

import { pgTable, text, serial, integer, decimal, boolean, timestamp, json, numeric, pgEnum, unique, varchar} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm"; // यह ठीक है कि यहाँ सीधे उपयोग नहीं किया गया

// =========================================================================
// Enums - इन्हें हमेशा सबसे पहले रखें
// =========================================================================

export const masterOrderStatusEnum = pgEnum('master_order_status', [
  'pending', 'confirmed', 'partially_fulfilled', 'fulfilled', 'cancelled', 'failed'
]);
export const subOrderStatusEnum = pgEnum('sub_order_status', [
  'pending', 'accepted', 'preparing', 'ready_for_pickup', 'cancelled', 'rejected'
]);
export const orderItemStatusEnum = pgEnum("order_item_status_enum", [
  "pending", "processing", "shipped", "delivered", "cancelled", "returned"
]);
export const deliveryStatusEnum = pgEnum("delivery_status_enum", [
  "pending", "assigned", "out_for_pickup", "picked_up", "out_for_delivery", "delivered", "failed", "exepted", "cancelled"
]);
export const productCategoryEnum = pgEnum("product_category", [
  "Electronics", "Fashion", "Home & Kitchen", "Books", "Groceries", "Health & Beauty",
  "Sports & Outdoors", "Toys & Games", "Automotive", "Jewelry", "Pet Supplies", "Other"
]);
export const userRoleEnum = pgEnum("user_role", ["customer", "seller", "admin", "delivery-boy"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const paymentMethodEnum = pgEnum("payment_method", ["COD", "ONLINE"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed_amount']);
export const couponScopeEnum = pgEnum('coupon_scope', ['all_orders', 'specific_seller', 'specific_product', 'category']);

// =========================================================================
// Core Tables (सबसे कम निर्भरता से सबसे अधिक निर्भरता तक)
// =========================================================================

// 1. users - किसी को संदर्भित नहीं करता
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  role: userRoleEnum("role").notNull().default("customer"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("approved"),
  address: text("address"),
  city: text("city"),
  pincode: text("pincode"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  whatsappOptIn: boolean("whatsapp_opt_in").default(true),
  welcomeMessageSent: boolean("welcome_message_sent").default(false),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
});

// 2. categories - किसी को संदर्भित नहीं करता
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
});

// 3. deliveryAreas - किसी को संदर्भित नहीं करता
export const deliveryAreas = pgTable("delivery_areas", {
  id: serial("id").primaryKey(),
  areaName: text("area_name").notNull(),
  pincode: text("pincode").notNull(),
  city: text("city").notNull().default("Unknown"),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull(),
  freeDeliveryAbove: decimal("free_delivery_above", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
});

// 4. promoCodes - किसी को संदर्भित नहीं करता
export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: decimal("discount_value", { precision: 5, scale: 2 }).notNull().$type<number>(),
  minOrderValue: decimal("min_order_value", { precision: 10, scale: 2 }).$type<number>(),
  maxDiscountValue: decimal("max_discount_value", { precision: 10, scale: 2 }).$type<number>(),
  usageLimit: integer("usage_limit").default(1),
  usedCount: integer("used_count").default(0),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 5. serviceCategories - किसी को संदर्भित नहीं करता
export const serviceCategories = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),
  isActive: boolean("is_active").default(true),
});

// 6. deliveryAddresses - users को संदर्भित करता है
export const deliveryAddresses = pgTable('delivery_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  phoneNumber: text('phone_number'),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull().default('unknown'),
  state: text('state').notNull(),
  postalCode: text('postal_code').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).$type<number>(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).$type<number>(),
  label: text('label'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. sellersPgTable - users को संदर्भित करता है
export const sellersPgTable = pgTable("sellers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique().notNull().references(() => users.id),
  businessName: text("business_name").notNull(),
  businessType: text("business_type").notNull(),
  description: text("description"),
  businessAddress: text("business_address").notNull(),
  city: text("city").notNull(),
  pincode: text("pincode").notNull(),
  businessPhone: text("business_phone").notNull(),
  gstNumber: text("gst_number"),
  bankAccountNumber: text("bank_account_number"),
  ifscCode: text("ifsc_code"),
  deliveryRadius: integer("delivery_radius"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).$type<number>(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).$type<number>(),
  deliveryPincodes: text("delivery_pincodes").array(),
  isDistanceBasedDelivery: boolean("is_distance_based_delivery").default(false),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 8. deliveryBoys - users को संदर्भित करता है
export const deliveryBoys = pgTable("delivery_boys", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").unique(),
  userId: integer("user_id").unique().notNull().references(() => users.id),
  email: text("email").unique().notNull(),
  name: text("name"),
  phone: text("phone"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  vehicleType: text("vehicle_type").notNull(),
  vehicleNumber: text("vehicle_number"),
  licenseNumber: text("license_number"),
  aadharNumber: text("aadhar_number"),
  isAvailable: boolean("is_available").default(true),
  currentLat: decimal("current_lat", { precision: 10, scale: 8 }),
  currentLng: decimal("current_lng", { precision: 11, scale: 8 }),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.0"),
  totalDeliveries: integer("total_deliveries").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// 9. services - serviceCategories को संदर्भित करता है
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => serviceCategories.id),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().$type<number>(),
  image: text("image"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 10. stores - sellersPgTable को संदर्भित करता है
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellersPgTable.id),
  storeName: text("store_name").notNull(),
  storeType: text("store_type").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  pincode: text("pincode").notNull(),
  phone: text("phone").notNull(),
  isActive: boolean("is_active").default(true),
  licenseNumber: text("license_number"),
  gstNumber: text("gst_number"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).$type<number>(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).$type<number>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// 11. products - sellersPgTable, stores, categories को संदर्भित करता है
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").default(1).references(() => sellersPgTable.id),
  storeId: integer("store_id").references(() => stores.id),
  categoryId: integer("category_id").references(() => categories.id),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  description: text("description"),
  descriptionHindi: text("description_hindi"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().$type<number>(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).$type<number>(),
  image: text("image").notNull(),
  images: text("images").array().$type<string[]>(),
  unit: text("unit").notNull().default("piece"),
  brand: text("brand"),
  stock: integer("stock").notNull().default(0),
  minOrderQty: integer("min_order_qty").default(1),
  maxOrderQty: integer("max_order_qty").default(100),
  isActive: boolean("is_active").default(true),
  deliveryScope: text("delivery_scope").notNull().default('LOCAL'),
  productDeliveryPincodes: text("product_delivery_pincodes").array().$type<string[]>(),
  productDeliveryRadiusKM: integer("product_delivery_radius_km").$type<number>(),
  estimatedDeliveryTime: text("estimated_delivery_time").default('1-2 hours'),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// 12. serviceProviders - users, services को संदर्भित करता है
export const serviceProviders = pgTable("service_providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique().notNull().references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  description: text("description"),
  experienceYears: integer("experience_years"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.0"),
  isAvailable: boolean("is_available").default(true),
  approvalStatus: approvalStatusEnum("approval_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 13. orders - users, deliveryAddresses को संदर्भित करता है
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deliveryAddressId: integer("delivery_address_id").notNull().references(() => deliveryAddresses.id, { onDelete: "cascade" }),
  deliveryAddress: text("delivery_address").notNull().$type<string>(),
  deliveryCity: text("delivery_city").notNull().default('Unknown'),
  deliveryState: text("delivery_state").notNull().default('Unknown'),
  deliveryPincode: text("delivery_pincode").notNull().default('000000'),
  deliveryLat: decimal("delivery_lat", { precision: 10, scale: 7 }).$type<number>().default('0.0'),
  deliveryLng: decimal("delivery_lng", { precision: 10, scale: 7 }).$type<number>().default('0.0'),
  deliveryInstructions: text("delivery_instructions"),
  deliveryStatus: deliveryStatusEnum("delivery_status").default('pending').notNull(),
  deliveryOtp: text("delivery_otp"),
  deliveryOtpSentAt: timestamp("delivery_otp_sent_at"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().$type<number>(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().$type<number>(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(),
  transactionId: text("transaction_id"),
  estimatedDeliveryTime: timestamp("estimated_delivery_time"),
  actualDeliveryTime: timestamp("actual_delivery_time"),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).default('0.0').notNull(),
  promoCode: text("promo_code"),
  discount: decimal("discount", { precision: 5, scale: 2 }).$type<number>().default('0.0'),
  status: masterOrderStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => {
  return {
    orderNumberUnique: unique("order_number_unique").on(table.orderNumber),
  };
});

// 14. subOrders - orders, sellersPgTable, stores को संदर्भित करता है
export const subOrders = pgTable("sub_orders", {
  id: serial("id").primaryKey(),
  masterOrderId: integer("master_order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  subOrderNumber: text("sub_order_number").notNull().unique(),
  sellerId: integer("seller_id").notNull().default(1).references(() => sellersPgTable.id, { onDelete: "cascade" }),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'set null' }),
  status: subOrderStatusEnum("status").default("pending").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().$type<number>(),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull().default(0).$type<number>(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().$type<number>(),
  estimatedPreparationTime: text("estimated_preparation_time"),
  isSelfDeliveryBySeller: boolean("is_self_delivery_by_seller").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    subOrderNumberUnique: unique("sub_order_number_unique").on(table.subOrderNumber),
  };
});

// 15. deliveryBatches - orders, deliveryBoys, deliveryAddresses को संदर्भित करता है
export const deliveryBatches = pgTable("delivery_batches", {
    id: serial("id").primaryKey(),
    masterOrderId: integer("master_order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    deliveryBoyId: integer("delivery_boy_id").references(() => deliveryBoys.id, { onDelete: "set null" }),
    customerDeliveryAddressId: integer("customer_delivery_address_id").notNull().references(() => deliveryAddresses.id),
    status: deliveryStatusEnum("status").default("pending").notNull(),
    estimatedDeliveryTime: timestamp("estimated_delivery_time"),
    actualDeliveryTime: timestamp("actual_delivery_time"),
    deliveryOtp: text("delivery_otp"),
    deliveryOtpSentAt: timestamp("delivery_otp_sent_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// 16. cartItems - users, products, sellersPgTable को संदर्भित करता है
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  //productId: integer("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  //sellerId: integer("seller_id").notNull().default(1).references(() => sellersPgTable.id),
  quantity: integer("quantity").notNull().default(1),
  priceAtAdded: decimal("price_at_added", { precision: 10, scale: 2 }).notNull().$type<number>(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull().$type<number>(),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    unqUserProduct: unique("unq_user_product").on(table.userId, table.productId),
  };
});


// 17. orderItems - subOrders, orders, sellersPgTable, users, products को संदर्भित करता है
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  subOrderId: integer("sub_order_id").notNull().references(() => subOrders.id, { onDelete: 'cascade' }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  sellerId: integer("seller_id").notNull().default(1).references(() => sellersPgTable.id),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull().default('Unknown Product'),
  productImage: text("product_image"),
  productPrice: decimal("product_price", { precision: 10, scale: 2 }).notNull().default('0.0').$type<number>(),
  productUnit: text("product_unit").notNull().default('piece'),
  quantity: integer("quantity").notNull(),
  itemTotal: decimal("item_total", { precision: 10, scale: 2 }).notNull().default('0.00').$type<number>(),
  status: orderItemStatusEnum("status").default('pending').notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

// 18. serviceBookings - users, serviceProviders, services को संदर्भित करता है
export const serviceBookings = pgTable("service_bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => users.id),
  serviceProviderId: integer("service_provider_id").notNull().references(() => serviceProviders.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  bookingDate: timestamp("booking_date").notNull(),
  status: text("status").notNull().default("pending"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 19. reviews - users, products, orders को संदर्भित करता है
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 20. orderTracking - orders, deliveryBatches, users को संदर्भित करता है
export const orderTracking = pgTable("order_tracking", {
  id: serial("id").primaryKey(),
  masterOrderId: integer("master_order_id").references(() => orders.id, { onDelete: 'cascade' }),
  deliveryBatchId: integer("delivery_batch_id").references(() => deliveryBatches.id, { onDelete: 'cascade' }),
  status: text("status").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  location: text("location"),
  updatedBy: integer("updated_by").references(() => users.id),
  notes: text("notes"),
});

// 21. couponsPgTable - sellersPgTable, products, categories को संदर्भित करता है
export const couponsPgTable = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 255 }).unique().notNull(),
  description: text('description'),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull().$type<number>(),
  minOrderValue: decimal('min_order_value', { precision: 10, scale: 2 }).$type<number>(),
  maxDiscountValue: decimal('max_discount_value', { precision: 10, scale: 2 }).$type<number>(),
  usageLimit: integer('usage_limit').default(1),
  usedCount: integer('used_count').default(0),
  expiryDate: timestamp('expiry_date'),
  isActive: boolean('is_active').default(true),
  scope: couponScopeEnum('scope').default('all_orders').notNull(),
  sellerId: integer('seller_id').references(() => sellersPgTable.id),
  productId: integer('product_id').references(() => products.id),
  categoryId: integer('category_id').references(() => categories.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
