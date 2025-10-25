// backend/src/shared/backend/relations.ts

import { relations } from 'drizzle-orm';
// ✅ सभी स्कीमा ऑब्जेक्ट्स को एक साथ इम्पोर्ट करें
import * as schema from './schema';

// --- Drizzle ORM Relations ---

export const usersRelations = relations(schema.users, ({ one, many }) => ({
  sellerProfile: one(schema.sellersPgTable, {
    fields: [schema.users.id],
    references: [schema.sellersPgTable.userId],
  }),
  orders: many(schema.orders),
  reviews: many(schema.reviews),
  serviceProviders: many(schema.serviceProviders),
  serviceBookings: many(schema.serviceBookings),
  cartItems: many(schema.cartItems),
}));

export const sellersRelations = relations(schema.sellersPgTable, ({ one, many }) => ({
  user: one(schema.users, {
    fields: [schema.sellersPgTable.userId],
    references: [schema.users.id],
  }),
  products: many(schema.products),
  stores: many(schema.stores),
  subOrders: many(schema.subOrders),
}));

export const storesRelations = relations(schema.stores, ({ one, many }) => ({
  seller: one(schema.sellersPgTable, {
    fields: [schema.stores.sellerId],
    references: [schema.sellersPgTable.id],
  }),
  products: many(schema.products),
  subOrders: many(schema.subOrders),
}));

export const categoriesRelations = relations(schema.categories, ({ many }) => ({
  products: many(schema.products),
}));

export const productsRelations = relations(schema.products, ({ one, many }) => ({
  seller: one(schema.sellersPgTable, {
    fields: [schema.products.sellerId],
    references: [schema.sellersPgTable.id],
  }),
  store: one(schema.stores, {
    fields: [schema.products.storeId],
    references: [schema.stores.id],
  }),
  category: one(schema.categories, {
    fields: [schema.products.categoryId],
    references: [schema.categories.id],
  }),
  cartItems: many(schema.cartItems),
  orderItems: many(schema.orderItems),
  reviews: many(schema.reviews),
}));

export const deliveryBoysRelations = relations(schema.deliveryBoys, ({ one, many }) => ({
  user: one(schema.users, {
    fields: [schema.deliveryBoys.userId],
    references: [schema.users.id],
  }),
  deliveryBatches: many(schema.deliveryBatches),
}));

export const couponRelations = relations(schema.couponsPgTable, ({ one }) => ({
  seller: one(schema.sellersPgTable, { fields: [schema.couponsPgTable.sellerId], references: [schema.sellersPgTable.id] }),
  product: one(schema.products, { fields: [schema.couponsPgTable.productId], references: [schema.products.id] }),
  category: one(schema.categories, { fields: [schema.couponsPgTable.categoryId], references: [schema.categories.id] }),
}));

export const cartItemsRelations = relations(schema.cartItems, ({ one }) => ({
  user: one(schema.users, {
   fields: [schema.cartItems.userId],
   references: [schema.users.id],
 }),
 product: one(schema.products, { // ✅ यहाँ भी schema.products का उपयोग करें
   fields: [schema.cartItems.productId],
    references: [schema.products.id],
 }),
 seller: one(schema.sellersPgTable, {
    fields: [schema.cartItems.sellerId],
    references: [schema.sellersPgTable.id],
  }),
 }));

export const deliveryAddressesRelations = relations(schema.deliveryAddresses, ({ one, many }) => ({
  user: one(schema.users, {
    fields: [schema.deliveryAddresses.userId],
    references: [schema.users.id],
  }),
  orders: many(schema.orders),
  deliveryBatches: many(schema.deliveryBatches),
}));

export const ordersRelations = relations(schema.orders, ({ many, one }) => ({
  customer: one(schema.users, {
    fields: [schema.orders.customerId],
    references: [schema.users.id],
  }),
  deliveryAddress: one(schema.deliveryAddresses, {
    fields: [schema.orders.deliveryAddressId],
    references: [schema.deliveryAddresses.id],
  }),
  subOrders: many(schema.subOrders),
  deliveryBatches: many(schema.deliveryBatches),
  tracking: many(schema.orderTracking),
  reviews: many(schema.reviews),
  orderItems: many(schema.orderItems),
}));

