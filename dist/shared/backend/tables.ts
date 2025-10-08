import { pgTable, text, serial, integer, decimal, boolean, timestamp, json, pgEnum } from "drizzle-orm/pg-core";


export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup', 
  'picked_up', 
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rejected',
  'in_cart',
]);

export const userRoleEnum = pgEnum("user_role", ["customer", "seller", "admin", "delivery-boy"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

// ✅ Updated and cleaned up for clarity
export const deliveryStatusEnum = pgEnum("delivery_status_enum", [
  "pending", 
  "accepted", 
  "out_for_delivery", 
  "delivered"
]);




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
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
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
  createdAt: timestamp("created_at").defaultNow(),
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
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow(),
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
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});


export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),

  // Unique Order Number
  orderNumber: text("order_number").notNull(),

  // Relations
  customerId: integer("customer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // ✅ 'sellerId' कॉलम जोड़ा गया
  sellerId: integer("seller_id")
    .notNull()
    .references(() => sellersPgTable.id, { onDelete: "cascade" }),

  deliveryBoyId: integer("delivery_boy_id")
    .references(() => deliveryBoys.id, { onDelete: "set null" }),

  deliveryAddressId: integer("delivery_address_id")
    .notNull()
    .references(() => deliveryAddresses.id, { onDelete: "cascade" }),

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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  sellerId: integer("seller_id").references(() => sellersPgTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum('status').default('in_cart'),
});

export const orderTracking = pgTable("order_tracking", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  status: text("status").notNull(),
  message: text("message"),
  messageHindi: text("message_hindi"),
  location: text("location"),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

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
export const reviews = pgTable("reviews", {
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
  createdAt: timestamp("created_at").defaultNow(),
});

