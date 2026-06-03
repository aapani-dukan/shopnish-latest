// server/storage.ts
import { db } from './db';
import {
  users,
  sellersPgTable as sellers,
  products,
  productVariants,
  categories,
  deliveryBoys,
  orders,
  cartItems,
  orderItems,
  reviews,
  userRoleEnum,
  approvalStatusEnum,
  insertUserSchema,
  insertSellerSchema,
  insertDeliveryBoySchema,
  insertProductSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertReviewSchema,
  insertCartItemSchema,
} from '../shared/backend/schema';
import { eq, and, isNotNull, like } from 'drizzle-orm'; // 'like' भी इम्पोर्ट करें
import { AuthenticatedUser } from '../shared/types/user';
import { z } from 'zod';

class DatabaseStorage {
  // --- User Methods ---
  async getUserByFirebaseUid(firebaseUid: string) {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).execute();
    return user; // सीधे User ऑब्जेक्ट रिटर्न करें, array नहीं
  }

  async getUserById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).execute();
    return user;
  }

  async createUser(userData: z.infer<typeof insertUserSchema>) {
    const [newUser] = await db.insert(users).values(userData).returning();
    return newUser;
  }

  // --- Seller Methods ---
  async getSellerByUserId(userId: number) {
    const [seller] = await db.select().from(sellers).where(eq(sellers.userId, userId)).execute();
    return seller;
  }

  async createSeller(sellerData: z.infer<typeof insertSellerSchema>) {
  // ✅ यहाँ हमने डेटा को स्प्रेड किया और approvedAt को 'Date' ऑब्जेक्ट में बदला
  const [newSeller] = await db.insert(sellers)
    .values({
      ...sellerData,
      // अगर डेटा में तारीख स्ट्रिंग है, तो उसे Date() में बदलें, वरना null रखें
      approvedAt: sellerData.approvedAt ? new Date(sellerData.approvedAt) : null,
    })
    .returning();
  return newSeller;
}

async updateSellerApprovalStatus(
  sellerId: number, 
  status: "pending" | "approved" | "rejected", // ✅ टाइप को सीधा और साफ़ रखें
  reason?: string
) {
  const [updatedSeller] = await db.update(sellers)
    .set({
      approvalStatus: status, // अब यहाँ कोई कन्फ्यूजन नहीं होगा
      rejectionReason: reason || null,
      approvedAt: status === 'approved' ? new Date() : null,
    })
    .where(eq(sellers.id, sellerId))
    .returning();
  return updatedSeller;
}

  async getSellers(status?: z.infer<typeof approvalStatusEnum>) {
  // ✅ 'any' टाइप देने से Drizzle के इंटरनल 'Omit' और 'Select' के झगड़े खत्म हो जाते हैं
  let query: any = db.select().from(sellers);

  if (status) {
    // ✅ status को 'as any' कास्ट करें ताकि Enum टाइप पूरी तरह मैच हो जाए
    query = query.where(eq(sellers.approvalStatus, status as any));
  }

  // ✅ execute() का इंतज़ार करें ताकि डेटा सही टाइप में रिटर्न हो
  return await query;
}
  async updateSellerStatus(sellerId: number, newStatus: z.infer<typeof approvalStatusEnum>, rejectionReason?: string) {
  // ✅ ऑब्जेक्ट को 'any' टाइप दें ताकि Drizzle के सख्त टाइप्स बुरा न मानें
  const updateData: any = {
    approvalStatus: newStatus as any
  };

  if (newStatus === 'approved') { // ✅ सरल और पक्का चेक
    updateData.approvedAt = new Date();
    updateData.rejectionReason = null;
  } else if (newStatus === 'rejected') {
    updateData.rejectionReason = rejectionReason || 'No reason provided';
    updateData.approvedAt = null;
  } else {
    updateData.approvedAt = null;
    updateData.rejectionReason = null;
  }

  // ✅ पहला अपडेट: Sellers टेबल के लिए
  const [updatedSeller] = await db.update(sellers)
    .set(updateData)
    .where(eq(sellers.id, sellerId))
    .returning();

  // ✅ दूसरा अपडेट: Users टेबल के लिए
  if (updatedSeller) {
    await db.update(users)
      .set({
        role: 'seller', // ✅ पक्का 'seller' रोल सेट करें
        approvalStatus: newStatus as any,
      } as any)
      .where(eq(users.id, updatedSeller.userId));
  }

  return updatedSeller;
}
  // --- Category Methods ---
  async getCategories() {
    return db.select().from(categories).execute();
  }

  // --- Product Methods ---
  async getProducts(options: { categoryId?: number; search?: string }) {
    let query: any = db.select().from(products);

    if (options.categoryId) {
      query = query.where(eq(products.categoryId, options.categoryId));
    }
    if (options.search) {
      query = query.where(like(products.name, `%${options.search}%`));
    }
    return query.execute();
  }

 