export const subOrdersRelations = relations(schema.subOrders, ({ one, many }) => ({
  masterOrder: one(schema.orders, {
    fields: [schema.subOrders.masterOrderId],
    references: [schema.orders.id],
  }),
  seller: one(schema.sellersPgTable, {
    fields: [schema.subOrders.sellerId],
    references: [schema.sellersPgTable.id],
  }),
  store: one(schema.stores, {
    fields: [schema.subOrders.storeId],
    references: [schema.stores.id],
  }),
  orderItems: many(schema.orderItems, {
    
    relationName: 'orderItems',
  }),
  deliveryBatch: one(schema.deliveryBatches, {
    fields: [schema.subOrders.deliveryBatchId],
   references: [schema.deliveryBatches.id],
    
  }),
  
 }));

export const deliveryBatchesRelations = relations(schema.deliveryBatches, ({ one, many }) => ({
    masterOrder: one(schema.orders, {
        fields: [schema.deliveryBatches.masterOrderId],
        references: [schema.orders.id],
    }),
    deliveryBoy: one(schema.deliveryBoys, {
        fields: [schema.deliveryBatches.deliveryBoyId],
        references: [schema.deliveryBoys.id],
     //   optional: true,
    }),
    customerDeliveryAddress: one(schema.deliveryAddresses, {
        fields: [schema.deliveryBatches.customerDeliveryAddressId],
        references: [schema.deliveryAddresses.id],
    }),
    subOrders: many(schema.subOrders),
}));

export const orderItemsRelations = relations(schema.orderItems, ({ one }) => ({
  subOrder: one(schema.subOrders, {
    fields: [schema.orderItems.subOrderId],
    references: [schema.subOrders.id],
  }),
  product: one(schema.products, {
    fields: [schema.orderItems.productId],
    references: [schema.products.id],
  }),
}));

export const orderTrackingRelations = relations(schema.orderTracking, ({ one }) => ({
  masterOrder: one(schema.orders, {
    fields: [schema.orderTracking.masterOrderId],
    references: [schema.orders.id],
   // optional: true,
  }),
  deliveryBatch: one(schema.deliveryBatches, {
    fields: [schema.orderTracking.deliveryBatchId],
    references: [schema.deliveryBatches.id],
  //  optional: true,
  }),
  updatedBy: one(schema.users, {
    fields: [schema.orderTracking.updatedBy],
    references: [schema.users.id],
  }),
}));

export const promoCodesRelations = relations(schema.promoCodes, ({ many }) => ({
  // orders: many(schema.orders),
}));

export const serviceCategoriesRelations = relations(schema.serviceCategories, ({ many }) => ({
  services: many(schema.services),
}));

export const servicesRelations = relations(schema.services, ({ one, many }) => ({
  category: one(schema.serviceCategories, {
    fields: [schema.services.categoryId],
    references: [schema.serviceCategories.id],
  }),
  serviceProviders: many(schema.serviceProviders),
  serviceBookings: many(schema.serviceBookings),
}));

export const serviceProvidersRelations = relations(schema.serviceProviders, ({ one, many }) => ({
  user: one(schema.users, {
    fields: [schema.serviceProviders.userId],
    references: [schema.users.id],
  }),
  service: one(schema.services, {
    fields: [schema.serviceProviders.serviceId],
    references: [schema.services.id],
  }),
  serviceBookings: many(schema.serviceBookings),
}));

export const serviceBookingsRelations = relations(schema.serviceBookings, ({ one }) => ({
  customer: one(schema.users, {
    fields: [schema.serviceBookings.customerId],
    references: [schema.users.id],
  }),
  serviceProvider: one(schema.serviceProviders, {
    fields: [schema.serviceBookings.serviceProviderId],
    references: [schema.serviceProviders.id],
  }),
  service: one(schema.services, {
    fields: [schema.serviceBookings.serviceId],
    references: [schema.services.id],
  }),
}));

export const reviewsRelations = relations(schema.reviews, ({ one }) => ({
  customer: one(schema.users, {
    fields: [schema.reviews.customerId],
    references: [schema.users.id],
  }),
  product: one(schema.products, {
    fields: [schema.reviews.productId],
    references: [schema.products.id],
  }),
  order: one(schema.orders, {
    fields: [schema.reviews.orderId],
    references: [schema.orders.id],
  }), 
})); 
