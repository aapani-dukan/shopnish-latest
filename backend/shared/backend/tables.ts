// backend/src/shared/backend/schema.ts

import { pgTable, text, serial, integer, decimal, boolean, timestamp, json, numeric, pgEnum, unique, varchar} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm"; // ✅ relations को इम्पोर्ट करें

// =========================================================================
// Enums
// =========================================================================

// Master Order Status (ग्राहक के समग्र ऑर्डर के लिए)
export const masterOrderStatusEnum = pgEnum('master_order_status', [
  'pending',          // ऑर्डर बनाया गया है, भुगतान लंबित/पुष्टि की प्रतीक्षा
  'confirmed',        // भुगतान सफल, सभी सब-ऑर्डर बनाए गए हैं
  'partially_fulfilled', // कुछ सब-ऑर्डर डिलीवर हो गए हैं
  'fulfilled',        // सभी सब-ऑर्डर डिलीवर हो गए हैं
  'cancelled',        // पूरा मास्टर ऑर्डर रद्द कर दिया गया है
  'failed'            // भुगतान विफल या ऑर्डर बनाने में विफलता
]);

// Sub-Order Status (सेलर-विशिष्ट ऑर्डर के लिए, प्रोसेसिंग से संबंधित)
export const subOrderStatusEnum = pgEnum('sub_order_status', [
  'pending',      // सेलर को असाइन किया गया, पुष्टि की प्रतीक्षा
  'accepted',     // सेलर ने स्वीकार कर लिया
  'preparing',    // सेलर प्रोडक्ट तैयार कर रहा है
  'ready_for_pickup', // प्रोडक्ट डिलीवरी बॉय के लिए तैयार है
  'cancelled',    // सेलर या एडमिन द्वारा रद्द कर दिया गया है
  'rejected'      // सेलर द्वारा अस्वीकार कर दिया गया है
]);

// Delivery Status (डिलीवरी बैच और सब-ऑर्डर डिलीवरी के लिए)
export const deliveryStatusEnum = pgEnum("delivery_status_enum", [
  "pending",          // अभी तक डिलीवरी असाइन नहीं की गई है
  "assigned",         // डिलीवरी बॉय को असाइन किया गया है
  "out_for_pickup",   // डिलीवरी बॉय पिकअप के रास्ते में है
  "picked_up",        // डिलीवरी बॉय ने आइटम पिकअप कर लिया है (पहला पिकअप होने पर ट्रिगर)
  "out_for_delivery", // डिलीवरी बॉय डिलीवरी के लिए निकला है (सभी पिकअप होने पर ट्रिगर)
  "delivered",        // डिलीवर कर दिया गया है
  "failed",           // डिलीवरी विफल
  "cancelled"         // डिलीवरी रद्द
]);
// ✅ 4. Product Category Enum (नई)
export const productCategoryEnum = pgEnum("product_category", [
  "Electronics",
  "Fashion",
  "Home & Kitchen",
  "Books",
  "Groceries",
  "Health & Beauty",
  "Sports & Outdoors",
  "Toys & Games",
  "Automotive",
  "Jewelry",
  "Pet Supplies",
  "Other"
]);
export const userRoleEnum = pgEnum("user_role", ["customer", "seller", "admin", "delivery-boy"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

export const paymentMethodEnum = pgEnum("payment_method", ["COD", "ONLINE"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded"]);

export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed_amount']);
export const couponScopeEnum = pgEnum('coupon_scope', ['all_orders', 'specific_seller', 'specific_product', 'category']);
// =========================================================================
// Core User & Seller Tables (कोई बड़ा बदलाव नहीं, बस रेफ्रेंस के लिए)
// =========================================================================

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
  address: text("address"), // ✅ ये डिलीवरी एड्रेस से मूव हो सकते हैं यदि user का अपना स्थायी पता स्टोर करना हो
  city: text("city"),
  pincode: text("pincode"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  whatsappOptIn: boolean("whatsapp_opt_in").default(true),
  welcomeMessageSent: boolean("welcome_message_sent").default(false),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
});


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
  latitude: decimal("latitude", { precision: 10, scale: 7 }).$type<number>(), // ✅ स्टोर के लिए Latitude
  longitude: decimal("longitude", { precision: 10, scale: 7 }).$type<number>(), // ✅ स्टोर के लिए Longitude
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(), // ✅ updatedAt जोड़ा
});


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


export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellersPgTable.id),
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

  deliveryScope: text("delivery_scope").notNull().default('LOCAL'), // 'LOCAL', 'CITY', 'STATE', 'NATIONAL'
  productDeliveryPincodes: text("product_delivery_pincodes").array().$type<string[]>(),
  productDeliveryRadiusKM: integer("product_delivery_radius_km").$type<number>(),
  estimatedDeliveryTime: text("estimated_delivery_time").default('1-2 hours'), // ✅ यह सेलर के लिए अनुमानित डिलीवरी टाइम फ्रेम है
  
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


