import { z } from "zod";
import {
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  deliveryAddresses, orders, orderItems, orderTracking, promoCodes, serviceCategories,
  services, serviceProviders, serviceBookings, reviews,masterProducts, userRoleEnum, approvalStatusEnum,
  subOrders,deliveryBatches,couponsPgTable,homeLayout,adminSettings,wallets,walletTransactions,productHistory,notifications,masterOrderStatusEnum, subOrderStatusEnum,
  paymentMethodEnum, discountTypeEnum, couponScopeEnum,productCategoryEnum,deliveryStatusEnum,sectionTypeEnum
} from './tables';

import {
  usersRelations, sellersRelations, storesRelations, categoriesRelations, productsRelations,
  deliveryBoysRelations, cartItemsRelations, deliveryAddressesRelations, ordersRelations,
  orderItemsRelations,  promoCodesRelations, serviceCategoriesRelations,
  servicesRelations, serviceProvidersRelations, serviceBookingsRelations, reviewsRelations, couponRelations, subOrdersRelations,deliveryBatchesRelations
//orderTrackingRelations,
} from './relations';

import {
  insertUserSchema, insertSellerSchema, updateSellerSchema, insertStoreSchema, insertCategorySchema,
  insertProductSchema, insertDeliveryAreaSchema, insertDeliveryBoySchema, insertCartItemSchema,
  insertDeliveryAddressSchema, insertOrderSchema, insertOrderItemSchema, insertOrderTrackingSchema,
  insertPromoCodeSchema, insertServiceCategorySchema, insertServiceSchema, insertServiceProviderSchema,
  insertServiceBookingSchema, insertReviewSchema,insertSubOrderSchema, insertDeliveryBatchesSchema, insertCouponsPgTableSchema,
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
    paymentMethod: string; 
  paymentStatus: string; 
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
    paymentMethod: string; 
  paymentStatus: string; 
  };
  deliveryBoy?: {   // 👈 यह हिस्सा जोड़ें
    name: string;
    phone?: string;
    id: number;
  } | null;
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

  // Payment related properties (optional)
  paymentMethod?: string;
  paymentStatus?: string;

  // Total price, optional if sometimes missing
  total?: number;
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
  services, serviceProviders, serviceBookings, reviews,masterProducts, userRoleEnum, approvalStatusEnum,
  subOrders, deliveryBatches, couponsPgTable, adminSettings,walletTransactions,wallets,masterOrderStatusEnum, subOrderStatusEnum, paymentMethodEnum, discountTypeEnum, couponScopeEnum,notifications,
productCategoryEnum,deliveryStatusEnum,sectionTypeEnum, homeLayout,productHistory,
  // Relations
  usersRelations, sellersRelations, storesRelations, categoriesRelations, productsRelations,
  deliveryBoysRelations, cartItemsRelations, deliveryAddressesRelations, ordersRelations,
  orderItemsRelations,  promoCodesRelations, serviceCategoriesRelations,
  servicesRelations, serviceProvidersRelations, serviceBookingsRelations, reviewsRelations,couponRelations,subOrdersRelations,deliveryBatchesRelations,
//orderTrackingRelations,
  // Schemas
  insertUserSchema, insertSellerSchema, updateSellerSchema, insertStoreSchema, insertCategorySchema,
  insertProductSchema, insertDeliveryAreaSchema, insertDeliveryBoySchema, insertCartItemSchema,
  insertDeliveryAddressSchema, insertOrderSchema, insertOrderItemSchema, insertOrderTrackingSchema,
  insertPromoCodeSchema, insertServiceCategorySchema, insertServiceSchema, insertServiceProviderSchema,
  insertServiceBookingSchema, insertReviewSchema,
insertSubOrderSchema, insertDeliveryBatchesSchema, insertCouponsPgTableSchema,
  
};
// backend/src/shared/backend/schema.ts के बिल्कुल अंत में जोड़ें:

export const schema = {
  // Tables
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  deliveryAddresses, orders, orderItems, orderTracking, promoCodes, serviceCategories,
  services, serviceProviders, serviceBookings, reviews, subOrders, deliveryBatches, couponsPgTable,walletTransactions,wallets,homeLayout,adminSettings,masterOrderStatusEnum, subOrderStatusEnum, paymentMethodEnum, discountTypeEnum, couponScopeEnum,productHistory,notifications,
  
  // Relations - 🔥 यह सबसे ज़रूरी हिस्सा है!
  usersRelations, sellersRelations, storesRelations, categoriesRelations, productsRelations,
  deliveryBoysRelations, cartItemsRelations, deliveryAddressesRelations, ordersRelations,
  orderItemsRelations,  promoCodesRelations, serviceCategoriesRelations,
  servicesRelations, serviceProvidersRelations, serviceBookingsRelations, reviewsRelations, 
  couponRelations, subOrdersRelations, deliveryBatchesRelations
//orderTrackingRelations,
};
