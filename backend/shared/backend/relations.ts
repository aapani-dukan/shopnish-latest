// backend/src/shared/backend/relations.ts

import { relations } from 'drizzle-orm';
// ✅ सभी स्कीमा ऑब्जेक्ट्स को एक साथ इम्पोर्ट करें
import { 
  users, sellersPgTable, orders, reviews, serviceProviders, 
  serviceBookings, cartItems, stores, products,productVariants, categories, 
  deliveryBoys, couponsPgTable, deliveryAddresses, subOrders, 
  deliveryBatches, orderItems, orderTracking, promoCodes, 
  serviceCategories, services,categorySubcategories,productSubcategories,subcategories,masterProducts 
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
  category: one(categories, {
    fields: [sellersPgTable.categoryId], // चेक करें कि आपकी टेबल में categoryId कॉलम है
    references: [categories.id],
  }),
  products: many(products),
  stores: many(stores),
  subOrders: many(subOrders),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  seller: one(sellersPgTable, {
    fields: [stores.sellerId],
    references: [sellersPgTable.id],
  }),
  products: many(products),
  subOrders: many(subOrders),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  shops: many(sellersPgTable),
  products: many(products),
   categorySubcategories: many(categorySubcategories),
   subCategories: many(categorySubcategories),
}));
export const subcategoriesRelations = relations(subcategories, ({ many }) => ({
  categoryMappings: many(categorySubcategories),
  productMappings: many(productSubcategories),
}));
export const categorySubcategoriesRelations = relations(
  categorySubcategories,
  ({ one }) => ({
    category: one(categories, {
      fields: [categorySubcategories.categoryId],
      references: [categories.id],
    }),

    subcategory: one(subcategories, {
      fields: [categorySubcategories.subCategoryId],
      references: [subcategories.id],
    }),
  })
);
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
  masterProduct: one(masterProducts, {
  fields: [products.masterProductId],
  references: [masterProducts.id],
}),
  variants: many(productVariants),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
  reviews: many(reviews),
}));
export const productSubcategoriesRelations = relations(
  productSubcategories,
  ({ one }) => ({
    product: one(masterProducts, {
      fields: [productSubcategories.masterProductId],
      references: [masterProducts.id],
    }),

    subcategory: one(subcategories, {
      fields: [productSubcategories.subCategoryId],
      references: [subcategories.id],
    }),
  })
);
export const masterProductsRelations = relations(masterProducts, ({ one, many }) => ({
  category: one(categories, {
    fields: [masterProducts.categoryId],
    references: [categories.id],
  }),
productSubcategories: many(productSubcategories),
products: many(products),
  subCategory: one(subcategories, {
    fields: [masterProducts.subCategoryId],
    references: [subcategories.id],
    
  }),

 
}));
export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));
export const deliveryBoysRelations = relations(deliveryBoys, ({ one, many }) => ({
  user: one(users, {
    fields: [deliveryBoys.userId],
    references: [users.id],
  }),
  deliveryBatches: many(deliveryBatches),
}));

export const couponRelations = relations(couponsPgTable, ({ one }) => ({
  seller: one(sellersPgTable, { fields: [couponsPgTable.sellerId], references: [sellersPgTable.id] }),
  product: one(products, { fields: [couponsPgTable.productId], references: [products.id] }),
  category: one(categories, { fields: [couponsPgTable.categoryId], references: [categories.id] }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
   fields: [cartItems.userId],
   references: [users.id],
 }),
 product: one(products, { // ✅ यहाँ भी schema.products का उपयोग करें
   fields: [cartItems.productId],
    references: [products.id],
 }),
 variant: one(productVariants, {
   fields: [cartItems.variantId],
   references: [productVariants.id],
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
  orders: many(orders),
  deliveryBatches: many(deliveryBatches),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  deliveryAddress: one(deliveryAddresses, {
    fields: [orders.deliveryAddressId],
    references: [deliveryAddresses.id],
  }),
  subOrders: many(subOrders),
  deliveryBatches: many(deliveryBatches),
  tracking: many(orderTracking),
  reviews: many(reviews),
 // orderItems: many(orderItems),
}));

export const subOrdersRelations = relations(subOrders, ({ one, many }) => ({
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

  orderItems: many(orderItems),
  deliveryBatch: one(deliveryBatches, {
    fields: [subOrders.deliveryBatchId],
   references: [deliveryBatches.id],
    
  }),
  
 }));

export const deliveryBatchesRelations = relations(deliveryBatches, ({ one, many }) => ({
    masterOrder: one(orders, {
        fields: [deliveryBatches.masterOrderId],
        references: [orders.id],
    }),
    deliveryBoy: one(deliveryBoys, {
        fields: [deliveryBatches.deliveryBoyId],
        references: [deliveryBoys.id],
     //   optional: true,
    }),
    customerDeliveryAddress: one(deliveryAddresses, {
        fields: [deliveryBatches.customerDeliveryAddressId],
        references: [deliveryAddresses.id],
    }),
    subOrders: many(subOrders),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  subOrder: one(subOrders, {
    fields: [orderItems.subOrderId],
    references: [subOrders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

//export const orderTrackingRelations = relations(orderTracking, ({ one }) => ({
 // masterOrder: one(orders, {
 //   fields: [orderTracking.masterOrderId],
//    references: [orders.id],
   // optional: true,
//  }),
//  deliveryBatch: one(deliveryBatches, {
//   fields: [orderTracking.deliveryBatchId],
//  references: [deliveryBatches.id],
//   optional: true,
// }),
//  updatedBy: one(users, {
  //  fields: [orderTracking.updatedBy],
 //   references: [users.id],
//  }),
//}));

export const promoCodesRelations = relations(promoCodes, ({ many }) => ({
  // orders: many(orders),
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