async createProduct(productData: z.infer<typeof insertProductSchema> & { variants?: any[] }) {
  return await db.transaction(async (tx) => {
    // 1. मुख्य प्रोडक्ट की एंट्री (बिना प्राइस/स्टॉक के क्योंकि ये वैरिएंट में हैं भाई)
    const { variants, ...pureProductData } = productData as any;
    
    const [newProduct] = await tx.insert(products)
      .values({
        ...pureProductData,
        approvedAt: pureProductData.approvedAt ? new Date(pureProductData.approvedAt) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
      .returning();
      
    if (!newProduct) throw new Error("Failed to create master product.");

    // 2. 🎯 मास्टरस्ट्रोक: अगर फ्रंटएंड से वैरिएंट्स आए हैं, तो उन्हें वैरिएंट्स टेबल में डालो भाई
    if (variants && Array.isArray(variants)) {
      for (const variant of variants) {
        await tx.insert(productVariants).values({
          productId: newProduct.id,
          quantityValue: variant.quantityValue,
          unit: variant.unit || 'piece',
          price: Number(variant.price),
          originalPrice: variant.originalPrice ? Number(variant.originalPrice) : null,
          stock: Number(variant.stock || 0),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        } as any);
      }
    }
    
    return newProduct;
  });
}

  // --- Delivery Boy Methods ---
  async createDeliveryBoy(deliveryBoyData: z.infer<typeof insertDeliveryBoySchema>) {
  const [newDeliveryBoy] = await db.insert(deliveryBoys)
    .values({
      ...deliveryBoyData,
      // ✅ सीधे अभी की तारीख भेजें, क्योंकि ये नया रजिस्ट्रेशन है
      createdAt: new Date(), 
      updatedAt: new Date(),
      // अगर 'approvedAt' आपके डेटा में नहीं है, तो इसे भेजने की ज़रूरत नहीं
    } as any)
    .returning();

  return newDeliveryBoy;
}

 // 🎯 फिक्स: अब कार्ट आइटम्स को वैरिएंट्स टेबल के साथ जॉइन करके डेटा निकालेंगे भाई!
  async getCartItemsForUser(userId: number) {
    return await db.select({
      id: cartItems.id,
      productId: cartItems.productId,
      variantId: cartItems.variantId, // ✅ नया वैरिएंट ट्रैकिंग कॉलम
      quantity: cartItems.quantity,
      productName: products.name,
      productImage: products.image,
      variantPrice: productVariants.price, // ✅ अब प्राइस वैरिएंट से आ रही है भाई!
      variantUnit: productVariants.unit,
      variantQtyValue: productVariants.quantityValue
    })
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id)) // वैरिएंट जॉइन भाई
    .where(eq(cartItems.userId, userId))
    .execute();
  }

  // 🎯 फिक्स: कार्ट में माल जोड़ते समय 'variantId' होना 100% ज़रूरी है भाई!
  async addCartItem(userId: number, productId: number, variantId: number, quantity: number) {
    // 1. पहले चेक करें कि क्या यह विशिष्ट वैरिएंट पहले से कार्ट में है
    const existingCartItem = await db.select().from(cartItems)
      .where(and(
        eq(cartItems.userId, userId), 
        eq(cartItems.productId, productId),
        eq(cartItems.variantId, variantId) // वैरिएंट आईडी चेक भाई
      ))
      .limit(1)
      .execute();

    // 2. वैरिएंट की करंट लाइव डिटेल्स निकालें (प्राइस के लिए भाई)
    const [variant] = await db.select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1);

    const [product] = await db.select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!variant || !product) {
      throw new Error("Product Variant or Master Product not found भाई!");
    }

    const currentPrice = Number(variant.price);

    if (existingCartItem.length > 0) {
      // ✅ केस ए: क्वांटिटी और टोटल प्राइस अपडेट करो भाई
      const newQuantity = existingCartItem[0].quantity + quantity;
      const [updatedItem] = await db.update(cartItems)
        .set({ 
          quantity: newQuantity,
          totalPrice: (currentPrice * newQuantity).toString(),
          updatedAt: new Date()
        } as any)
        .where(eq(cartItems.id, existingCartItem[0].id))
        .returning();
      return updatedItem;
    } else {
      // ✅ केस बी: बिलकुल नया वैरिएंट कार्ट में इंसर्ट करो भाई
      const [newItem] = await db.insert(cartItems)
        .values({ 
          userId, 
          productId, 
          variantId, // ✅ सेव वैरिएंट आईडी
          quantity,
          sellerId: product.sellerId, 
          priceAtAdded: currentPrice.toString(),
          totalPrice: (currentPrice * quantity).toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        } as any)
        .returning();
      return newItem;
    }
  }
  async updateCartItem(cartItemId: number, quantity: number) {
    const [updatedItem] = await db.update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, cartItemId))
      .returning();
    return updatedItem;
  }

  async removeCartItem(cartItemId: number) {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId)).execute();
    return { success: true, message: 'Cart item removed.' };
  }

  async clearCart(userId: number) {
    await db.delete(cartItems).where(eq(cartItems.userId, userId)).execute();
    return { success: true, message: 'Cart cleared.' };
  }

  // --- Order Methods ---
  async createOrder(orderData: z.infer<typeof insertOrderSchema>) {
  // डेटा को आसान बनाने के लिए एक variable में लें
  const data = orderData as any;

  const [newOrder] = await db.insert(orders)
    .values({
      ...data,
      // ✅ 1. Date Fix
      estimatedDeliveryTime: data.estimatedDeliveryTime 
        ? new Date(data.estimatedDeliveryTime) 
        : null,

      // ✅ 2. Decimal Fix (ToString ensure precision)
      subtotal: data.subtotal.toString(),
      total: data.total.toString(),
      
      // ✅ 3. Delivery Fee (अगर डेटा में है तो उठाओ, वरना "0")
      deliveryFee: data.deliveryFee ? data.deliveryFee.toString() : "0",

      // ✅ 4. Default Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning();

  return newOrder;
}

 async createOrderItems(orderItemsData: any[]) {
    // orderItemsData में अब आपके पास { subOrderId, productId, variantId, quantity, itemTotal, ... } होना चाहिए
    return db.insert(orderItems).values(orderItemsData).returning().execute();
  }

  async getOrdersForUser(customerId: number) {
    return db.select().from(orders).where(eq(orders.customerId, customerId)).execute();
  }

  async getOrderById(orderId: number) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).execute();
    return order;
  }

  // --- Review Methods ---
  async createReview(reviewData: z.infer<typeof insertReviewSchema>) {
    const [newReview] = await db.insert(reviews).values(reviewData).returning();
    return newReview;
  }

  async getReviewsForProduct(productId: number) {
    return db.select().from(reviews).where(eq(reviews.productId, productId)).execute();
  }
}

export const storage = new DatabaseStorage();
