var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express from "express";
import cors from "cors";

// server/routes.ts
import { Router as Router16 } from "express";

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// shared/backend/schema.ts
var schema_exports = {};
__export(schema_exports, {
  approvalStatusEnum: () => approvalStatusEnum,
  cartItems: () => cartItems,
  cartItemsRelations: () => cartItemsRelations,
  categories: () => categories,
  categoriesRelations: () => categoriesRelations,
  deliveryAddresses: () => deliveryAddresses,
  deliveryAddressesRelations: () => deliveryAddressesRelations,
  deliveryAreas: () => deliveryAreas,
  deliveryBoys: () => deliveryBoys,
  deliveryBoysRelations: () => deliveryBoysRelations,
  insertCartItemSchema: () => insertCartItemSchema,
  insertCategorySchema: () => insertCategorySchema,
  insertDeliveryAddressSchema: () => insertDeliveryAddressSchema,
  insertDeliveryAreaSchema: () => insertDeliveryAreaSchema,
  insertDeliveryBoySchema: () => insertDeliveryBoySchema,
  insertOrderItemSchema: () => insertOrderItemSchema,
  insertOrderSchema: () => insertOrderSchema,
  insertOrderTrackingSchema: () => insertOrderTrackingSchema,
  insertProductSchema: () => insertProductSchema,
  insertPromoCodeSchema: () => insertPromoCodeSchema,
  insertReviewSchema: () => insertReviewSchema,
  insertSellerSchema: () => insertSellerSchema,
  insertServiceBookingSchema: () => insertServiceBookingSchema,
  insertServiceCategorySchema: () => insertServiceCategorySchema,
  insertServiceProviderSchema: () => insertServiceProviderSchema,
  insertServiceSchema: () => insertServiceSchema,
  insertStoreSchema: () => insertStoreSchema,
  insertUserSchema: () => insertUserSchema,
  orderItems: () => orderItems,
  orderItemsRelations: () => orderItemsRelations,
  orderStatusEnum: () => orderStatusEnum,
  orderTracking: () => orderTracking,
  orderTrackingRelations: () => orderTrackingRelations,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  products: () => products,
  productsRelations: () => productsRelations,
  promoCodes: () => promoCodes,
  promoCodesRelations: () => promoCodesRelations,
  reviews: () => reviews,
  reviewsRelations: () => reviewsRelations,
  sellersPgTable: () => sellersPgTable,
  sellersRelations: () => sellersRelations,
  serviceBookings: () => serviceBookings,
  serviceBookingsRelations: () => serviceBookingsRelations,
  serviceCategories: () => serviceCategories,
  serviceCategoriesRelations: () => serviceCategoriesRelations,
  serviceProviders: () => serviceProviders,
  serviceProvidersRelations: () => serviceProvidersRelations,
  services: () => services,
  servicesRelations: () => servicesRelations,
  stores: () => stores,
  storesRelations: () => storesRelations,
  userRoleEnum: () => userRoleEnum,
  users: () => users,
  usersRelations: () => usersRelations
});

// shared/backend/tables.ts
import { pgTable, text, serial, integer, decimal, boolean, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
var orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "rejected",
  "in_cart"
]);
var userRoleEnum = pgEnum("user_role", ["customer", "seller", "admin", "delivery-boy"]);
var approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);
var deliveryStatusEnum = pgEnum("delivery_status_enum", [
  "pending",
  "accepted",
  "out_for_delivery",
  "delivered"
]);
var users = pgTable("users", {
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
  updatedAt: timestamp("updated_at").defaultNow()
});
var sellersPgTable = pgTable("sellers", {
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
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var stores = pgTable("stores", {
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
  createdAt: timestamp("created_at").defaultNow()
});
var categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  image: text("image"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0)
});
var products = pgTable("products", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => sellersPgTable.id),
  storeId: integer("store_id").references(() => stores.id),
  categoryId: integer("category_id").references(() => categories.id),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  description: text("description"),
  descriptionHindi: text("description_hindi"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  image: text("image").notNull(),
  images: text("images").array(),
  unit: text("unit").notNull().default("piece"),
  brand: text("brand"),
  stock: integer("stock").notNull().default(0),
  minOrderQty: integer("min_order_qty").default(1),
  maxOrderQty: integer("max_order_qty").default(100),
  isActive: boolean("is_active").default(true),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var deliveryAreas = pgTable("delivery_areas", {
  id: serial("id").primaryKey(),
  areaName: text("area_name").notNull(),
  pincode: text("pincode").notNull(),
  city: text("city").notNull(),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull(),
  freeDeliveryAbove: decimal("free_delivery_above", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true)
});
var deliveryBoys = pgTable("delivery_boys", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").unique(),
  userId: integer("user_id").unique().notNull().references(() => users.id),
  email: text("email").unique().notNull(),
  name: text("name"),
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
  createdAt: timestamp("created_at").defaultNow()
});
var cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow()
});
var deliveryAddresses = pgTable("delivery_addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number"),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  // Unique Order Number
  orderNumber: text("order_number").notNull(),
  // Relations
  customerId: integer("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // ✅ 'sellerId' कॉलम जोड़ा गया
  sellerId: integer("seller_id").notNull().references(() => sellersPgTable.id, { onDelete: "cascade" }),
  deliveryBoyId: integer("delivery_boy_id").references(() => deliveryBoys.id, { onDelete: "set null" }),
  deliveryAddressId: integer("delivery_address_id").notNull().references(() => deliveryAddresses.id, { onDelete: "cascade" }),
  // Order Details
  status: orderStatusEnum("status").default("pending").notNull(),
  // ✅ FIX: delivery_status कॉलम जोड़ा गया
  deliveryStatus: deliveryStatusEnum("delivery_status").default("pending").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  // Delivery Address (string version)
  deliveryAddress: text("delivery_address").notNull(),
  // Delivery Info
  deliveryInstructions: text("delivery_instructions"),
  estimatedDeliveryTime: timestamp("estimated_delivery_time"),
  actualDeliveryTime: timestamp("actual_delivery_time"),
  // Discounts / Offers
  promoCode: text("promo_code"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  sellerId: integer("seller_id").references(() => sellersPgTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").default("in_cart")
});
var orderTracking = pgTable("order_tracking", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  status: text("status").notNull(),
  message: text("message"),
  messageHindi: text("message_hindi"),
  location: text("location"),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});
var promoCodes = pgTable("promo_codes", {
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
  createdAt: timestamp("created_at").defaultNow()
});
var serviceCategories = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  description: text("description"),
  icon: text("icon"),
  isActive: boolean("is_active").default(true)
});
var services = pgTable("services", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => serviceCategories.id),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  duration: integer("duration").notNull(),
  isActive: boolean("is_active").default(true)
});
var serviceProviders = pgTable("service_providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  serviceId: integer("service_id").references(() => services.id),
  experience: text("experience"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.0"),
  totalJobs: integer("total_jobs").default(0),
  isAvailable: boolean("is_available").default(true),
  createdAt: timestamp("created_at").defaultNow()
});
var serviceBookings = pgTable("service_bookings", {
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
  createdAt: timestamp("created_at").defaultNow()
});
var reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  // Relations
  customerId: integer("customer_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  orderId: integer("order_id").references(() => orders.id),
  deliveryBoyId: integer("delivery_boy_id").references(() => deliveryBoys.id),
  deliveryAddressId: integer("delivery_address_id").references(() => deliveryAddresses.id),
  // Review details
  rating: integer("rating").notNull(),
  comment: text("comment"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow()
});

