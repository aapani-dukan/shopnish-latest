// server/storage.ts
import { db } from './db.ts';
import {
  users,
  sellersPgTable as sellers,
  products,
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
} from '../shared/backend/schema.ts';
import { eq, and, isNotNull, like } from 'drizzle-orm'; // 'like' भी इम्पोर्ट करें
import { AuthenticatedUser } from '../shared/types/user.ts';
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
    const [newSeller] = await db.insert(sellers).values(sellerData).returning();
    return newSeller;
  }

  async updateSellerApprovalStatus(sellerId: number, status: z.infer<typeof approvalStatusEnum>, reason?: string) {
    const [updatedSeller] = await db.update(sellers)
      .set({
        approvalStatus: status,
        rejectionReason: reason || null,
        approvedAt: status === approvalStatusEnum.enumValues[1] ? new Date() : null,
      })
      .where(eq(sellers.id, sellerId))
      .returning();
    return updatedSeller;
  }

  async getSellers(status?: z.infer<typeof approvalStatusEnum>) {
    let query = db.select().from(sellers);
    if (status) {
      query = query.where(eq(sellers.approvalStatus, status));
    }
    return query.execute();
  }

  async updateSellerStatus(sellerId: number, newStatus: z.infer<typeof approvalStatusEnum>, rejectionReason?: string) {
    const updateData: { approvalStatus: z.infer<typeof approvalStatusEnum>; rejectionReason?: string | null; approvedAt?: Date | null; } = {
      approvalStatus: newStatus
    };

    if (newStatus === approvalStatusEnum.enumValues[1]) { // If approving
      updateData.approvedAt = new Date();
      updateData.rejectionReason = null;
    } else if (newStatus === approvalStatusEnum.enumValues[2]) { // If rejecting
      updateData.rejectionReason = rejectionReason || 'No reason provided';
      updateData.approvedAt = null;
    }

    const [updatedSeller] = await db.update(sellers)
      .set(updateData)
      .where(eq(sellers.id, sellerId))
      .returning();

    if (updatedSeller) {
      await db.update(users)
        .set({
          role: userRoleEnum.enumValues[1], // Assuming role 'seller'
          approvalStatus: newStatus,
        })
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
    let query = db.select().from(products);

    if (options.categoryId) {
      query = query.where(eq(products.categoryId, options.categoryId));
    }
    if (options.search) {
      query = query.where(like(products.name, `%${options.search}%`));
    }
    return query.execute();
  }

  async getProductById(productId: number) {
    const [product] = await db.select().from(products).where(eq(products.id, productId)).execute();
    return product;
  }

  async createProduct(productData: z.infer<typeof insertProductSchema>) {
    const [newProduct] = await db.insert(products).values(productData).returning();
    return newProduct;
  }

  // --- Delivery Boy Methods ---
  async createDeliveryBoy(deliveryBoyData: z.infer<typeof insertDeliveryBoySchema>) {
    const [newDeliveryBoy] = await db.insert(deliveryBoys).values(deliveryBoyData).returning();
    return newDeliveryBoy;
  }

  // --- Cart Items Methods ---
  async getCartItemsForUser(userId: number) {
    return await db.select({
      id: cartItems.id,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      productName: products.name,
      productImage: products.image,
      productPrice: products.price,
    })
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId))
    .execute();
  }

  async addCartItem(userId: number, productId: number, quantity: number) {
    const existingCartItem = await db.select().from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .limit(1)
      .execute();

    if (existingCartItem.length > 0) {
      const [updatedItem] = await db.update(cartItems)
        .set({ quantity: existingCartItem[0].quantity + quantity })
        .where(eq(cartItems.id, existingCartItem[0].id))
        .returning();
      return updatedItem;
    } else {
      const [newItem] = await db.insert(cartItems).values({ userId, productId, quantity }).returning();
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
    const [newOrder] = await db.insert(orders).values(orderData).returning();
    return newOrder;
  }

  async createOrderItems(orderItemsData: z.infer<typeof insertOrderItemSchema>[]) {
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
