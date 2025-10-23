import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  orders, orderItems, orderTracking, promoCodes, serviceCategories, services, serviceProviders,
  serviceBookings, reviews, deliveryAddresses, subOrders, deliveryBatches, couponsPgTables
} from './tables';

// --- Zod Schemas for Validation ---
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSellerSchema = createInsertSchema(sellersPgTable, {
  userId: z.number().int(),
  businessPhone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  deliveryRadius: z.number().int().min(1, "Delivery Radius must be at least 1 km").optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



// यह स्कीमा PATCH/PUT ऑपरेशन के लिए है
export const updateSellerSchema = insertSellerSchema.partial().extend({
    
    description: z.string().nullable().optional(),
    gstNumber: z.string().nullable().optional(),
    bankAccountNumber: z.string().nullable().optional(),
    ifscCode: z.string().nullable().optional(),
    // deliveryRadius यदि डेटाबेस में nullable है
    deliveryRadius: z.number().int().min(1).nullable().optional(), 
}).omit({ 
    
    userId: true,
    applicationDate: true,
    approvalStatus: true,
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

import { z } from "zod";
import { subOrders, deliveryBatches, couponsPgTable } from "./tables";

// -------------------
// SubOrders
// -------------------
export const insertSubOrderSchema = z.object({
  masterOrderId: z.number().int(),
  subOrderNumber: z.string(),
  sellerId: z.number().int(),
  storeId: z.number().int().optional().nullable(),
  status: z.string().optional(),
  subtotal: z.number(),
  deliveryCharge: z.number().optional().default(0),
  total: z.number(),
  estimatedPreparationTime: z.string().optional().nullable(),
  isSelfDeliveryBySeller: z.boolean().optional().default(false),
});

export const insertDeliveryBatchesSchema = z.object({
  masterOrderId: z.number().int(),
  deliveryBoyId: z.number().int().optional().nullable(),
  customerDeliveryAddressId: z.number().int(),
  status: z.string().optional(),
  estimatedDeliveryTime: z.string().optional().nullable(),
  actualDeliveryTime: z.string().optional().nullable(),
  deliveryOtp: z.string().optional().nullable(),
  deliveryOtpSentAt: z.string().optional().nullable(),
});


export const insertCouponSchema = z.object({
  code: z.string(),
  description: z.string().optional().nullable(),
  discountType: z.string(),
  discountValue: z.number(),
  minOrderValue: z.number().optional().nullable(),
  maxDiscountValue: z.number().optional().nullable(),
  usageLimit: z.number().int().optional().default(1),
  usedCount: z.number().int().optional().default(0),
  expiryDate: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  scope: z.string().optional().default("all_orders"),
  sellerId: z.number().int().optional().nullable(),
  productId: z.number().int().optional().nullable(),
  categoryId: z.number().int().optional().nullable(),
});
export const insertProductSchema = createInsertSchema(products, {
  price: z.string(),
  originalPrice: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliveryAreaSchema = createInsertSchema(deliveryAreas, {
  deliveryCharge: z.string(),
  freeDeliveryAbove: z.string().optional(),
}).omit({
  id: true,
});

export const insertDeliveryBoySchema = createInsertSchema(deliveryBoys, {
  userId: z.number().int(),
  email: z.string().email(),
  name: z.string().min(1, "Name is required"),
  rating: z.string().optional().default("5.0"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});

export const insertDeliveryAddressSchema = createInsertSchema(deliveryAddresses).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders, {
  subtotal: z.string(),
  deliveryCharge: z.string().optional(),
  discount: z.string().optional(),
  total: z.string(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems, {
  unitPrice: z.string(),
  totalPrice: z.string(),
}).omit({
  id: true,
});

export const insertOrderTrackingSchema = createInsertSchema(orderTracking).omit({
  id: true,
  createdAt: true,
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes, {
  discountValue: z.string(),
  minOrderAmount: z.string().optional(),
  maxDiscount: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertServiceCategorySchema = createInsertSchema(serviceCategories).omit({
  id: true,
});

export const insertServiceSchema = createInsertSchema(services, {
  basePrice: z.string(),
}).omit({
  id: true,
});

export const insertServiceProviderSchema = createInsertSchema(serviceProviders, {
  rating: z.string().optional().default("5.0"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertServiceBookingSchema = createInsertSchema(serviceBookings, {
  price: z.string(),
  address: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});