// shared/backend/relations.ts
import { relations } from "drizzle-orm";
var usersRelations = relations(users, ({ one, many }) => ({
  sellerProfile: one(sellersPgTable, {
    fields: [users.id],
    references: [sellersPgTable.userId]
  }),
  orders: many(orders),
  reviews: many(reviews),
  serviceProviders: many(serviceProviders),
  serviceBookings: many(serviceBookings),
  cartItems: many(cartItems)
}));
var sellersRelations = relations(sellersPgTable, ({ one, many }) => ({
  user: one(users, {
    fields: [sellersPgTable.userId],
    references: [users.id]
  }),
  products: many(products),
  stores: many(stores),
  orderItems: many(orderItems)
}));
var storesRelations = relations(stores, ({ one, many }) => ({
  seller: one(sellersPgTable, {
    fields: [stores.sellerId],
    references: [sellersPgTable.id]
  }),
  products: many(products)
}));
var categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
  serviceCategories: many(serviceCategories)
}));
var productsRelations = relations(products, ({ one, many }) => ({
  seller: one(sellersPgTable, {
    fields: [products.sellerId],
    references: [sellersPgTable.id]
  }),
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id]
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
  reviews: many(reviews)
}));
var deliveryBoysRelations = relations(deliveryBoys, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryBoys.userId],
    references: [users.id]
  }),
  orders: many(orders)
}));
var cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id]
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id]
  })
}));
var deliveryAddressesRelations = relations(deliveryAddresses, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryAddresses.userId],
    references: [users.id]
  }),
  orders: many(orders)
}));
var ordersRelations = relations(orders, ({ many, one }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id]
  }),
  deliveryBoy: one(deliveryBoys, {
    fields: [orders.deliveryBoyId],
    references: [deliveryBoys.id],
    optional: true
  }),
  deliveryAddress: one(deliveryAddresses, {
    fields: [orders.deliveryAddressId],
    references: [deliveryAddresses.id]
  }),
  items: many(orderItems),
  tracking: many(orderTracking)
}));
var orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id]
  }),
  seller: one(sellersPgTable, {
    fields: [orderItems.sellerId],
    references: [sellersPgTable.id]
  })
}));
var orderTrackingRelations = relations(orderTracking, ({ one }) => ({
  order: one(orders, {
    fields: [orderTracking.orderId],
    references: [orders.id]
  }),
  updatedBy: one(users, {
    fields: [orderTracking.updatedBy],
    references: [users.id]
  })
}));
var promoCodesRelations = relations(promoCodes, ({ many }) => ({
  orders: many(orders)
}));
var serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services)
}));
var servicesRelations = relations(services, ({ one, many }) => ({
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id]
  }),
  serviceProviders: many(serviceProviders),
  serviceBookings: many(serviceBookings)
}));
var serviceProvidersRelations = relations(serviceProviders, ({ one, many }) => ({
  user: one(users, {
    fields: [serviceProviders.userId],
    references: [users.id]
  }),
  service: one(services, {
    fields: [serviceProviders.serviceId],
    references: [services.id]
  }),
  serviceBookings: many(serviceBookings)
}));
var serviceBookingsRelations = relations(serviceBookings, ({ one }) => ({
  customer: one(users, {
    fields: [serviceBookings.customerId],
    references: [users.id]
  }),
  serviceProvider: one(serviceProviders, {
    fields: [serviceBookings.serviceProviderId],
    references: [serviceProviders.id]
  }),
  service: one(services, {
    fields: [serviceBookings.serviceId],
    references: [services.id]
  })
}));
var reviewsRelations = relations(reviews, ({ one }) => ({
  customer: one(users, {
    fields: [reviews.customerId],
    references: [users.id]
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id]
  }),
  order: one(orders, {
    fields: [reviews.orderId],
    references: [orders.id]
  })
}));

// shared/backend/zod-schemas.ts
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertSellerSchema = createInsertSchema(sellersPgTable, {
  userId: z.number().int(),
  businessPhone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  deliveryRadius: z.number().int().min(1, "Delivery Radius must be at least 1 km").optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true
});
var insertCategorySchema = createInsertSchema(categories).omit({
  id: true
});
var insertProductSchema = createInsertSchema(products, {
  price: z.string(),
  originalPrice: z.string().optional()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertDeliveryAreaSchema = createInsertSchema(deliveryAreas, {
  deliveryCharge: z.string(),
  freeDeliveryAbove: z.string().optional()
}).omit({
  id: true
});
var insertDeliveryBoySchema = createInsertSchema(deliveryBoys, {
  userId: z.number().int(),
  email: z.string().email(),
  name: z.string().min(1, "Name is required"),
  rating: z.string().optional().default("5.0")
}).omit({
  id: true,
  createdAt: true
});
var insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true
});
var insertDeliveryAddressSchema = createInsertSchema(deliveryAddresses).omit({
  id: true,
  createdAt: true
});
var insertOrderSchema = createInsertSchema(orders, {
  subtotal: z.string(),
  deliveryCharge: z.string().optional(),
  discount: z.string().optional(),
  total: z.string()
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertOrderItemSchema = createInsertSchema(orderItems, {
  unitPrice: z.string(),
  totalPrice: z.string()
}).omit({
  id: true
});
var insertOrderTrackingSchema = createInsertSchema(orderTracking).omit({
  id: true,
  createdAt: true
});
var insertPromoCodeSchema = createInsertSchema(promoCodes, {
  discountValue: z.string(),
  minOrderAmount: z.string().optional(),
  maxDiscount: z.string().optional()
}).omit({
  id: true,
  createdAt: true
});
var insertServiceCategorySchema = createInsertSchema(serviceCategories).omit({
  id: true
});
var insertServiceSchema = createInsertSchema(services, {
  basePrice: z.string()
}).omit({
  id: true
});
var insertServiceProviderSchema = createInsertSchema(serviceProviders, {
  rating: z.string().optional().default("5.0")
}).omit({
  id: true,
  createdAt: true
});
var insertServiceBookingSchema = createInsertSchema(serviceBookings, {
  price: z.string(),
  address: z.any()
}).omit({
  id: true,
  createdAt: true
});
var insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true
});

// server/db.ts
import "dotenv/config";
var connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("\u274C DATABASE_URL must be set in your .env file");
}
var pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
    // 🔐 Allows connecting to databases with self-signed SSL certificates, common on cloud platforms.
  }
});
var db = drizzle(pool, { schema: schema_exports });

// server/lib/firebaseAdmin.ts
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
console.log("--- Firebase ENV VARs Check ---");
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("FIREBASE_PRIVATE_KEY present:", !!process.env.FIREBASE_PRIVATE_KEY);
if (process.env.FIREBASE_PRIVATE_KEY) {
  console.log("FIREBASE_PRIVATE_KEY length:", process.env.FIREBASE_PRIVATE_KEY.length);
  console.log("FIREBASE_PRIVATE_KEY start:", process.env.FIREBASE_PRIVATE_KEY.substring(0, 30));
  console.log("FIREBASE_PRIVATE_KEY end:", process.env.FIREBASE_PRIVATE_KEY.substring(process.env.FIREBASE_PRIVATE_KEY.length - 30));
}
console.log("-------------------------------");
var firebaseApps = getApps();
var app;
if (!firebaseApps.length) {
  console.log("Initializing Firebase Admin SDK...");
  console.log("Project ID being used:", process.env.FIREBASE_PROJECT_ID);
  console.log("Client Email being used:", process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("\u274C ERROR: Missing Firebase environment variables.");
    process.exit(1);
  }
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  };
  app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: `${serviceAccount.projectId}.appspot.com`
  });
  console.log("\u2705 Firebase Admin SDK initialized successfully.");
} else {
  app = firebaseApps[0];
  console.log("\u2705 Firebase Admin SDK already initialized.");
}
var authAdmin = getAuth(app);
var storageAdmin = getStorage(app);

// server/middleware/verifyToken.ts
import { eq } from "drizzle-orm";
var verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("\u{1F50D} [verifyToken] Incoming Authorization Header:", authHeader);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("\u274C [verifyToken] No valid token provided");
    return res.status(401).json({ message: "No valid token provided" });
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    console.log("\u2705 [verifyToken] Decoded Token UID:", decodedToken.uid);
    const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, decodedToken.uid));
    console.log("\u{1F50D} [verifyToken] DB User Fetched:", dbUser);
    if (!dbUser) {
      console.error("\u274C [verifyToken] User not found in database for UID:", decodedToken.uid);
      return res.status(404).json({ message: "User not found in database" });
    }
    req.user = {
      id: dbUser.id,
      firebaseUid: decodedToken.uid,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      approvalStatus: dbUser.approvalStatus
    };
    console.log("\u2705 [verifyToken] Base User Attached:", req.user);
    if (dbUser.role === "delivery-boy") {
      const [dbDeliveryBoy] = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, dbUser.id));
      console.log("\u{1F50D} [verifyToken] DeliveryBoy Record:", dbDeliveryBoy);
      if (!dbDeliveryBoy) {
        console.error("\u274C [verifyToken] Delivery boy record not found for userId:", dbUser.id);
        return res.status(404).json({ message: "Delivery boy record not found" });
      }
      req.user.deliveryBoyId = dbDeliveryBoy.id;
      console.log("\u2705 [verifyToken] DeliveryBoyId attached:", dbDeliveryBoy.id);
      console.log("\u2705 [verifyToken] Final Delivery-Boy User Object:", req.user);
    }
    next();
  } catch (error) {
    console.error("\u274C [verifyToken] Error verifying token:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// server/middleware/authMiddleware.ts
import { eq as eq2, and } from "drizzle-orm";
var requireAuth = [
  verifyToken,
  (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized: Authentication required."
      });
    }
    next();
  }
];
var requireAdminAuth = [
  ...requireAuth,
  (req, res, next) => {
    if (req.user.role !== userRoleEnum.enumValues[2]) {
      return res.status(403).json({
        message: "Forbidden: Admin access required."
      });
    }
    next();
  }
];
var requireSellerAuth = [
  ...requireAuth,
  (req, res, next) => {
    if (req.user.role !== userRoleEnum.enumValues[1]) {
      return res.status(403).json({
        message: "Forbidden: Seller access required."
      });
    }
    next();
  }
];
var requireDeliveryBoyAuth = [
  ...requireAuth,
  async (req, res, next) => {
    console.log("\u{1F50D} [requireDeliveryBoyAuth] User:", req.user);
    if (!req.user || req.user.role !== userRoleEnum.enumValues[3]) {
      return res.status(403).json({ message: "Forbidden: Not a delivery boy." });
    }
    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: and(
        eq2(deliveryBoys.userId, req.user.id),
        eq2(deliveryBoys.approvalStatus, "approved")
      )
    });
    if (!deliveryBoy) {
      return res.status(403).json({
        message: "Forbidden: Delivery boy not approved or not found."
      });
    }
    req.user.deliveryBoyId = deliveryBoy.id;
    next();
  }
];

