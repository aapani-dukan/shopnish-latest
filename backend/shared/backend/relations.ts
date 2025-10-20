// backend/src/shared/backend/relations.ts

import { relations } from 'drizzle-orm';
import {
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  deliveryAddresses, orders, subOrders, deliveryBatches, orderItems, orderTracking, promoCodes, serviceCategories,
  services, serviceProviders, serviceBookings, reviews // ✅ subOrders और deliveryBatches को इम्पोर्ट करें
} from './schema'; // ✅ अब 'tables' की जगह 'schema' होना चाहिए अगर सभी टेबल एक ही फ़ाइल में हैं

// --- Drizzle ORM Relations ---

export const usersRelations = relations(users, ({ one, many }) => ({
  sellerProfile: one(sellersPgTable, {
    fields: [users.id],
    references: [sellersPgTable.userId],
  }),
  orders: many(orders), // ✅ Master Orders
  reviews: many(reviews),
  serviceProviders: many(serviceProviders),
  serviceBookings: many(serviceBookings),
  cartItems: many(cartItems),
  // deliveryBoys: many(deliveryBoys), // यदि user भी deliveryBoys हो सकता है तो यह पहले से है
}));

export const sellersRelations = relations(sellersPgTable, ({ one, many }) => ({
  user: one(users, {
    fields: [sellersPgTable.userId],
    references: [users.id],
  }),
  products: many(products),
  stores: many(stores),
  subOrders: many(subOrders), // ✅ NEW: अब seller subOrders से लिंक होगा
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  seller: one(sellersPgTable, {
    fields: [stores.sellerId],
    references: [sellersPgTable.id],
  }),
  products: many(products),
  subOrders: many(subOrders), // ✅ NEW: स्टोर subOrders से लिंक होगा
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
  // serviceCategories: many(serviceCategories), // ✅ यदि categories और serviceCategories के बीच सीधा संबंध है तो यह ठीक है
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(sellersPgTable, {
    fields: [products.sellerId],
    references: [sellersPgTable.id],
  }),
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems), // ✅ orderItems अभी भी product से लिंक होगा
  reviews: many(reviews),
}));

export const deliveryBoysRelations = relations(deliveryBoys, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryBoys.userId],
    references: [users.id],
  }),
  deliveryBatches: many(deliveryBatches), // ✅ NEW: डिलीवरी बॉय deliveryBatches से लिंक होगा
}));

export const cartItemRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  seller: one(sellersPgTable, {
    fields: [cartItems.sellerId],
    references: [sellersPgTable.id],
  }),
}));

export const deliveryAddressesRelations = relations(deliveryAddresses, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryAddresses.userId],
    references: [users.id],
  }),
  orders: many(orders), // ✅ Master Orders
  deliveryBatches: many(deliveryBatches), // ✅ NEW: डिलीवरी एड्रेस deliveryBatches से लिंक होगा
}));

// =========================================================================
// NEW/UPDATED Order & Delivery Relations
// =========================================================================

export const ordersRelations = relations(orders, ({ many, one }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  // ✅ REMOVED: orders.seller, orders.deliveryBoy
  deliveryAddress: one(deliveryAddresses, {
    fields: [orders.deliveryAddressId],
    references: [deliveryAddresses.id],
  }),
  subOrders: many(subOrders),       // ✅ NEW: मास्टर ऑर्डर के कई सब-ऑर्डर
  deliveryBatches: many(deliveryBatches), // ✅ NEW: मास्टर ऑर्डर के कई डिलीवरी बैच
  tracking: many(orderTracking),    // ✅ Master Order tracking
  reviews: many(reviews),           // ✅ Master Order reviews
}));

