import { relations } from 'drizzle-orm';
import {
  users, sellersPgTable, stores, categories, products, deliveryAreas, deliveryBoys, cartItems,
  deliveryAddresses, orders, orderItems, orderTracking, promoCodes, serviceCategories,
  services, serviceProviders, serviceBookings, reviews
} from './tables';

// --- Drizzle ORM Relations ---

export const usersRelations = relations(users, ({ one, many }) => ({
  sellerProfile: one(sellersPgTable, {
    fields: [users.id],
    references: [sellersPgTable.userId],
  }),
  orders: many(orders),
  reviews: many(reviews),
  serviceProviders: many(serviceProviders),
  serviceBookings: many(serviceBookings),
  cartItems: many(cartItems),
}));

export const sellersRelations = relations(sellersPgTable, ({ one, many }) => ({
  user: one(users, {
    fields: [sellersPgTable.userId],
    references: [users.id],
  }),
  products: many(products),
  stores: many(stores),
  orderItems: many(orderItems),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  seller: one(sellersPgTable, {
    fields: [stores.sellerId],
    references: [sellersPgTable.id],
  }),
  products: many(products),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
  serviceCategories: many(serviceCategories),
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
  orderItems: many(orderItems),
  reviews: many(reviews),
}));

export const deliveryBoysRelations = relations(deliveryBoys, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryBoys.userId],
    references: [users.id],
  }),
  orders: many(orders),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const deliveryAddressesRelations = relations(deliveryAddresses, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryAddresses.userId],
    references: [users.id],
  }),
  orders: many(orders),
}));

 export const ordersRelations = relations(orders, ({ many, one }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  seller: one(sellersPgTable, {       // ✅ अब सही relation
    fields: [orders.sellerId],
    references: [sellersPgTable.id],
  }),
  deliveryBoy: one(deliveryBoys, {
    fields: [orders.deliveryBoyId],
    references: [deliveryBoys.id],
    optional: true, 
  }),
  deliveryAddress: one(deliveryAddresses, {
    fields: [orders.deliveryAddressId],
    references: [deliveryAddresses.id],
  }),
  items: many(orderItems),
  tracking: many(orderTracking),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  seller: one(sellersPgTable, {
    fields: [orderItems.sellerId],
    references: [sellersPgTable.id],
  }),
}));

export const orderTrackingRelations = relations(orderTracking, ({ one }) => ({
  order: one(orders, {
    fields: [orderTracking.orderId],
    references: [orders.id],
  }),
  updatedBy: one(users, {
    fields: [orderTracking.updatedBy],
    references: [users.id],
  }),
}));

export const promoCodesRelations = relations(promoCodes, ({ many }) => ({
  orders: many(orders),
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
  order: one(orders, {
    fields: [reviews.orderId],
    references: [orders.id],
  }),
}));