// server/routes.ts
import { eq as eq17 } from "drizzle-orm";

// server/roots/apiAuthLogin.ts
import { Router } from "express";
import { eq as eq3 } from "drizzle-orm";
import bcrypt from "bcrypt";
var apiAuthLoginRouter = Router();
apiAuthLoginRouter.post("/admin-login", async (req, res) => {
  const { password } = req.body;
  const adminPasswordHash = process.env.ADMIN_PASSWORD;
  if (!adminPasswordHash) {
    return res.status(500).json({ error: "Configuration error." });
  }
  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }
  try {
    const isPasswordCorrect = await bcrypt.compare(password, adminPasswordHash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid password." });
    }
    const [adminUser] = await db.select().from(users).where(eq3(users.role, userRoleEnum.enumValues[2]));
    if (!adminUser) {
      return res.status(500).json({ error: "Admin account not configured." });
    }
    const customToken = await authAdmin.createCustomToken(adminUser.firebaseUid);
    console.log("\u2705 Admin custom token created.");
    const expiresIn = 60 * 60 * 24 * 5 * 1e3;
    res.cookie("__session", customToken, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // dev में false
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    });
    return res.status(200).json({
      message: "Admin login successful.",
      customToken
    });
  } catch (error) {
    console.error("\u274C Admin login error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});
var apiAuthLogin_default = apiAuthLoginRouter;

// server/roots/admin/approve-product.ts
import { Router as Router2 } from "express";
import { eq as eq4 } from "drizzle-orm";
var router = Router2();
router.post("/admin/products/:productId/approve", requireAdminAuth, async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) {
    return res.status(400).json({ error: "Invalid product ID." });
  }
  try {
    const [product] = await db.select().from(products).where(eq4(products.id, productId));
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }
    await db.update(products).set({
      approvalStatus: approvalStatusEnum.enumValues[1]
      // approved
      // approvedAt: new Date() // Add if you have this column in products
    }).where(eq4(products.id, productId));
    res.status(200).json({ message: "Product approved successfully." });
  } catch (error) {
    console.error("Failed to approve product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
var approve_product_default = router;

// server/roots/admin/reject-product.ts
import { Router as Router3 } from "express";
import { eq as eq5 } from "drizzle-orm";
var router2 = Router3();
router2.post("/admin/products/:productId/reject", requireAdminAuth, async (req, res) => {
  const productId = parseInt(req.params.productId);
  const { reason } = req.body;
  if (isNaN(productId)) {
    return res.status(400).json({ error: "Invalid product ID." });
  }
  if (!reason) {
    return res.status(400).json({ error: "Rejection reason is required." });
  }
  try {
    const [product] = await db.select().from(products).where(eq5(products.id, productId));
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }
    await db.update(products).set({
      approvalStatus: approvalStatusEnum.enumValues[2],
      // rejected
      rejectionReason: reason
    }).where(eq5(products.id, productId));
    res.status(200).json({ message: "Product rejected successfully." });
  } catch (error) {
    console.error("Failed to reject product:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
var reject_product_default = router2;

// server/roots/admin/products.ts
import { Router as Router4 } from "express";
import { eq as eq6 } from "drizzle-orm";
var router3 = Router4();
router3.get("/pending", requireAdminAuth, async (req, res) => {
  try {
    const pendingProducts = await db.query.products.findMany({
      where: eq6(products.approvalStatus, approvalStatusEnum.enumValues[0])
    });
    res.status(200).json(pendingProducts);
  } catch (error) {
    console.error("Failed to fetch pending products:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
router3.get("/approved", requireAdminAuth, async (req, res) => {
  try {
    const approvedProducts = await db.query.products.findMany({
      where: eq6(products.approvalStatus, approvalStatusEnum.enumValues[1])
    });
    res.status(200).json(approvedProducts);
  } catch (error) {
    console.error("Failed to fetch approved products:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
router3.patch("/approve/:id", requireAdminAuth, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid ID provided." });
    }
    const [approved] = await db.update(products).set({ approvalStatus: approvalStatusEnum.enumValues[1] }).where(eq6(products.id, productId)).returning();
    if (!approved) {
      return res.status(404).json({ message: "Product not found." });
    }
    res.status(200).json({
      message: "Product approved successfully.",
      product: approved
    });
  } catch (error) {
    console.error("Failed to approve product:", error);
    res.status(500).json({ message: "Failed to approve product." });
  }
});
router3.patch("/reject/:id", requireAdminAuth, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ message: "Invalid ID provided." });
    }
    const [rejected] = await db.update(products).set({ approvalStatus: approvalStatusEnum.enumValues[2] }).where(eq6(products.id, productId)).returning();
    if (!rejected) {
      return res.status(404).json({ message: "Product not found." });
    }
    res.status(200).json({
      message: "Product rejected successfully.",
      product: rejected
    });
  } catch (error) {
    console.error("Failed to reject product:", error);
    res.status(500).json({ message: "Failed to reject product." });
  }
});
var products_default = router3;

// server/roots/admin/vendors.ts
import { Router as Router5 } from "express";
import { eq as eq7 } from "drizzle-orm";
var router4 = Router5();
router4.get("/pending", requireAdminAuth, async (req, res) => {
  try {
    const pendingSellers = await db.query.sellersPgTable.findMany({
      where: eq7(sellersPgTable.approvalStatus, approvalStatusEnum.enumValues[0])
    });
    res.status(200).json(pendingSellers);
  } catch (error) {
    console.error("Failed to fetch pending sellers:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
router4.get("/approved", requireAdminAuth, async (req, res) => {
  try {
    const approvedSellers = await db.query.sellersPgTable.findMany({
      where: eq7(sellersPgTable.approvalStatus, approvalStatusEnum.enumValues[1])
    });
    res.status(200).json(approvedSellers);
  } catch (error) {
    console.error("Failed to fetch approved sellers:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
router4.patch("/approve/:id", requireAdminAuth, async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    if (isNaN(sellerId)) {
      return res.status(400).json({ message: "Invalid ID provided." });
    }
    const seller = await db.query.sellersPgTable.findFirst({
      where: (fields, { eq: eq18 }) => eq18(fields.id, sellerId)
    });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }
    const [approved] = await db.update(sellersPgTable).set({ approvalStatus: "approved", approvedAt: /* @__PURE__ */ new Date() }).where(eq7(sellersPgTable.id, sellerId)).returning();
    await db.update(users).set({ role: "seller", approvalStatus: "approved" }).where(eq7(users.id, seller.userId));
    res.status(200).json({
      message: "Seller approved successfully.",
      seller: approved
    });
  } catch (error) {
    console.error("Failed to approve seller:", error);
    res.status(500).json({ message: "Failed to approve seller." });
  }
});
router4.patch("/reject/:id", requireAdminAuth, async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    if (isNaN(sellerId)) {
      return res.status(400).json({ message: "Invalid ID provided." });
    }
    const seller = await db.query.sellersPgTable.findFirst({
      where: (fields, { eq: eq18 }) => eq18(fields.id, sellerId)
    });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found." });
    }
    const [rejected] = await db.update(sellersPgTable).set({ approvalStatus: "rejected" }).where(eq7(sellersPgTable.id, sellerId)).returning();
    await db.update(users).set({ approvalStatus: "rejected", role: "customer" }).where(eq7(users.id, seller.userId));
    res.status(200).json({
      message: "Seller rejected successfully.",
      seller: rejected
    });
  } catch (error) {
    console.error("Failed to reject seller:", error);
    res.status(500).json({ message: "Failed to reject seller." });
  }
});
var vendors_default = router4;

// server/roots/admin/admin-password.ts
import { Router as Router6 } from "express";
import { eq as eq8 } from "drizzle-orm";
var router5 = Router6();
router5.get("/admin/users/:userId", requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }
  try {
    const [user] = await db.select().from(users).where(eq8(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    if (user.role !== userRoleEnum.enumValues[2]) {
      return res.status(403).json({ error: "Not an admin user." });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Failed to fetch admin user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
var admin_password_default = router5;

// routes/sellers/sellerRoutes.ts
import { Router as Router7 } from "express";
import { eq as eq9, desc, and as and2, exists } from "drizzle-orm";
import multer from "multer";

// server/cloudStorage.ts
import { Storage } from "@google-cloud/storage";
import path from "path";
import fs from "fs/promises";
var storage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  }
});
var bucket = storage.bucket("aapani-dukan");
var uploadImage = async (filePath, originalname) => {
  const destination = `uploads/${Date.now()}_${path.basename(originalname)}`;
  try {
    const [file] = await bucket.upload(filePath, {
      destination,
      metadata: {
        contentType: "image/jpeg"
        // ✅ अपनी इमेज के कंटेंट टाइप को सेट करें
      }
    });
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    await fs.unlink(filePath);
    return publicUrl;
  } catch (error) {
    console.error("\u274C Error uploading file to GCS:", error);
    throw new Error("Failed to upload image to cloud storage.");
  }
};

// server/socket.ts
import { Server } from "socket.io";
var io = null;
function initSocket(server2) {
  io = new Server(server2, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  io.on("connection", (socket) => {
    console.log("\u{1F50C} New client connected:", socket.id);
    socket.on("register-client", (data) => {
      console.log("\u{1F4E6} Registered client:", data);
      if (data?.role && data?.userId) {
        socket.join(`${data.role}:${data.userId}`);
        console.log(`\u2705 Client ${socket.id} joined room ${data.role}:${data.userId}`);
      }
    });
    socket.on("chat:message", (msg) => {
      console.log("\u{1F4AC} Message received:", msg);
      io?.emit("chat:message", msg);
    });
    socket.on("order:update", (data) => {
      console.log("\u{1F4E6} Order update:", data);
      io?.emit("order:update", data);
    });
    socket.on("disconnect", () => {
      console.log("\u274C Client disconnected:", socket.id);
    });
  });
  console.log("\u2705 Socket.IO initialized via initSocket");
  return io;
}
function getIO() {
  if (!io) {
    throw new Error("\u274C Socket.IO not initialized. Call initSocket or setIO first.");
  }
  return io;
}

// routes/sellers/sellerRoutes.ts
var sellerRouter = Router7();
var upload = multer({ dest: "uploads/" });
sellerRouter.post("/apply", verifyToken, async (req, res, next) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const userId = req.user?.id;
    if (!firebaseUid || !userId) return res.status(401).json({ message: "Unauthorized" });
    const {
      businessName,
      businessAddress,
      businessPhone,
      description,
      city,
      pincode,
      gstNumber,
      bankAccountNumber,
      ifscCode,
      deliveryRadius,
      businessType
    } = req.body;
    if (!businessName || !businessPhone || !city || !pincode || !businessAddress || !businessType) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    const [existing] = await db.select().from(sellersPgTable).where(eq9(sellersPgTable.userId, userId));
    if (existing) {
      return res.status(400).json({
        message: "Application already submitted.",
        status: existing.approvalStatus
      });
    }
    const newSeller = await db.insert(sellersPgTable).values({
      userId,
      businessName,
      businessAddress,
      businessPhone,
      description: description || null,
      city,
      pincode,
      gstNumber: gstNumber || null,
      bankAccountNumber: bankAccountNumber || null,
      ifscCode: ifscCode || null,
      deliveryRadius: deliveryRadius ? parseInt(String(deliveryRadius)) : null,
      businessType,
      approvalStatus: approvalStatusEnum.enumValues[0],
      // pending
      applicationDate: /* @__PURE__ */ new Date()
    }).returning();
    const [updatedUser] = await db.update(users).set({
      role: userRoleEnum.enumValues[1],
      // seller
      approvalStatus: approvalStatusEnum.enumValues[0]
      // pending
    }).where(eq9(users.id, userId)).returning();
    return res.status(201).json({
      message: "Application submitted.",
      seller: newSeller[0],
      user: {
        firebaseUid: updatedUser.firebaseUid,
        role: updatedUser.role,
        email: updatedUser.email,
        name: updatedUser.name
      }
    });
  } catch (error) {
    console.error("\u274C Error in POST /api/sellers/apply:", error);
    next(error);
  }
});
sellerRouter.get("/me", requireSellerAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user data." });
    }
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq9(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: "Seller profile not found." });
    }
    return res.status(200).json(sellerProfile);
  } catch (error) {
    console.error("\u274C Error in GET /api/sellers/me:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});
sellerRouter.get("/orders", requireSellerAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq9(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: "Seller profile not found." });
    }
    const sellerId = sellerProfile.id;
    const sellerOrders = await db.query.orders.findMany({
      where: exists(
        db.select().from(orderItems).where(
          and2(
            eq9(orderItems.sellerId, sellerId),
            eq9(orderItems.orderId, orders.id)
          )
        )
      ),
      with: {
        customer: true,
        items: {
          where: eq9(orderItems.sellerId, sellerId),
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                price: true,
                image: true,
                description: true
              }
            }
          }
        }
      },
      orderBy: desc(orders.createdAt)
    });
    return res.status(200).json(sellerOrders);
  } catch (error) {
    console.error("\u274C Error in GET /api/sellers/orders:", error);
    return res.status(500).json({ error: "Failed to fetch seller orders." });
  }
});
sellerRouter.get("/products", requireSellerAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq9(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: "Seller profile not found." });
    }
    const sellerId = sellerProfile.id;
    const sellerProducts = await db.query.products.findMany({
      where: eq9(products.sellerId, sellerId),
      with: {
        category: true
      },
      orderBy: desc(products.createdAt)
    });
    return res.status(200).json(sellerProducts);
  } catch (error) {
    console.error("\u274C Error in GET /api/sellers/products:", error);
    return res.status(500).json({ error: "Failed to fetch seller products." });
  }
});
sellerRouter.get("/categories", requireSellerAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq9(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: "Seller profile not found." });
    }
    const sellerId = sellerProfile.id;
    const sellerCategories = await db.query.categories.findMany({
      where: eq9(categories.sellerId, sellerId),
      orderBy: desc(categories.createdAt)
    });
    return res.status(200).json(sellerCategories);
  } catch (error) {
    console.error("\u274C Error in GET /api/sellers/categories:", error);
    return res.status(500).json({ error: "Failed to fetch seller categories." });
  }
});
sellerRouter.post(
  "/products",
  requireSellerAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      const firebaseUid = req.user?.firebaseUid;
      const userId = req.user?.id;
      if (!firebaseUid || !userId) {
        return res.status(401).json({ error: "Unauthorized: User not authenticated." });
      }
      const [sellerProfile] = await db.select().from(sellersPgTable).where(eq9(sellersPgTable.userId, userId));
      if (!sellerProfile) {
        return res.status(404).json({ error: "Seller profile not found. Please complete your seller registration." });
      }
      const sellerId = sellerProfile.id;
      const { name, description, price, categoryId, stock } = req.body;
      const file = req.file;
      if (!name || !price || !categoryId || !stock || !file) {
        return res.status(400).json({ error: "Missing required fields or image." });
      }
      const parsedCategoryId = parseInt(categoryId);
      const parsedStock = parseInt(stock);
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedCategoryId) || isNaN(parsedStock) || isNaN(parsedPrice)) {
        return res.status(400).json({ error: "Invalid data provided for categoryId, price, or stock." });
      }
      const imageUrl = await uploadImage(file.path, file.originalname);
      const newProduct = await db.insert(products).values({
        name,
        description,
        price: parsedPrice,
        categoryId: parsedCategoryId,
        stock: parsedStock,
        image: imageUrl,
        sellerId
      }).returning();
      getIO().emit("product:created", newProduct[0]);
      return res.status(201).json(newProduct[0]);
    } catch (error) {
      console.error("\u274C Error in POST /api/sellers/products:", error);
      return res.status(500).json({ error: "Failed to create product." });
    }
  }
);
sellerRouter.patch("/orders/:orderId/status", requireSellerAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;
    const { newStatus } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    if (!orderId || !newStatus) {
      return res.status(400).json({ error: "Order ID and new status are required." });
    }
    const parsedOrderId = parseInt(orderId, 10);
    if (isNaN(parsedOrderId)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }
    const orderItemsForSeller = await db.select({ sellerId: orderItems.sellerId }).from(orderItems).where(eq9(orderItems.orderId, parsedOrderId));
    if (orderItemsForSeller.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq9(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: "Seller profile not found." });
    }
    const sellerId = sellerProfile.id;
    const isOrderOwnedBySeller = orderItemsForSeller.some((item) => item.sellerId === sellerId);
    if (!isOrderOwnedBySeller) {
      return res.status(403).json({ error: "You are not authorized to update this order." });
    }
    const [updatedOrder] = await db.update(orders).set({ status: newStatus }).where(eq9(orders.id, parsedOrderId)).returning();
    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found." });
    }
    getIO().emit("order:status-updated", { orderId: parsedOrderId, newStatus });
    return res.status(200).json({ message: "Order status updated successfully.", order: updatedOrder });
  } catch (error) {
    console.error("\u274C Error updating order status:", error);
    return res.status(500).json({ error: "Failed to update order status." });
  }
});
var sellerRoutes_default = sellerRouter;