export const subOrdersRelations = relations(subOrders, ({ one, many }) => ({ // ✅ NEW: subOrders Relations
  masterOrder: one(orders, {
    fields: [subOrders.masterOrderId],
    references: [orders.id],
  }),
  seller: one(sellersPgTable, {
    fields: [subOrders.sellerId],
    references: [sellersPgTable.id],
  }),
  store: one(stores, {
    fields: [subOrders.storeId],
    references: [stores.id],
  }),
  deliveryBatch: one(deliveryBatches, { // ✅ NEW: subOrder एक deliveryBatch से लिंक होगा
    fields: [subOrders.deliveryBatchId],
    references: [deliveryBatches.id],
    optional: true, // क्योंकि self-delivery वाले subOrder का कोई batch नहीं होगा
  }),
  orderItems: many(orderItems), // एक सब-ऑर्डर के कई आइटम
}));

export const deliveryBatchesRelations = relations(deliveryBatches, ({ one, many }) => ({ // ✅ NEW: deliveryBatches Relations
    masterOrder: one(orders, {
        fields: [deliveryBatches.masterOrderId],
        references: [orders.id],
    }),
    deliveryBoy: one(deliveryBoys, {
        fields: [deliveryBatches.deliveryBoyId],
        references: [deliveryBoys.id],
        optional: true, // क्योंकि बैच को तुरंत डिलीवरी बॉय असाइन नहीं किया जा सकता
    }),
    customerDeliveryAddress: one(deliveryAddresses, {
        fields: [deliveryBatches.customerDeliveryAddressId],
        references: [deliveryAddresses.id],
    }),
    subOrders: many(subOrders), // एक बैच में कई सब-ऑर्डर
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  subOrder: one(subOrders, { // ✅ UPDATED: orderItems अब subOrder से लिंक होगा
    fields: [orderItems.subOrderId],
    references: [subOrders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  // ✅ REMOVED: orderItems.seller (क्योंकि subOrder पहले से ही seller को संदर्भित करता है)
}));

export const orderTrackingRelations = relations(orderTracking, ({ one }) => ({
  masterOrder: one(orders, { // ✅ UPDATED: masterOrder से लिंक
    fields: [orderTracking.masterOrderId],
    references: [orders.id],
    optional: true, // यदि केवल deliveryBatch को ट्रैक करना है
  }),
  deliveryBatch: one(deliveryBatches, { // ✅ NEW: deliveryBatch से लिंक
    fields: [orderTracking.deliveryBatchId],
    references: [deliveryBatches.id],
    optional: true, // यदि केवल masterOrder को ट्रैक करना है
  }),
  updatedBy: one(users, {
    fields: [orderTracking.updatedBy],
    references: [users.id],
  }),
}));

// =========================================================================
// Other Existing Relations (कोई बड़ा बदलाव नहीं)
// =========================================================================

export const promoCodesRelations = relations(promoCodes, ({ many }) => ({
  // orders: many(orders), // ✅ यदि promoCodes सीधे orders से लिंक होते हैं
}));

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
  serviceProviders: many(serviceProviders),
  serviceBookings: many(serviceBookings),
}));

export const serviceProvidersRelations = relations(serviceProviders, ({ one, many }) => ({
  user: one(users, {
    fields: [serviceProviders.userId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [serviceProviders.serviceId],
    references: [services.id],
  }),
  serviceBookings: many(serviceBookings),
}));

export const serviceBookingsRelations = relations(serviceBookings, ({ one }) => ({
  customer: one(users, {
    fields: [serviceBookings.customerId],
    references: [users.id],
  }),
  serviceProvider: one(serviceProviders, {
    fields: [serviceBookings.serviceProviderId],
    references: [serviceProviders.id],
  }),
  service: one(services, {
    fields: [serviceBookings.serviceId],
    references: [services.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  customer: one(users, {
    fields: [reviews.customerId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  order: one(orders, { // ✅ Master Order से लिंक
    fields: [reviews.orderId],
    references: [orders.id],
  }),
  // ✅ यदि deliveryBoyId भी रिव्यू में है, तो उसका भी रिलेशन यहाँ जोड़ें
   deliveryBoy: one(deliveryBoys, {
     fields: [reviews.deliveryBoyId],
    references: [deliveryBoys.id],
     optional: true,
   }),
  deliveryAddress: one(deliveryAddresses, {
     fields: [reviews.deliveryAddressId],
  /l   references: [deliveryAddresses.id],
    optional: true,
   }),
}));
