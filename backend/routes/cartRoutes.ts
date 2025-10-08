// server/routes/cartRouter.ts

import { Router, Response } from 'express';
import { db } from '../server/db.ts';
import {
  users,
  orderItems, // ⚠️ इसे अब सिर्फ़ reference के लिए रखा है, उपयोग cartItems का होगा
  cartItems,    // ✅ NEW: cartItems स्कीमा को इम्पोर्ट करें
  products
} from '../shared/backend/schema.ts';
import { eq, and, inArray } from 'drizzle-orm';
import { AuthenticatedRequest, requireAuth } from '../server/middleware/authMiddleware.ts';
import { getIO } from '../server/socket.ts'; 

const cartRouter = Router();

// 1. ✅ GET /api/cart - Get user's cart (अब cartItems टेबल का उपयोग करता है)
cartRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log("🛒 [API] Received GET request for cart.");
    const firebaseUid = req.user?.firebaseUid;
    
    // कैशिंग हेडर को सेट करें (जैसा कि हमने पहले तय किया था)
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    });
    res.removeHeader('ETag'); 

    if (!firebaseUid) {
      return res.status(401).json({ error: 'Unauthorized: Missing user UUID' });
    }

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid));

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // 🛑 FIX: orderItems से cartItems पर स्विच करें, status की अब आवश्यकता नहीं है।
    const cartItemsData = await db.query.cartItems.findMany({
      where: eq(cartItems.userId, dbUser.id),
    });

    if (cartItemsData.length === 0) {
      return res.status(200).json({ message: "Your cart is empty", items: [] });
    }

    // बाकी लॉजिक (products fetch, data cleaning) समान रहता है
    const productIds = cartItemsData.map(item => item.productId);
    const productsData = await db.query.products.findMany({
      where: inArray(products.id, productIds),
    });

    const productsMap = new Map(productsData.map(product => [product.id, product]));

    const cleanedCartData = cartItemsData.map(item => {
      const product = productsMap.get(item.productId);
      if (!product) return null;
      return {
        id: item.id,
        quantity: item.quantity,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          sellerId: product.sellerId,
          nameHindi: product.nameHindi, 
          unit: product.unit,
        },
      };
    }).filter(item => item !== null);

    return res.status(200).json({ message: "Cart fetched successfully", items: cleanedCartData });

  } catch (error: any) {
    console.error('❌ [API] Error fetching cart:', error);
    res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate' }); 
    return res.status(500).json({ error: 'Failed to fetch cart. An unexpected error occurred.' });
  }
});


// 2. ✅ POST /api/cart/add - Add a new item to cart (अब cartItems टेबल का उपयोग करता है)
cartRouter.post('/add', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { productId, quantity } = req.body;

    if (!firebaseUid || !productId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid));

    if (!dbUser) return res.status(404).json({ error: 'User not found.' });

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const unitPrice = parseFloat(product.price);
    const totalPrice = unitPrice * quantity;
    const sellerId = product.sellerId;

    // 🛑 FIX: orderItems से cartItems पर स्विच करें
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, dbUser.id), eq(cartItems.productId, productId))); // status की अब आवश्यकता नहीं

    let item;
    if (existingItem) {
      // 🛑 FIX: orderItems से cartItems पर स्विच करें
      const updatedItem = await db
        .update(cartItems)
        .set({
          quantity: existingItem.quantity + quantity,
          totalPrice: existingItem.totalPrice + totalPrice,
        })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      item = updatedItem[0];
    } else {
      // 🛑 FIX: orderItems से cartItems पर स्विच करें
      const newItem = await db
        .insert(cartItems)
        .values({
          userId: dbUser.id,
          productId,
          quantity,
          unitPrice,
          totalPrice,
          sellerId,
          // status अब यहाँ आवश्यक नहीं है, यदि cartItems टेबल में status फ़ील्ड नहीं है
        })
        .returning();
      item = newItem[0];
    }

    getIO().emit("cart:updated", { userId: dbUser.id });

    return res.status(200).json({ message: 'Item added to cart.', item });
  } catch (error: any) {
    console.error('❌ [API] Error adding item to cart:', error);
    return res.status(500).json({ error: 'Failed to add item to cart.' });
  }
});

// 3. ✅ PUT /api/cart/:cartItemId - Update quantity (अब cartItems टेबल का उपयोग करता है)
cartRouter.put('/:cartItemId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (!firebaseUid || !quantity || isNaN(parseInt(cartItemId))) {
      return res.status(400).json({ error: 'Invalid or missing fields.' });
    }

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid));

    if (!dbUser) return res.status(404).json({ error: 'User not found.' });

    // 🛑 FIX: orderItems से cartItems पर स्विच करें
    const [updatedItem] = await db.update(cartItems)
      .set({ quantity })
      // status की अब यहाँ आवश्यकता नहीं है
      .where(and(eq(cartItems.id, parseInt(cartItemId)), eq(cartItems.userId, dbUser.id)))
      .returning();

    if (!updatedItem) {
      return res.status(404).json({ message: 'Cart item not found or does not belong to user.' });
    }

    getIO().emit("cart:updated", { userId: dbUser.id });

    return res.status(200).json({ message: 'Cart item updated successfully.', item: updatedItem });
  } catch (error: any) {
    console.error('❌ [API] Error updating cart item:', error);
    return res.status(500).json({ error: 'Failed to update cart item.' });
  }
});

// 4. ✅ DELETE /api/cart/:cartItemId - Remove a single item (अब cartItems टेबल का उपयोग करता है)
cartRouter.delete('/:cartItemId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const { cartItemId } = req.params;

    if (!firebaseUid || isNaN(parseInt(cartItemId))) {
      return res.status(400).json({ error: 'Invalid or missing cart item ID.' });
    }

    const [dbUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid));

    if (!dbUser) return res.status(404).json({ error: 'User not found.' });

    // 🛑 FIX: orderItems से cartItems पर स्विच करें
    const [deletedItem] = await db.delete(cartItems)
      // status की अब यहाँ आवश्यकता नहीं है
      .where(and(eq(cartItems.id, parseInt(cartItemId)), eq(cartItems.userId, dbUser.id)))
      .returning();

    if (!deletedItem) {
      return res.status(404).json({ message: 'Cart item not found or does not belong to user.' });
    }

    getIO().emit("cart:updated", { userId: dbUser.id });

    return res.status(200).json({ message: 'Cart item removed successfully.' });
  } catch (error: any) {
    console.error('❌ [API] Error removing cart item:', error);
    return res.status(500).json({ error: 'Failed to remove item from cart.' });
  }
});

export default cartRouter;
           