// routes/productRoutes.ts
import { Router as Router8 } from "express";
import { eq as eq10, like } from "drizzle-orm";
var router6 = Router8();
router6.get("/pending", async (req, res) => {
  try {
    const productsList = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      status: products.status,
      category: categories.name
    }).from(products).leftJoin(categories, eq10(products.categoryId, categories.id)).where(eq10(products.status, "pending"));
    res.status(200).json(productsList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal error." });
  }
});
router6.get("/approved", async (req, res) => {
  try {
    const productsList = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      status: products.status,
      category: categories.name
    }).from(products).leftJoin(categories, eq10(products.categoryId, categories.id)).where(eq10(products.status, "approved"));
    res.status(200).json(productsList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal error." });
  }
});
router6.get("/", async (req, res) => {
  try {
    const { categoryId, search } = req.query;
    let query = db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      image: products.image,
      sellerId: products.sellerId,
      categoryName: categories.name
    }).from(products).leftJoin(categories, eq10(products.categoryId, categories.id));
    if (categoryId) {
      const parsedCategoryId = parseInt(categoryId);
      if (!isNaN(parsedCategoryId)) {
        query = query.where(eq10(products.categoryId, parsedCategoryId));
      }
    }
    if (search) {
      query = query.where(like(products.name, `%${search}%`));
    }
    const productsList = await query;
    res.status(200).json(productsList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal error." });
  }
});
router6.get("/:id", async (req, res) => {
  const productId = parseInt(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid product ID." });
  try {
    const [product] = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      image: products.image,
      sellerId: products.sellerId,
      categoryName: categories.name
    }).from(products).leftJoin(categories, eq10(products.categoryId, categories.id)).where(eq10(products.id, productId));
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.status(200).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal error." });
  }
});
var productRoutes_default = router6;

