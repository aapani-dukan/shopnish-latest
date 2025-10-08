import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  orders, orderItems, orderTracking, promoCodes, serviceCategories, services, serviceProviders,
  serviceBookings, reviews, deliveryAddresses
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

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
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