export const deliveryAreas = pgTable("delivery_areas", {
  id: serial("id").primaryKey(),
  areaName: text("area_name").notNull(),
  pincode: text("pincode").notNull(),
  city: text("city").notNull(),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull(),
  freeDeliveryAbove: decimal("free_delivery_above", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
});

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


export const deliveryAddresses = pgTable('delivery_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  phoneNumber: text('phone_number'),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  postalCode: text('postal_code').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).$type<number>(), // ✅ Precision
  longitude: decimal('longitude', { precision: 10, scale: 7 }).$type<number>(), // ✅ Precision
  label: text('label'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  sellerId: integer("seller_id").notNull().references(() => sellersPgTable.id),
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


// =========================================================================
// NEW/UPDATED Order & Delivery Tables
// =========================================================================

// 1. Master Orders Table (ग्राहक का मुख्य ऑर्डर)
//    - ग्राहक के पूरे चेकआउट लेनदेन का प्रतिनिधित्व करता है।
//    - इसमें कोई विशिष्ट विक्रेता या डिलीवरी बॉय नहीं होता क्योंकि यह कई को कवर करता है।
//    - इसका status समग्र प्रगति को दर्शाता है।
export const orders = pgTable("orders", { // अब यह "master_orders" के रूप में काम करेगा
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // जैसे "ORD-12345"
  customerId: integer("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Delivery Address Snapshot (ग्राहक के पते की जानकारी, ताकि यह स्थायी हो)
  deliveryAddressId: integer("delivery_address_id").notNull().references(() => deliveryAddresses.id, { onDelete: "cascade" }), // यह ग्राहक के सहेजे गए पते को संदर्भित करता है
  deliveryAddress: text("delivery_address").notNull().$type<string>(), // JSON string or detailed address string
  deliveryCity: text("delivery_city").notNull(),
  deliveryState: text("delivery_state").notNull(),
  deliveryPincode: text("delivery_pincode").notNull(),
  deliveryLat: decimal("delivery_lat", { precision: 10, scale: 7 }).$type<number>().default('0.0'),
  deliveryLng: decimal("delivery_lng", { precision: 10, scale: 7 }).$type<number>().default('0.0'),
  deliveryInstructions: text("delivery_instructions"),

  // Financials for the entire order
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().$type<number>(), // सभी आइटम का योग
  total: decimal("total", { precision: 10, scale: 2 }).notNull().$type<number>(),     // कुल राशि (सबटोटल + डिलीवरी - डिस्काउंट)
  
  paymentMethod: paymentMethodEnum("payment_method").notNull(), // Enum का उपयोग करें
  paymentStatus: paymentStatusEnum("payment_status").default("pending").notNull(), // Enum का उपयोग करें
  transactionId: text("transaction_id"), // ऑनलाइन भुगतान के लिए

  promoCode: text("promo_code"),
  discount: decimal("discount", { precision: 5, scale: 2 }).$type<number>(),

  status: masterOrderStatusEnum("status").default("pending").notNull(), // मास्टर ऑर्डर का समग्र स्टेटस

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    orderNumberUnique: unique("order_number_unique").on(table.orderNumber),
  };
});

// 2. Sub-Orders Table (प्रत्येक सेलर और उसकी तैयारी/पिकअप स्थिति के लिए)
//    - यह एक मास्टर ऑर्डर के भीतर प्रत्येक सेलर के लिए एक व्यक्तिगत ऑर्डर का प्रतिनिधित्व करता है।
//    - यह सेलर के डैशबोर्ड पर एक स्वतंत्र ऑर्डर के रूप में दिखाई देगा।
export const subOrders = pgTable("sub_orders", { // ✅ नया टेबल
  id: serial("id").primaryKey(),
  masterOrderId: integer("master_order_id").notNull().references(() => orders.id, { onDelete: "cascade" }), // मास्टर ऑर्डर से लिंक
  subOrderNumber: text("sub_order_number").notNull().unique(), // जैसे "ORD-12345-A" (मास्टर ऑर्डर ID + सेलर का शॉर्ट कोड)
  
  sellerId: integer("seller_id").notNull().references(() => sellersPgTable.id, { onDelete: "cascade" }), // ✅ इस सब-ऑर्डर का सेलर
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'set null' }), // ✅ सेलर का कौन सा स्टोर जहां से पिकअप होगा

  status: subOrderStatusEnum("status").default("pending").notNull(), // सेलर-विशिष्ट ऑर्डर स्टेटस (accepted, preparing, ready_for_pickup)
  
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().$type<number>(), // इस सब-ऑर्डर के आइटम का योग
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull().default(0).$type<number>(), // ✅ इस सब-ऑर्डर का डिलीवरी शुल्क
  total: decimal("total", { precision: 10, scale: 2 }).notNull().$type<number>(), // इस सब-ऑर्डर का कुल (subtotal + deliveryCharge)

  estimatedPreparationTime: text("estimated_preparation_time"), // सेलर के लिए अनुमानित तैयारी का समय
  
  isSelfDeliveryBySeller: boolean("is_self_delivery_by_seller").default(false), // ✅ जैसे सीमेंट, रेत
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    subOrderNumberUnique: unique("sub_order_number_unique").on(table.subOrderNumber),
  };
});