// routes/cartRoutes.ts
import { Router as Router9 } from "express";
import { eq as eq11, and as and3, inArray } from "drizzle-orm";
var cartRouter = Router9();
cartRouter.get("/", requireAuth, async (req, res) => {
  try {
    console.log("\u{1F6D2} [API] Received GET request for cart.");
    const firebaseUid = req.user?.firebaseUid;
    if (!firebaseUid) {
      return res.status(401).json({ error: "Unauthorized: Missing user UUID" });
    }
    const [dbUser] = await db.select({ id: users.id }).from(users).where(eq11(users.firebaseUid, firebaseUid));
    if (!dbUser) {
      return res.status(404).json({ error: "User not found." });
    }
    const cartItemsData = await db.query.orderItems.findMany({
      where: and3(eq11(orderItems.userId, dbUser.id), eq11(orderItems.status, "in_cart"))
    });
    if (cartItemsData.length === 0) {
      return res.status(200).json({ message: "Your cart is empty", items: [] });
    }
    const productIds = cartItemsData.map((item) => item.productId);
    const productsData = await db.query.products.findMany({
      where: inArray(products.id, productIds)
    });
    const productsMap = new Map(productsData.map((product) => [product.id, product]));
    const cleanedCartData = cartItemsData.map((item) => {
      const product = productsMap.get(item.productId);
      if (!product) return null;
      return {
        id: item.id,
        quantity: item.quantity,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          sellerId: product.sellerId
        }
      };
    }).filter((item) => item !== null);
    return res.status(200).json({ message: "Cart fetched successfully", items: cleanedCartData });
  } catch (error) {
    console.error("\u274C [API] Error fetching cart:", error);
    return res.status(500).json({ error: "Failed to fetch cart. An unexpected error occurred." });
  }
});
cartRouter.post("/add", requireAuth, async (req, res) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { productId, quantity } = req.body;
    if (!firebaseUid || !productId || !quantity) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const [dbUser] = await db.select({ id: users.id }).from(users).where(eq11(users.firebaseUid, firebaseUid));
    if (!dbUser) return res.status(404).json({ error: "User not found." });
    const [product] = await db.select().from(products).where(eq11(products.id, productId)).limit(1);
    if (!product) return res.status(404).json({ error: "Product not found." });
    const unitPrice = parseFloat(product.price);
    const totalPrice = unitPrice * quantity;
    const sellerId = product.sellerId;
    const [existingItem] = await db.select().from(orderItems).where(and3(eq11(orderItems.userId, dbUser.id), eq11(orderItems.productId, productId), eq11(orderItems.status, "in_cart")));
    let item;
    if (existingItem) {
      const updatedItem = await db.update(orderItems).set({
        quantity: existingItem.quantity + quantity,
        totalPrice: existingItem.totalPrice + totalPrice
      }).where(eq11(orderItems.id, existingItem.id)).returning();
      item = updatedItem[0];
    } else {
      const newItem = await db.insert(orderItems).values({
        userId: dbUser.id,
        productId,
        quantity,
        unitPrice,
        totalPrice,
        sellerId,
        status: "in_cart"
      }).returning();
      item = newItem[0];
    }
    getIO().emit("cart:updated", { userId: dbUser.id });
    return res.status(200).json({ message: "Item added to cart.", item });
  } catch (error) {
    console.error("\u274C [API] Error adding item to cart:", error);
    return res.status(500).json({ error: "Failed to add item to cart." });
  }
});
cartRouter.put("/:cartItemId", requireAuth, async (req, res) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    if (!firebaseUid || !quantity || isNaN(parseInt(cartItemId))) {
      return res.status(400).json({ error: "Invalid or missing fields." });
    }
    const [dbUser] = await db.select({ id: users.id }).from(users).where(eq11(users.firebaseUid, firebaseUid));
    if (!dbUser) return res.status(404).json({ error: "User not found." });
    const [updatedItem] = await db.update(orderItems).set({ quantity }).where(and3(eq11(orderItems.id, parseInt(cartItemId)), eq11(orderItems.userId, dbUser.id), eq11(orderItems.status, "in_cart"))).returning();
    if (!updatedItem) {
      return res.status(404).json({ message: "Cart item not found or does not belong to user." });
    }
    getIO().emit("cart:updated", { userId: dbUser.id });
    return res.status(200).json({ message: "Cart item updated successfully.", item: updatedItem });
  } catch (error) {
    console.error("\u274C [API] Error updating cart item:", error);
    return res.status(500).json({ error: "Failed to update cart item." });
  }
});
cartRouter.delete("/:cartItemId", requireAuth, async (req, res) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { cartItemId } = req.params;
    if (!firebaseUid || isNaN(parseInt(cartItemId))) {
      return res.status(400).json({ error: "Invalid or missing cart item ID." });
    }
    const [dbUser] = await db.select({ id: users.id }).from(users).where(eq11(users.firebaseUid, firebaseUid));
    if (!dbUser) return res.status(404).json({ error: "User not found." });
    const [deletedItem] = await db.delete(orderItems).where(and3(eq11(orderItems.id, parseInt(cartItemId)), eq11(orderItems.userId, dbUser.id), eq11(orderItems.status, "in_cart"))).returning();
    if (!deletedItem) {
      return res.status(404).json({ message: "Cart item not found or does not belong to user." });
    }
    getIO().emit("cart:updated", { userId: dbUser.id });
    return res.status(200).json({ message: "Cart item removed successfully." });
  } catch (error) {
    console.error("\u274C [API] Error removing cart item:", error);
    return res.status(500).json({ error: "Failed to remove item from cart." });
  }
});
var cartRoutes_default = cartRouter;

