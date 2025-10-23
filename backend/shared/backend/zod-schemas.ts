// backend/src/shared/backend/zod-schemas.ts

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  orders, orderItems, orderTracking, promoCodes, serviceCategories, services, serviceProviders,
  serviceBookings, reviews, deliveryAddresses, subOrders, deliveryBatches, couponsPgTable
} from './tables'; // 'couponsPgTables' को 'couponsPgTable' में बदला गया

// --- Zod Schemas for Validation ---

export const insertUserSchema = createInsertSchema(users, {
  // firebaseUid Drizzle में unique है लेकिन Zod में वैकल्पिक हो सकता है अगर इसे बाद में जोड़ा जाए
  firebaseUid: z.string().optional().nullable(),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  // Drizzle में default है, इसलिए Zod में optional
  role: z.enum(users.role.enumValues).optional(),
  approvalStatus: z.enum(users.approvalStatus.enumValues).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
  welcomeMessageSent: z.boolean().optional(),
}).omit({
  id: true, // serial ID
  createdAt: true, // defaultNow
  updatedAt: true, // defaultNow
  lastActivityAt: true, // defaultNow
});

export const insertSellerSchema = createInsertSchema(sellersPgTable, {
  userId: z.number().int(),
  businessPhone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  deliveryRadius: z.number().int().min(1, "Delivery Radius must be at least 1 km").optional().nullable(),
  latitude: z.number().optional().nullable(), // Decimal $type<number>
  longitude: z.number().optional().nullable(), // Decimal $type<number>
  deliveryPincodes: z.array(z.string()).optional().nullable(), // text array
  isDistanceBasedDelivery: z.boolean().optional(),
  approvalStatus: z.enum(sellersPgTable.approvalStatus.enumValues).optional(),
  approvedAt: z.string().datetime().optional().nullable(), // timestamp string
  rejectionReason: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// यह स्कीमा PATCH/PUT ऑपरेशन के लिए है
export const updateSellerSchema = insertSellerSchema.partial().extend({
    // ये optional और nullable हैं Drizzle स्कीमा में
    description: z.string().optional().nullable(),
    gstNumber: z.string().optional().nullable(),
    bankAccountNumber: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    deliveryRadius: z.number().int().min(1).nullable().optional(),
}).omit({
    // userId को omit करें क्योंकि इसे update नहीं किया जाएगा
    userId: true,
    // applicationDate Drizzle स्कीमा में नहीं है, इसे हटा दिया
    // approvalStatus को update किया जा सकता है, इसलिए इसे omit से हटाया
});

export const insertStoreSchema = createInsertSchema(stores, {
  sellerId: z.number().int(),
  storeName: z.string().min(1, "Store name is required"),
  storeType: z.string().min(1, "Store type is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  isActive: z.boolean().optional(),
  licenseNumber: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(), // Decimal $type<number>
  longitude: z.number().optional().nullable(), // Decimal $type<number>
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories, {
  name: z.string().min(1, "Category name is required"),
  nameHindi: z.string().optional().nullable(),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
}).omit({
  id: true,
});

export const insertSubOrderSchema = createInsertSchema(subOrders, {
  masterOrderId: z.number().int(),
  subOrderNumber: z.string().min(1, "Sub order number is required"),
  sellerId: z.number().int(),
  storeId: z.number().int().optional().nullable(),
  status: z.enum(subOrders.status.enumValues).optional(),
  subtotal: z.number(), // Decimal $type<number>
  deliveryCharge: z.number().optional(), // Decimal $type<number> with default
  total: z.number(), // Decimal $type<number>
  estimatedPreparationTime: z.string().optional().nullable(),
  isSelfDeliveryBySeller: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliveryBatchesSchema = createInsertSchema(deliveryBatches, {
  masterOrderId: z.number().int(),
  deliveryBoyId: z.number().int().optional().nullable(),
  customerDeliveryAddressId: z.number().int(),
  status: z.enum(deliveryBatches.status.enumValues).optional(),
  estimatedDeliveryTime: z.string().datetime().optional().nullable(), // timestamp string
  actualDeliveryTime: z.string().datetime().optional().nullable(), // timestamp string
  deliveryOtp: z.string().optional().nullable(),
  deliveryOtpSentAt: z.string().datetime().optional().nullable(), // timestamp string
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCouponsPgTableSchema = createInsertSchema(couponsPgTable, {
  code: z.string().min(1, "Coupon code is required"),
  description: z.string().optional().nullable(),
  discountType: z.enum(couponsPgTable.discountType.enumValues),
  discountValue: z.number(), // Decimal $type<number>
  minOrderValue: z.number().optional().nullable(), // Decimal $type<number>
  maxDiscountValue: z.number().optional().nullable(), // Decimal $type<number>
  usageLimit: z.number().int().optional(),
  usedCount: z.number().int().optional(),
  expiryDate: z.string().datetime().optional().nullable(), // timestamp string
  isActive: z.boolean().optional(),
  scope: z.enum(couponsPgTable.scope.enumValues).optional(),
  sellerId: z.number().int().optional().nullable(),
  productId: z.number().int().optional().nullable(),
  categoryId: z.number().int().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products, {
  sellerId: z.number().int().optional(), // Default in Drizzle, so optional here
  storeId: z.number().int().optional().nullable(),
  categoryId: z.number().int().optional().nullable(),
  name: z.string().min(1, "Product name is required"),
  nameHindi: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionHindi: z.string().optional().nullable(),
  price: z.number(), // Decimal $type<number>
  originalPrice: z.number().optional().nullable(), // Decimal $type<number>
  image: z.string().url("Must be a valid URL"),
  images: z.array(z.string().url("Must be a valid URL")).optional().nullable(),
  unit: z.string().optional(), // Default in Drizzle
  brand: z.string().optional().nullable(),
  stock: z.number().int().optional(), // Default in Drizzle
  minOrderQty: z.number().int().optional(), // Default in Drizzle
  maxOrderQty: z.number().int().optional(), // Default in Drizzle
  isActive: z.boolean().optional(),
  deliveryScope: z.string().optional(), // Default in Drizzle
  productDeliveryPincodes: z.array(z.string()).optional().nullable(), // text array
  productDeliveryRadiusKM: z.number().int().optional().nullable(), // integer $type<number>
  estimatedDeliveryTime: z.string().optional(), // Default in Drizzle
  approvalStatus: z.enum(products.approvalStatus.enumValues).optional(),
  approvedAt: z.string().datetime().optional().nullable(), // timestamp string
  rejectionReason: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliveryAreaSchema = createInsertSchema(deliveryAreas, {
  areaName: z.string().min(1, "Area name is required"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  city: z.string().optional(), // Default in Drizzle
  deliveryCharge: z.number(), // Decimal $type<number>
  freeDeliveryAbove: z.number().optional().nullable(), // Decimal $type<number>
  isActive: z.boolean().optional(),
}).omit({
  id: true,
});

export const insertDeliveryBoySchema = createInsertSchema(deliveryBoys, {
  firebaseUid: z.string().optional().nullable(), // Unique, but can be optional initially
  userId: z.number().int(),
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").optional().nullable(), // Drizzle में name nullable है
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits").optional().nullable(), // Drizzle में phone nullable है
  approvalStatus: z.enum(deliveryBoys.approvalStatus.enumValues).optional(),
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehicleNumber: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  aadharNumber: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
  currentLat: z.number().optional().nullable(), // Decimal
  currentLng: z.number().optional().nullable(), // Decimal
  rating: z.number().optional(), // Decimal with default
  totalDeliveries: z.number().int().optional(),
  updatedAt: z.string().datetime().optional().nullable(), // timestamp string
}).omit({
  id: true,
  createdAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems, {
  userId: z.number().int(),
  productId: z.number().int(),
  sellerId: z.number().int().optional(), // Default in Drizzle
  quantity: z.number().int().optional(), // Default in Drizzle
  priceAtAdded: z.number(), // Decimal $type<number>
  totalPrice: z.number(), // Decimal $type<number>
  sessionId: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliveryAddressSchema = createInsertSchema(deliveryAddresses, {
  userId: z.number().int(),
  fullName: z.string().min(1, "Full name is required"),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits").optional().nullable(),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional(), // Default in Drizzle
  state: z.string().min(1, "State is required"),
  postalCode: z.string().regex(/^\d{6}$/, "Postal code must be 6 digits"),
  latitude: z.number().optional().nullable(), // Decimal $type<number>
  longitude: z.number().optional().nullable(), // Decimal $type<number>
  label: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders, {
  orderNumber: z.string().min(1, "Order number is required"),
  customerId: z.number().int(),
  deliveryAddressId: z.number().int(),
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryCity: z.string().optional(), // Default in Drizzle
  deliveryState: z.string().optional(), // Default in Drizzle
  deliveryPincode: z.string().optional(), // Default in Drizzle
  deliveryLat: z.number().optional(), // Decimal $type<number> with default
  deliveryLng: z.number().optional(), // Decimal $type<number> with default
  deliveryInstructions: z.string().optional().nullable(),
  deliveryStatus: z.enum(orders.deliveryStatus.enumValues).optional(),
  deliveryOtp: z.string().optional().nullable(),
  deliveryOtpSentAt: z.string().datetime().optional().nullable(), // timestamp string
  subtotal: z.number(), // Decimal $type<number>
  total: z.number(), // Decimal $type<number>
  paymentMethod: z.enum(orders.paymentMethod.enumValues),
  paymentStatus: z.enum(orders.paymentStatus.enumValues).optional(),
  transactionId: z.string().optional().nullable(),
  estimatedDeliveryTime: z.string().datetime().optional().nullable(), // timestamp string
  actualDeliveryTime: z.string().datetime().optional().nullable(), // timestamp string
  deliveryCharge: z.number().optional(), // Decimal $type<number> with default
  promoCode: z.string().optional().nullable(),
  discount: z.number().optional(), // Decimal $type<number> with default
  status: z.enum(orders.status.enumValues).optional(),
}).omit({
  id: true,
  createdAt: true, // timestamp string
  updatedAt: true, // timestamp string
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
  subOrderId: z.number().int(),
  orderId: z.number().int(),
  sellerId: z.number().int().optional(), // Default in Drizzle
  userId: z.number().int(),
  productId: z.number().int(),
  productName: z.string().optional(), // Default in Drizzle
  productImage: z.string().url("Must be a valid URL").optional().nullable(),
  productPrice: z.number().optional(), // Decimal $type<number> with default
  productUnit: z.string().optional(), // Default in Drizzle
  quantity: z.number().int(),
  itemTotal: z.number().optional(), // Decimal $type<number> with default
  status: z.enum(orderItems.status.enumValues).optional(),
}).omit({
  id: true,
  createdAt: true, // timestamp string
  updatedAt: true, // timestamp string
});

export const insertOrderTrackingSchema = createInsertSchema(orderTracking, {
  masterOrderId: z.number().int().optional().nullable(),
  deliveryBatchId: z.number().int().optional().nullable(),
  status: z.string().min(1, "Status is required"),
  timestamp: z.string().datetime().optional(), // Default in Drizzle
  location: z.string().optional().nullable(),
  updatedBy: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
}).omit({
  id: true,
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes, {
  code: z.string().min(1, "Promo code is required"),
  discountType: z.enum(promoCodes.discountType.enumValues),
  discountValue: z.number(), // Decimal $type<number>
  minOrderValue: z.number().optional().nullable(), // Decimal $type<number>
  maxDiscountValue: z.number().optional().nullable(), // Decimal $type<number>
  usageLimit: z.number().int().optional(),
  usedCount: z.number().int().optional(),
  expiryDate: z.string().datetime().optional().nullable(), // timestamp string
  isActive: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceCategorySchema = createInsertSchema(serviceCategories, {
  name: z.string().min(1, "Service category name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional().nullable(),
  image: z.string().url("Must be a valid URL").optional().nullable(),
  isActive: z.boolean().optional(),
}).omit({
  id: true,
});

export const insertServiceSchema = createInsertSchema(services, {
  categoryId: z.number().int().optional().nullable(), // Drizzle में nullable नहीं, लेकिन references() में onDelete 'set null' नहीं है
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional().nullable(),
  price: z.number(), // Decimal $type<number>
  image: z.string().url("Must be a valid URL").optional().nullable(),
  isActive: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceProviderSchema = createInsertSchema(serviceProviders, {
  userId: z.number().int(),
  serviceId: z.number().int().optional().nullable(), // Drizzle में nullable नहीं, लेकिन references() में onDelete 'set null' नहीं है
  description: z.string().optional().nullable(),
  experienceYears: z.number().int().optional().nullable(),
  rating: z.number().optional(), // Decimal with default
  isAvailable: z.boolean().optional(),
  approvalStatus: z.enum(serviceProviders.approvalStatus.enumValues).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceBookingSchema = createInsertSchema(serviceBookings, {
  customerId: z.number().int(),
  serviceProviderId: z.number().int(),
  serviceId: z.number().int(),
  bookingDate: z.string().datetime(), // timestamp string
  status: z.string().optional(), // Default in Drizzle
  totalPrice: z.number(), // Decimal $type<number>
  notes: z.string().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews, {
  customerId: z.number().int(),
  productId: z.number().int(),
  orderId: z.number().int(),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().optional().nullable(),
  imageUrl: z.string().url("Must be a valid URL").optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

