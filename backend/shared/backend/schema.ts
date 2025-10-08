import { z } from "zod";
import {
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  deliveryAddresses, orders, orderItems, orderTracking, promoCodes, serviceCategories,
  services, serviceProviders, serviceBookings, reviews, userRoleEnum, approvalStatusEnum,
  orderStatusEnum
} from './tables';

import {
  usersRelations, sellersRelations, storesRelations, categoriesRelations, productsRelations,
  deliveryBoysRelations, cartItemsRelations, deliveryAddressesRelations, ordersRelations,
  orderItemsRelations, orderTrackingRelations, promoCodesRelations, serviceCategoriesRelations,
  servicesRelations, serviceProvidersRelations, serviceBookingsRelations, reviewsRelations
} from './relations';

import {
  insertUserSchema, insertSellerSchema, updateSellerSchema, insertStoreSchema, insertCategorySchema,
  insertProductSchema, insertDeliveryAreaSchema, insertDeliveryBoySchema, insertCartItemSchema,
  insertDeliveryAddressSchema, insertOrderSchema, insertOrderItemSchema, insertOrderTrackingSchema,
  insertPromoCodeSchema, insertServiceCategorySchema, insertServiceSchema, insertServiceProviderSchema,
  insertServiceBookingSchema, insertReviewSchema
} from './zod-schemas';

// --- Types ---
export type OrderItemWithProduct = {
  id: number;
  orderId: number;
  productId: number;
  sellerId: number;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: {
    id: number;
    name: string;
    nameHindi?: string;
    description?: string;
    descriptionHindi?: string;
    price: string;
    image: string;
    unit: string;
    brand?: string;
    stock: number;
  };
};

export type OrderWithItems = {
  id: number;
  orderNumber: string;
  subtotal: string;
  total: string;
  status: string;
  createdAt: string;
  customer: {
    id: number;
    name: string;
    email: string;
  };
  items: OrderItemWithProduct[];
};
export type OrderWithDeliveryBoy = OrderWithItems & {
  // 1. डिलीवरी बॉय की जानकारी (deliveryBoyId के साथ joined)
  deliveryBoy?: {
    id: number;
    name: string | null;
    phone: string | null;
  } | null;

  // 2. डिलीवरी एड्रेस की पूरी जानकारी (deliveryAddressId के साथ joined)
  deliveryAddress?: {
    id: number;
    userId: number | null;
    fullName: string;
    phoneNumber: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    isDefault: boolean | null;
    createdAt: string | null;
  } | null;

  // 3. डिलीवरी स्टेटस और सेलर ID (ऑर्डर टेबल से)
  deliveryStatus: typeof deliveryStatusEnum.enumValues[number];
  sellerId: number; 
};

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Seller = typeof sellersPgTable.$inferSelect;
export type InsertSeller = z.infer<typeof insertSellerSchema>;

export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type DeliveryArea = typeof deliveryAreas.$inferSelect;
export type InsertDeliveryArea = z.infer<typeof insertDeliveryAreaSchema>;

export type DeliveryBoy = typeof deliveryBoys.$inferSelect;
export type InsertDeliveryBoy = z.infer<typeof insertDeliveryBoySchema>;

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

export type DeliveryAddress = typeof deliveryAddresses.$inferSelect;
export type InsertDeliveryAddress = z.infer<typeof insertDeliveryAddressSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type OrderTracking = typeof orderTracking.$inferSelect;
export type InsertOrderTracking = z.infer<typeof insertOrderTrackingSchema>;

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type ServiceProvider = typeof serviceProviders.$inferSelect;
export type InsertServiceProvider = z.infer<typeof insertServiceProviderSchema>;

export type ServiceBooking = typeof serviceBookings.$inferSelect;
export type InsertServiceBooking = z.infer<typeof insertServiceBookingSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

// --- Exports ---
export {
  // Tables
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  deliveryAddresses, orders, orderItems, orderTracking, promoCodes, serviceCategories,
  services, serviceProviders, serviceBookings, reviews, userRoleEnum, approvalStatusEnum,
  orderStatusEnum,

  // Relations
  usersRelations, sellersRelations, storesRelations, categoriesRelations, productsRelations,
  deliveryBoysRelations, cartItemsRelations, deliveryAddressesRelations, ordersRelations,
  orderItemsRelations, orderTrackingRelations, promoCodesRelations, serviceCategoriesRelations,
  servicesRelations, serviceProvidersRelations, serviceBookingsRelations, reviewsRelations,

  // Schemas
  insertUserSchema, insertSellerSchema, updateSellerSchema, insertStoreSchema, insertCategorySchema,
  insertProductSchema, insertDeliveryAreaSchema, insertDeliveryBoySchema, insertCartItemSchema,
  insertDeliveryAddressSchema, insertOrderSchema, insertOrderItemSchema, insertOrderTrackingSchema,
  insertPromoCodeSchema, insertServiceCategorySchema, insertServiceSchema, insertServiceProviderSchema,
  insertServiceBookingSchema, insertReviewSchema,

  // Types
  OrderItemWithProduct, OrderWithItems, User, InsertUser, Seller, InsertSeller, Store, InsertStore,
  Category, InsertCategory, Product, InsertProduct, DeliveryArea, InsertDeliveryArea, DeliveryBoy,
  InsertDeliveryBoy, CartItem, InsertCartItem, DeliveryAddress, InsertDeliveryAddress, Order, InsertOrder,
  OrderItem, InsertOrderItem, OrderTracking, InsertOrderTracking, PromoCode, InsertPromoCode,
  ServiceCategory, InsertServiceCategory, Service, InsertService, ServiceProvider, InsertServiceProvider,
  ServiceBooking, InsertServiceBooking, Review, InsertReview
};