// routes/dBoyRoutes.ts
import { Router as Router10 } from "express";
import { eq as eq12, and as and4, not } from "drizzle-orm";
var router7 = Router10();
router7.post("/register", async (req, res) => {
  try {
    const { email, firebaseUid, fullName, vehicleType } = req.body;
    if (!email || !firebaseUid || !fullName || !vehicleType) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    let newDeliveryBoy;
    const existingUser = await db.query.users.findFirst({
      where: eq12(users.email, email)
    });
    if (existingUser) {
      const existingDeliveryBoy = await db.query.deliveryBoys.findFirst({
        where: eq12(deliveryBoys.email, email)
      });
      if (existingDeliveryBoy) {
        return res.status(409).json({ message: "A user with this email is already registered as a delivery boy." });
      }
      [newDeliveryBoy] = await db.insert(deliveryBoys).values({
        firebaseUid,
        email,
        name: fullName,
        vehicleType,
        approvalStatus: "pending",
        userId: existingUser.id
      }).returning();
    } else {
      const [newUser] = await db.insert(users).values({
        firebaseUid,
        email,
        name: fullName,
        role: "delivery-boy",
        approvalStatus: "pending"
      }).returning();
      if (!newUser) {
        return res.status(500).json({ message: "Failed to create new user." });
      }
      [newDeliveryBoy] = await db.insert(deliveryBoys).values({
        firebaseUid,
        email,
        name: fullName,
        vehicleType,
        approvalStatus: "pending",
        userId: newUser.id
      }).returning();
    }
    if (!newDeliveryBoy) {
      console.error("\u274C Failed to insert new delivery boy into the database.");
      return res.status(500).json({ message: "Failed to submit application. Please try again." });
    }
    getIO().emit("admin:update", { type: "delivery-boy-register", data: newDeliveryBoy });
    return res.status(201).json(newDeliveryBoy);
  } catch (error) {
    console.error("\u274C Drizzle insert error:", error);
    res.status(400).json({ error: error.message });
  }
});
router7.post("/login", verifyToken, async (req, res) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const email = req.user?.email;
    if (!firebaseUid || !email) {
      return res.status(401).json({ message: "Authentication failed. Token missing or invalid." });
    }
    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq12(deliveryBoys.firebaseUid, firebaseUid),
      with: { user: true }
    });
    if (!deliveryBoy || deliveryBoy.approvalStatus !== "approved") {
      return res.status(404).json({ message: "Account not found or not approved." });
    }
    if (!deliveryBoy.user || deliveryBoy.user.role !== "delivery-boy") {
      await db.update(users).set({ role: "delivery-boy" }).where(eq12(users.id, deliveryBoy.user.id));
    }
    res.status(200).json({
      message: "Login successful",
      user: deliveryBoy
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ message: "Failed to authenticate. An unexpected error occurred." });
  }
});
router7.get("/orders/available", requireDeliveryBoyAuth, async (req, res) => {
  try {
    const list = await db.query.orders.findMany({
      where: and4(
        eq12(orders.deliveryStatus, "pending"),
        not(eq12(orders.status, "rejected"))
      ),
      with: {
        items: { with: { product: { seller: true } } },
        deliveryAddress: true
      },
      orderBy: (o, { asc }) => [asc(o.createdAt)]
    });
    console.log("\u2705 Available orders fetched:", list.length);
    res.status(200).json({ orders: list });
  } catch (error) {
    console.error("\u274C Failed to fetch available orders:", error);
    res.status(500).json({ message: "Failed to fetch available orders." });
  }
});
router7.get("/orders/my", requireDeliveryBoyAuth, async (req, res) => {
  try {
    const deliveryBoyId = req.user?.deliveryBoyId;
    if (!deliveryBoyId) {
      console.error("\u274C DeliveryBoyId missing for user:", req.user?.id);
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }
    const list = await db.query.orders.findMany({
      where: and4(
        eq12(orders.deliveryBoyId, deliveryBoyId),
        eq12(orders.deliveryStatus, "accepted")
      ),
      with: {
        items: { with: { product: { seller: true } } },
        deliveryAddress: true
      },
      orderBy: (o, { desc: desc4 }) => [desc4(o.createdAt)]
    });
    console.log("\u2705 My orders fetched:", list.length);
    res.status(200).json({ orders: list });
  } catch (error) {
    console.error("\u274C Failed to fetch my orders:", error);
    res.status(500).json({ message: "Failed to fetch my orders." });
  }
});
router7.post("/accept", requireDeliveryBoyAuth, async (req, res) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { orderId } = req.body || {};
    if (!orderId || !firebaseUid) {
      return res.status(400).json({ message: "Order ID is required." });
    }
    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq12(deliveryBoys.firebaseUid, firebaseUid)
    });
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }
    const existing = await db.query.orders.findFirst({
      where: eq12(orders.id, orderId),
      columns: { id: true, deliveryStatus: true, deliveryBoyId: true }
    });
    if (!existing) return res.status(404).json({ message: "Order not found." });
    if (existing.deliveryStatus !== "pending") {
      return res.status(409).json({ message: "Order is not available for acceptance." });
    }
    const deliveryOtp = Math.floor(1e3 + Math.random() * 9e3).toString();
    const [updated] = await db.update(orders).set({
      deliveryBoyId: deliveryBoy.id,
      deliveryStatus: "accepted",
      // Retains 'accepted' as per your logic
      deliveryOtp,
      deliveryAcceptedAt: /* @__PURE__ */ new Date()
    }).where(eq12(orders.id, orderId)).returning();
    const { deliveryOtp: _, ...orderWithoutOtp } = updated;
    getIO().emit("order:update", {
      reason: "accepted",
      orderId,
      deliveryBoyId: deliveryBoy.id
    });
    return res.json({ message: "Order accepted", order: orderWithoutOtp });
  } catch (err) {
    console.error("POST /delivery/accept error:", err);
    return res.status(500).json({ message: "Failed to accept order" });
  }
});
router7.patch("/orders/:orderId/status", requireDeliveryBoyAuth, async (req, res) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    const { newStatus } = req.body;
    if (!orderId || !newStatus || !firebaseUid) {
      return res.status(400).json({ message: "Order ID and status are required." });
    }
    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq12(deliveryBoys.firebaseUid, firebaseUid)
    });
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }
    const validStatusesForDeliveryBoy = ["picked_up", "out_for_delivery"];
    if (!validStatusesForDeliveryBoy.includes(newStatus)) {
      return res.status(400).json({ message: "Invalid status provided." });
    }
    const order = await db.query.orders.findFirst({
      where: eq12(orders.id, orderId)
    });
    if (order?.deliveryBoyId !== deliveryBoy.id) {
      return res.status(403).json({ message: "Forbidden: You are not assigned to this order." });
    }
    const [updatedOrder] = await db.update(orders).set({ status: newStatus }).where(eq12(orders.id, orderId)).returning();
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found." });
    }
    res.status(200).json({
      message: "Order status updated successfully.",
      order: updatedOrder
    });
    getIO().emit("order:update", { type: "status-change", data: updatedOrder });
  } catch (error) {
    console.error("Failed to update order status:", error);
    res.status(500).json({ message: "Failed to update order status." });
  }
});
router7.post("/orders/:orderId/complete-delivery", requireDeliveryBoyAuth, async (req, res) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const orderId = Number(req.params.orderId);
    const { otp } = req.body;
    if (!orderId || !otp || !firebaseUid) {
      return res.status(400).json({ message: "Order ID and OTP are required." });
    }
    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq12(deliveryBoys.firebaseUid, firebaseUid)
    });
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy profile not found." });
    }
    const order = await db.query.orders.findFirst({
      where: eq12(orders.id, orderId)
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }
    if (order.deliveryBoyId !== deliveryBoy.id) {
      return res.status(403).json({ message: "Forbidden: You are not assigned to this order." });
    }
    if (order.deliveryOtp !== otp) {
      return res.status(401).json({ message: "Invalid OTP." });
    }
    const [updatedOrder] = await db.update(orders).set({
      status: "delivered",
      deliveryStatus: "delivered",
      deliveryOtp: null
    }).where(eq12(orders.id, orderId)).returning();
    res.status(200).json({
      message: "Delivery completed successfully.",
      order: updatedOrder
    });
    getIO().emit("order:update", {
      type: "delivered",
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      deliveryStatus: updatedOrder.deliveryStatus
    });
  } catch (error) {
    console.error("Failed to complete delivery:", error);
    res.status(500).json({ message: "Failed to complete delivery." });
  }
});
var dBoyRoutes_default = router7;