// 3. Delivery Batches Table (डिलीवरी बॉय को असाइन की गई एक या एक से अधिक सब-ऑर्डर का समूह)
//    - यह टेबल कई sub_orders को एक डिलीवरी असाइनमेंट में समूहित करेगा।
//    - यह डिलीवरी बॉय के डैशबोर्ड पर एक कार्य के रूप में दिखाई देगा।
export const deliveryBatches = pgTable("delivery_batches", { // ✅ नया टेबल
    id: serial("id").primaryKey(),
    masterOrderId: integer("master_order_id").notNull().references(() => orders.id, { onDelete: "cascade" }), // किस मास्टर ऑर्डर से संबंधित
    deliveryBoyId: integer("delivery_boy_id").references(() => deliveryBoys.id, { onDelete: "set null" }), // इस बैच को कौन सा डिलीवरी बॉय हैंडल कर रहा है
    customerDeliveryAddressId: integer("customer_delivery_address_id").notNull().references(() => deliveryAddresses.id), // ग्राहक का अंतिम डिलीवरी पता
    
    // इस बैच का समग्र डिलीवरी स्टेटस (डिलीवरी बॉय द्वारा अपडेट किया गया)
    status: deliveryStatusEnum("status").default("pending").notNull(),
    
    estimatedDeliveryTime: timestamp("estimated_delivery_time"), // इस बैच की समग्र अनुमानित डिलीवरी
    actualDeliveryTime: timestamp("actual_delivery_time"),
    
    deliveryOtp: text("delivery_otp"),
    deliveryOtpSentAt: timestamp("delivery_otp_sent_at"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// 4. Order Items Table (अब sub_orders से संबंधित)
//    - यह मास्टर ऑर्डर से हटकर sub_order से जुड़ेगा।
//    - प्रोडक्ट विवरण का स्नैपशॉट रखता है।
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  subOrderId: integer("sub_order_id").notNull().references(() => subOrders.id, { onDelete: 'cascade' }), // ✅ sub_order से लिंक
  productId: integer("product_id").notNull().references(() => products.id),
  
  // Product details snapshot (यदि मूल प्रोडक्ट बदल जाए तो भी ऑर्डर आइटम की जानकारी स्थिर रहे)
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  productPrice: decimal("product_price", { precision: 10, scale: 2 }).notNull().$type<number>(), // ✅ unitPrice से बदला गया
  productUnit: text("product_unit").notNull(),
  
  quantity: integer("quantity").notNull(),
  itemTotal: decimal("item_total", { precision: 10, scale: 2 }).notNull().$type<number>(), // ✅ totalPrice से बदला गया (price * quantity)

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const couponsPgTable = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 255 }).unique().notNull(), // e.g., "FLAT100", "SAVE15"
  description: text('description'),
  discountType: discountTypeEnum('discount_type').notNull(), // 'percentage' or 'fixed_amount'
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(), // e.g., 10 (for 10%), 100 (for 100 Rs)
  minOrderValue: numeric('min_order_value', { precision: 10, scale: 2 }).default('0.00').notNull(),
  maxDiscountAmount: numeric('max_discount_amount', { precision: 10, scale: 2 }), // For percentage discounts, max value
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  usageLimit: integer('usage_limit'), // Total number of times this coupon can be used
  usageCount: integer('usage_count').default(0).notNull(), // How many times it has been used
  perUserLimit: integer('per_user_limit').default(1).notNull(), // How many times a single user can use it
  isActive: boolean('is_active').default(true).notNull(),
  couponScope: couponScopeEnum('coupon_scope').default('all_orders').notNull(), // 'all_orders', 'specific_seller', 'specific_product', 'category'
  // Foreign keys for specific scopes
  sellerId: integer('seller_id').references(() => sellersPgTable.id), // If scope is specific_seller
  productId: integer('product_id').references(() => products.id),     // If scope is specific_product
  categoryId: integer('category_id').references(() => categories.id), // If scope is category
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orderTracking = pgTable("order_tracking", {
  id: serial("id").primaryKey(),
  // orderId: integer("order_id").references(() => orders.id), // ❌ इसे हटाओ
  // ✅ अब orderTracking सीधे master order या deliveryBatch से लिंक हो सकता है
  masterOrderId: integer("master_order_id").references(() => orders.id, { onDelete: 'cascade' }),
  deliveryBatchId: integer("delivery_batch_id").references(() => deliveryBatches.id, { onDelete: 'cascade' }), // ✅ या deliveryBatch से लिंक करें

  status: text("status").notNull(), // ✅ text की बजाय pgEnum का उपयोग करना बेहतर होगा (जैसे `orderTrackingStatusEnum`)
  message: text("message"),
  messageHindi: text("message_hindi"),
  location: text("location"), // ✅ lat/lng के लिए अलग कॉलम बेहतर होगा
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),

});

// ✅ orderTrackingRelations

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  discountType: text("discount_type").notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").default(0),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceCategories = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  description: text("description"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => serviceCategories.id),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  duration: integer("duration").notNull(),
  isActive: boolean("is_active").default(true),
});

export const serviceProviders = pgTable("service_providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  experience: text("experience"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.0"),
  totalJobs: integer("total_jobs").default(0),
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceBookings = pgTable("service_bookings", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  serviceProviderId: integer("service_provider_id").references(() => serviceProviders.id),
  serviceId: integer("service_id").references(() => services.id),
  bookingNumber: text("booking_number").notNull().unique(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  address: json("address").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending"),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  customerNotes: text("customer_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playingWithNeon = pgTable("playing_with_neon", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),   
  value: text("value"),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  orderId: integer("order_id").references(() => orders.id), // ✅ Master Order ID के लिए
  deliveryBoyId: integer("delivery_boy_id").references(() => deliveryBoys.id),
  deliveryAddressId: integer("delivery_address_id").references(() => deliveryAddresses.id), // यह समीक्षा डिलीवरी पते के लिए है
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});