// server/roots/admin/admindBoyRoutes.ts
import { Router as Router11 } from "express";
import { eq as eq13 } from "drizzle-orm";
var router8 = Router11();
router8.get("/pending", requireAdminAuth, async (req, res) => {
  try {
    const pendingApplications = await db.query.deliveryBoys.findMany({
      where: eq13(deliveryBoys.approvalStatus, approvalStatusEnum.enumValues[0])
    });
    res.status(200).json(pendingApplications);
  } catch (error) {
    console.error("Failed to fetch pending delivery boys:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
router8.get("/approved", requireAdminAuth, async (req, res) => {
  try {
    const approvedDeliveryBoys = await db.query.deliveryBoys.findMany({
      where: eq13(deliveryBoys.approvalStatus, approvalStatusEnum.enumValues[1])
    });
    res.status(200).json(approvedDeliveryBoys);
  } catch (error) {
    console.error("Failed to fetch approved delivery boys:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
router8.patch("/approve/:id", requireAdminAuth, async (req, res) => {
  try {
    const deliveryBoyId = Number(req.params.id);
    if (isNaN(deliveryBoyId)) {
      return res.status(400).json({ message: "Invalid ID provided." });
    }
    const [deliveryBoy] = await db.select().from(deliveryBoys).where(eq13(deliveryBoys.id, deliveryBoyId));
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }
    const [approved] = await db.update(deliveryBoys).set({ approvalStatus: "approved" }).where(eq13(deliveryBoys.id, deliveryBoyId)).returning();
    await db.update(users).set({ role: "delivery_boy", approvalStatus: "approved" }).where(eq13(users.id, deliveryBoy.userId));
    res.status(200).json({
      message: "Delivery boy approved successfully.",
      deliveryBoy: approved
    });
  } catch (error) {
    console.error("Failed to approve delivery boy:", error);
    res.status(500).json({ message: "Failed to approve delivery boy." });
  }
});
router8.patch("/reject/:id", requireAdminAuth, async (req, res) => {
  try {
    const deliveryBoyId = Number(req.params.id);
    if (isNaN(deliveryBoyId)) {
      return res.status(400).json({ message: "Invalid ID provided." });
    }
    const [rejected] = await db.update(deliveryBoys).set({ approvalStatus: "rejected" }).where(eq13(deliveryBoys.id, deliveryBoyId)).returning();
    if (!rejected) {
      return res.status(404).json({ message: "Delivery boy not found." });
    }
    const [deliveryBoy] = await db.select().from(deliveryBoys).where(eq13(deliveryBoys.id, deliveryBoyId));
    if (deliveryBoy) {
      await db.update(users).set({ approvalStatus: "rejected", role: "customer" }).where(eq13(users.id, deliveryBoy.userId));
    }
    res.status(200).json({
      message: "Delivery boy rejected successfully.",
      deliveryBoy: rejected
    });
  } catch (error) {
    console.error("Failed to reject delivery boy:", error);
    res.status(500).json({ message: "Failed to reject delivery boy." });
  }
});
var admindBoyRoutes_default = router8;

// routes/orderConfirmationRouter.ts
import { Router as Router12 } from "express";
import { eq as eq14 } from "drizzle-orm";
var router9 = Router12();
router9.get("/:orderId", requireAuth, async (req, res) => {
  try {
    console.log(`\u{1F50D} [API] Received GET request for order ID: ${req.params.orderId}`);
    const firebaseUid = req.user?.firebaseUid;
    const { orderId } = req.params;
    if (!firebaseUid) {
      return res.status(401).json({ message: "Unauthorized: Missing user UUID." });
    }
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({ message: "Invalid order ID provided." });
    }
    const user = await db.query.users.findFirst({
      where: eq14(users.firebaseUid, firebaseUid)
    });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const order = await db.query.orders.findFirst({
      where: eq14(orders.id, parseInt(orderId)),
      with: {
        items: {
          with: {
            product: true
          }
        }
      }
    });
    if (!order || order.customerId !== user.id) {
      console.log(`\u274C [API] Order not found for ID: ${orderId} or does not belong to user.`);
      return res.status(404).json({ message: "Order not found." });
    }
    console.log(`\u2705 [API] Sending order details for ID: ${order.id}`);
    res.status(200).json(order);
  } catch (error) {
    console.error("\u274C [API] Error fetching order confirmation details:", error);
    res.status(500).json({ message: "Failed to fetch order details. An unexpected error occurred." });
  }
});
var orderConfirmationRouter_default = router9;

// routes/userRoutes.ts
import { Router as Router13 } from "express";
import { eq as eq15 } from "drizzle-orm";
var userLoginRouter = Router13();
userLoginRouter.post("/login", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: "ID Token is required." });
  }
  try {
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || null;
    const user = await db.query.users.findFirst({
      where: eq15(users.firebaseUid, firebaseUid),
      with: {
        sellerProfile: true
      }
    });
    if (!user) {
      const nameParts = name ? name.split(" ") : [];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const [newUser] = await db.insert(users).values({
        firebaseUid,
        email,
        name,
        role: userRoleEnum.enumValues[0],
        password: "",
        firstName,
        lastName,
        phone: "",
        address: ""
      }).returning();
      console.log("\u2705 \u0928\u092F\u093E \u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E \u0921\u0947\u091F\u093E\u092C\u0947\u0938 \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E\u0964");
      const customToken = await authAdmin.createCustomToken(newUser.firebaseUid);
      const expiresIn = 60 * 60 * 24 * 5 * 1e3;
      res.cookie("__session", customToken, {
        maxAge: expiresIn,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
      });
      return res.status(200).json({
        message: "\u0928\u092F\u093E \u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E \u0932\u0949\u0917\u093F\u0928 \u0938\u092B\u0932",
        customToken,
        user: newUser
      });
    } else {
      const customToken = await authAdmin.createCustomToken(user.firebaseUid);
      const expiresIn = 60 * 60 * 24 * 5 * 1e3;
      res.cookie("__session", customToken, {
        maxAge: expiresIn,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
      });
      return res.status(200).json({
        message: "\u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E \u0932\u0949\u0917\u093F\u0928 \u0938\u092B\u0932",
        customToken,
        user
      });
    }
  } catch (error) {
    console.error("\u274C \u0909\u092A\u092F\u094B\u0917\u0915\u0930\u094D\u0924\u093E \u0932\u0949\u0917\u093F\u0928 \u0924\u094D\u0930\u0941\u091F\u093F:", error);
    return res.status(401).json({ error: "Invalid token or login error." });
  }
});
var userRoutes_default = userLoginRouter;

// routes/orderRoutes.ts
import { Router as Router14 } from "express";

// server/controllers/orderController.ts
import { v4 as uuidv4 } from "uuid";
import { eq as eq16, desc as desc3, and as and5 } from "drizzle-orm";
var placeOrderBuyNow = async (req, res) => {
  console.log("\u{1F680} [API] Received request to place Buy Now order.");
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not logged in." });
    }
    const {
      deliveryAddress: rawDeliveryAddress,
      paymentMethod,
      deliveryInstructions,
      items,
      subtotal,
      total,
      deliveryCharge
    } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Items list is empty, cannot place an order." });
    }
    const orderNumber = `ORD-${uuidv4()}`;
    const newOrder = await db.transaction(async (tx) => {
      let newDeliveryAddressId;
      const safeAddress = rawDeliveryAddress || {};
      const [newAddress] = await tx.insert(deliveryAddresses).values({
        userId,
        fullName: safeAddress.fullName || req.user?.name || "Unknown Customer",
        phoneNumber: safeAddress.phone || req.user?.phone || "0000000000",
        addressLine1: safeAddress.address || "N/A",
        addressLine2: safeAddress.landmark || "",
        city: safeAddress.city || "Unknown",
        postalCode: safeAddress.pincode || "000000",
        state: "Rajasthan"
      }).returning();
      newDeliveryAddressId = newAddress.id;
      const [orderResult] = await tx.insert(orders).values({
        customerId: userId,
        status: "pending",
        // ✅ अब केवल status का उपयोग हो रहा है
        orderNumber,
        subtotal: parseFloat(subtotal).toFixed(2),
        total: parseFloat(total).toFixed(2),
        deliveryCharge: parseFloat(deliveryCharge).toFixed(2),
        paymentMethod: paymentMethod || "COD",
        deliveryAddressId: newDeliveryAddressId,
        deliveryInstructions,
        deliveryAddress: JSON.stringify(safeAddress),
        deliveryBoyId: null
      }).returning();
      for (const item of items) {
        await tx.insert(orderItems).values({
          orderId: orderResult.id,
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
          totalPrice: parseFloat(item.totalPrice),
          status: "placed",
          // 'buy now' आइटम के लिए स्टेटस 'placed' होगा
          userId
          // userId भी जोड़ें
        });
      }
      return orderResult;
    });
    getIO().emit("new-order", {
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      customerId: newOrder.customerId,
      total: newOrder.total,
      status: newOrder.status,
      // ✅ अब केवल status भेज रहा है
      createdAt: newOrder.createdAt,
      items
    });
    res.status(201).json({
      message: "Order placed successfully!",
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      data: newOrder
    });
  } catch (error) {
    console.error("\u274C Error placing Buy Now order:", error);
    res.status(500).json({ message: "Failed to place order." });
  }
};
var placeOrderFromCart = async (req, res) => {
  console.log("\u{1F680} [API] Received request to place order from cart.");
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not logged in." });
    }
    const {
      deliveryAddress: rawDeliveryAddress,
      paymentMethod,
      deliveryInstructions,
      items,
      subtotal,
      total,
      deliveryCharge
    } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Items list is empty, cannot place an order." });
    }
    const orderNumber = `ORD-${uuidv4()}`;
    const newOrder = await db.transaction(async (tx) => {
      let newDeliveryAddressId;
      const safeAddress = rawDeliveryAddress || {};
      const [newAddress] = await tx.insert(deliveryAddresses).values({
        userId,
        fullName: safeAddress.fullName || req.user?.name || "Unknown Customer",
        phoneNumber: safeAddress.phone || req.user?.phone || "0000000000",
        addressLine1: safeAddress.address || "N/A",
        addressLine2: safeAddress.landmark || "",
        city: safeAddress.city || "Unknown",
        postalCode: safeAddress.pincode || "000000",
        state: "Rajasthan"
      }).returning();
      newDeliveryAddressId = newAddress.id;
      const [orderResult] = await tx.insert(orders).values({
        customerId: userId,
        status: "pending",
        // ✅ अब केवल status का उपयोग हो रहा है
        orderNumber,
        subtotal: parseFloat(subtotal).toFixed(2),
        total: parseFloat(total).toFixed(2),
        deliveryCharge: parseFloat(deliveryCharge).toFixed(2),
        paymentMethod: paymentMethod || "COD",
        deliveryAddressId: newDeliveryAddressId,
        deliveryInstructions,
        deliveryAddress: JSON.stringify(safeAddress),
        deliveryBoyId: null
      }).returning();
      for (const item of items) {
        const [updatedItem] = await tx.update(orderItems).set({
          orderId: orderResult.id,
          status: "placed"
        }).where(and5(
          eq16(orderItems.userId, userId),
          eq16(orderItems.productId, item.productId),
          eq16(orderItems.status, "in_cart")
        )).returning();
        if (!updatedItem) {
          throw new Error("Cart item not found or already placed.");
        }
      }
      console.log("\u2705 Cart items moved to 'placed' status and associated with new order.");
      return orderResult;
    });
    getIO().emit("new-order", {
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      customerId: newOrder.customerId,
      total: newOrder.total,
      status: newOrder.status,
      // ✅ अब केवल status भेज रहा है
      createdAt: newOrder.createdAt,
      items
    });
    res.status(201).json({
      message: "Order placed successfully!",
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      data: newOrder
    });
  } catch (error) {
    console.error("\u274C Error placing cart order:", error);
    res.status(500).json({ message: "Failed to place order." });
  }
};
var getUserOrders = async (req, res) => {
  console.log("\u{1F504} [API] Received request to get user orders.");
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not logged in." });
    }
    const userOrders = await db.query.orders.findMany({
      where: eq16(orders.customerId, userId),
      with: {
        items: true
      },
      orderBy: [desc3(orders.createdAt)]
    });
    console.log(`\u2705 [API] Found ${userOrders.length} orders for user ${userId}.`);
    res.status(200).json(userOrders);
  } catch (error) {
    console.error("\u274C Error fetching user orders:", error);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
};

// routes/orderRoutes.ts
var ordersRouter = Router14();
ordersRouter.post("/", requireAuth, placeOrderFromCart);
ordersRouter.post("/buy-now", requireAuth, placeOrderBuyNow);
ordersRouter.get("/", requireAuth, getUserOrders);
var orderRoutes_default = ordersRouter;

// server/roots/admin/adminOrderRoutes.ts
import { Router as Router15 } from "express";
var adminOrdersRouter = Router15();
adminOrdersRouter.get("/", async (req, res) => {
  try {
    const allOrders = await db.query.orders.findMany({
      with: {
        seller: {
          columns: {
            businessName: true
          }
        },
        deliveryBoy: {
          columns: {
            name: true
          }
        }
      }
    });
    res.status(200).json(allOrders);
  } catch (error) {
    console.error("Failed to fetch all orders for admin:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
var adminOrderRoutes_default = adminOrdersRouter;

// server/routes.ts
var router10 = Router16();
router10.get("/", (req, res) => {
  res.status(200).json({ message: "API is running" });
});
router10.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
router10.post("/register", async (req, res) => {
  try {
    const userData = req.body;
    if (!userData.firebaseUid || !userData.email) {
      return res.status(400).json({ error: "Firebase UID and email are required." });
    }
    const [newUser] = await db.insert(users).values({
      firebaseUid: userData.firebaseUid,
      email: userData.email,
      name: userData.name || null,
      role: userRoleEnum.enumValues[0],
      approvalStatus: approvalStatusEnum.enumValues[1],
      password: userData.password || "",
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      phone: userData.phone || "",
      address: userData.address || "",
      city: userData.city || "",
      pincode: userData.pincode || ""
    }).returning();
    res.status(201).json(newUser);
  } catch (error) {
    console.error("User registration failed:", error);
    res.status(400).json({ error: error.message });
  }
});
router10.get(
  "/users/me",
  requireAuth,
  async (req, res) => {
    try {
      const userUuid = req.user?.firebaseUid;
      if (!userUuid) {
        return res.status(401).json({ error: "Not authenticated." });
      }
      let [user] = await db.select().from(users).where(eq17(users.firebaseUid, userUuid));
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
      let sellerInfo;
      if (user.role === "seller") {
        const [record] = await db.select({
          id: sellersPgTable.id,
          userId: sellersPgTable.userId,
          businessName: sellersPgTable.businessName,
          approvalStatus: sellersPgTable.approvalStatus,
          rejectionReason: sellersPgTable.rejectionReason
        }).from(sellersPgTable).where(eq17(sellersPgTable.userId, user.id));
        if (record) sellerInfo = record;
      }
      res.status(200).json({ ...user, sellerProfile: sellerInfo || null });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal error." });
    }
  }
);
router10.post("/auth/initial-login", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Firebase ID token is required." });
    }
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userUuid = decodedToken.uid;
    const email = decodedToken.email;
    const fullName = decodedToken.name;
    const [firstName, ...lastNameParts] = fullName ? fullName.split(" ") : ["", ""];
    const lastName = lastNameParts.join(" ");
    let [user] = await db.select().from(users).where(eq17(users.firebaseUid, userUuid));
    if (!user) {
      console.log("New user detected. Creating profile for Firebase UID:", userUuid);
      const [newUser] = await db.insert(users).values({
        firebaseUid: userUuid,
        email,
        password: "GOOGLE_AUTH_USER",
        firstName,
        lastName,
        phone: "",
        address: "",
        city: "",
        pincode: "",
        role: "customer",
        approvalStatus: "approved"
      }).returning();
      user = newUser;
    }
    res.status(200).json({
      user: {
        ...user,
        idToken
        // फ्रंटएंड के लिए टोकन जोड़ें
      }
    });
  } catch (error) {
    console.error("\u274C Initial login failed:", error);
    res.status(401).json({ message: "Authentication failed. Please try again." });
  }
});
router10.post("/auth/logout", async (req, res) => {
  const sessionCookie = req.cookies?.__session || "";
  res.clearCookie("__session");
  try {
    if (sessionCookie) {
      const decoded = await authAdmin.verifySessionCookie(sessionCookie);
      await authAdmin.revokeRefreshTokens(decoded.sub);
    }
    res.status(200).json({ message: "Logged out successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Logout failed." });
  }
});
router10.use("/users", userRoutes_default);
router10.use("/auth", apiAuthLogin_default);
router10.use("/cart", cartRoutes_default);
router10.use("/orders", orderRoutes_default);
router10.use("/order-confirmation", orderConfirmationRouter_default);
router10.use("/sellers", verifyToken, sellerRoutes_default);
router10.get("/categories", async (req, res) => {
  try {
    const categoriesList = await db.select().from(categories);
    res.status(200).json(categoriesList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal error." });
  }
});
router10.use("/products", productRoutes_default);
router10.use("/delivery", dBoyRoutes_default);
var adminRouter = Router16();
adminRouter.use(requireAdminAuth);
adminRouter.use("/products/approve", approve_product_default);
adminRouter.use("/products/reject", reject_product_default);
adminRouter.use("/products", products_default);
adminRouter.use("/password", admin_password_default);
adminRouter.use("/vendors", vendors_default);
adminRouter.use("/delivery-boys", admindBoyRoutes_default);
adminRouter.use("/orders", adminOrderRoutes_default);
router10.use("/admin", adminRouter);
var routes_default = router10;

// server/index.ts
import { createServer } from "http";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path2 from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var app2 = express();
var server;
var isProd = process.env.NODE_ENV === "production";
var clientURL = isProd ? process.env.CLIENT_URL || "https://shopnish-lzrf.onrender.com" : "http://localhost:5173";
app2.use(
  cors({
    origin: clientURL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  })
);
app2.use(express.json());
app2.use(express.urlencoded({ extended: false }));
app2.use(cookieParser());
async function runMigrations() {
  try {
    const migrationsPath = path2.resolve(__dirname, "migrations");
    await migrate(db, { migrationsFolder: migrationsPath });
    console.log("\u2705 Drizzle migrations completed.");
  } catch (error) {
    if (error?.code === "42P07") {
      console.warn("\u26A0\uFE0F Table already exists. Skipping migration.");
    } else {
      console.error("\u274C Migration Error:", error);
    }
  }
}
(async () => {
  await runMigrations();
  console.log("\u2705 Migrations done. Starting server...");
  app2.use((req, res, next) => {
    const start = Date.now();
    const p = req.path;
    let captured;
    const orig = res.json.bind(res);
    res.json = (body, ...rest) => {
      captured = body;
      return orig(body, ...rest);
    };
    res.on("finish", () => {
      if (!p.startsWith("/api")) return;
      const ms = Date.now() - start;
      let line = `${req.method} ${p} ${res.statusCode} in ${ms}ms`;
      if (captured) line += ` :: ${JSON.stringify(captured)}`;
      console.log(line.length > 90 ? line.slice(0, 89) + "\u2026" : line);
    });
    next();
  });
  app2.use("/api", routes_default);
  if (isProd) {
    app2.use(express.static(path2.resolve(__dirname, "..", "dist", "public")));
    app2.get("*", (req, res) => {
      res.sendFile(path2.resolve(__dirname, "..", "dist", "public", "index.html"));
    });
  } else {
    app2.get("", (req, res) => {
      if (!req.path.startsWith("/api")) {
        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Redirecting...</title>
              <meta http-equiv="refresh" content="0; url=http://0.0.0.0:5173${req.path}">
            </head>
            <body>
              <script>window.location.href = 'http://0.0.0.0:5173${req.path}'</script>
            </body>
          </html>
        `);
      } else {
        res.status(404).json({ error: "API route not found" });
      }
    });
  }
  app2.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("\u274C Server Error:", err);
    res.status(status).json({ message });
  });
  const port = process.env.PORT || 5001;
  server = createServer(app2);
  initSocket(server);
  server.listen(
    { port, host: "0.0.0.0" },
    () => console.log(
      `\u{1F680} Server listening on port ${port} in ${isProd ? "production" : "development"} mode`
    )
  );
})();
