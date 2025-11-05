// server/routes/cartRouter.ts

import { Router, Response, NextFunction } from 'express'; // ✅ NextFunction जोड़ा
import { db } from '../server/db.ts';
import {
  users,
  cartItems,
  products,
  approvalStatusEnum, // ✅ approvalStatusEnum इम्पोर्ट करें
  sellersPgTable, // ✅ sellersPgTable इम्पोर्ट करें अगर sellerId को संदर्भित कर रहे हो
} from '../shared/backend/schema.ts';
import { eq, and, inArray } from 'drizzle-orm';
import { AuthenticatedRequest, requireAuth } from '../server/middleware/verifyToken.ts';
import { requireAuth } from '../server/middleware/authMiddleware.ts
import { getIO } from '../server/socket.ts';

const cartRouter = Router();

// 1. ✅ GET /api/cart - Get user's cart (अब cartItems टेबल का उपयोग करता है)

cartRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    console.log("🛒 [API] Received GET request for cart.");

    const userId = req.user?.id;
    console.log("👤 [API] userId:", userId); // ✅ पहला debug point

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.removeHeader('ETag'); 

    if (!userId) {
      console.warn("⚠️ [API] Missing userId in request — returning 401");
      return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
    }

    console.log("🧩 [API] Fetching cart items from DB for user:", userId);

    const cartItemsWithDetails = await db.query.cartItems.findMany({
      where: eq(cartItems.userId, userId),
      with: {
        product: {
          columns: {
            id: true,
            name: true,
            description: true,
            price: true,
            image: true,
            sellerId: true,
            unit: true,
            stock: true,
            minOrderQty: true,
            maxOrderQty: true,
            approvalStatus: true,
          }
        },
        seller: {
          columns: {
            id: true,
            businessName: true,
          }
        }
      },
      orderBy: (cartItems, { asc }) => [asc(cartItems.createdAt)],
    });

    console.log(`✅ [API] Found ${cartItemsWithDetails.length} cart items`);

    let totalAmount = 0;
    const cleanedCartData = cartItemsWithDetails.map(item => {
      if (!item.product || item.product.approvalStatus !== approvalStatusEnum.enumValues[1]) {
        console.warn(`[CART] ⚠️ Invalid or unapproved product in cartItem ${item.id} (productId: ${item.productId})`);
        return null;
      }

      const effectivePrice = item.priceAtAdded;
      const effectiveQuantity = Math.min(item.quantity, item.product.stock);
      const itemTotal = effectivePrice * effectiveQuantity;
      totalAmount += itemTotal;

      return {
        id: item.id,
        productId: item.productId,
        quantity: effectiveQuantity,
        priceAtAdded: item.priceAtAdded,
        itemTotal,
        product: {
          id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          image: item.product.image,
          unit: item.product.unit,
          stock: item.product.stock,
          minOrderQty: item.product.minOrderQty,
          maxOrderQty: item.product.maxOrderQty,
        },
        seller: item.seller ? {
          id: item.seller.id,
          businessName: item.seller.businessName,
        } : null,
      };
    }).filter(item => item !== null);

    console.log(`🧮 [API] Total amount: ${totalAmount}, Cleaned items: ${cleanedCartData.length}`);

    return res.status(200).json({
      message: "Cart fetched successfully",
      items: cleanedCartData,
      totalAmount,
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching cart:', error);
    console.error('❌ [API] Stack Trace:', error.stack); // ✅ दूसरा debug point
    res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate' });
    return res.status(500).json({ error: 'Failed to fetch cart. An unexpected error occurred.' });
  }
});

// 2. ✅ POST /api/cart/add - Add a new item to cart (अब cartItems टेबल का उपयोग करता है)
cartRouter.post('/add', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // ✅ NextFunction जोड़ा
  try {
    const userId = req.user?.id;
    const { productId, quantity } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
    }
    if (!productId || typeof quantity !== 'number' || quantity <= 0) { // Quantity 0 या नकारात्मक नहीं हो सकती
      return res.status(400).json({ error: 'Invalid productId or quantity.' });
    }

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.approvalStatus !== approvalStatusEnum.enumValues[1]) { // 'approved'
      return res.status(400).json({ error: 'Product is not approved for sale.' });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ error: `Insufficient stock. Only ${product.stock} units available.` });
    }
    if (product.minOrderQty && quantity < product.minOrderQty) {
      return res.status(400).json({ error: `Minimum order quantity for ${product.name} is ${product.minOrderQty}.` });
    }
    if (product.maxOrderQty && quantity > product.maxOrderQty) {
      return res.status(400).json({ error: `Maximum order quantity for ${product.name} is ${product.maxOrderQty}.` });
    }

    const priceAtAdded = product.price; // प्रोडक्ट का वर्तमान मूल्य
    const sellerId = product.sellerId;

    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));

    let item;
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ error: `Cannot add ${quantity} units. Only ${product.stock - existingItem.quantity} units available.` });
      }
      if (product.maxOrderQty && newQuantity > product.maxOrderQty) {
        return res.status(400).json({ error: `Adding this quantity exceeds maximum order quantity of ${product.maxOrderQty} for ${product.name}.` });
      }

      const newTotalPrice = priceAtAdded * newQuantity; // नए कुल मूल्य की गणना करें

      const updatedItem = await db
        .update(cartItems)
        .set({
          quantity: newQuantity,
          totalPrice: newTotalPrice, // ✅ totalPrice अपडेट करें
          updatedAt: new Date(), // ✅ updatedAt अपडेट करें
        })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      item = updatedItem[0];
    } else {
      const newTotalPrice = priceAtAdded * quantity; // कुल मूल्य की गणना करें

      const newItem = await db
        .insert(cartItems)
        .values({
          userId: userId,
          productId,
          quantity,
          priceAtAdded: priceAtAdded, // ✅ priceAtAdded उपयोग करें
          totalPrice: newTotalPrice, // ✅ totalPrice सेट करें
          sellerId, // ✅ sellerId सेट करें
          createdAt: new Date(),
          updatedAt: new Date(), // ✅ updatedAt सेट करें
        })
        .returning();
      item = newItem[0];
    }

    getIO().emit("cart:updated", { userId: userId }); // userId के साथ भेजें

    return res.status(200).json({ message: 'Item added to cart.', item });
  } catch (error: any) {
    console.error('❌ [API] Error adding item to cart:', error);
    // next(error); // ✅ त्रुटियों को संभालने के लिए next का उपयोग करें
    return res.status(500).json({ error: 'Failed to add item to cart.' });
  }
});


// 3. ✅ PUT /api/cart/:cartItemId - Update quantity (अब cartItems टेबल का उपयोग करता है)
cartRouter.put('/:cartItemId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // ✅ NextFunction जोड़ा
  try {
    const userId = req.user?.id;
    const cartItemId = parseInt(req.params.cartItemId); // parseInt एक ही बार करें
    const { quantity } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
    }
    if (isNaN(cartItemId) || typeof quantity !== 'number' || quantity < 0) { // Quantity 0 या नकारात्मक नहीं हो सकती (हटाने के लिए DELETE का उपयोग करें)
      return res.status(400).json({ error: 'Invalid cart item ID or quantity.' });
    }

    // पहले कार्ट आइटम और प्रोडक्ट की जानकारी fetch करें
    const [existingCartItem] = await db.query.cartItems.findMany({
        where: and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)),
        with: {
            product: {
                columns: {
                    id: true,
                    stock: true,
                    price: true, // वर्तमान प्रोडक्ट मूल्य
                    minOrderQty: true,
                    maxOrderQty: true,
                }
            }
        }
    });

    if (!existingCartItem || !existingCartItem.product) {
        return res.status(404).json({ message: 'Cart item or associated product not found or does not belong to user.' });
    }

    const product = existingCartItem.product;
    const priceAtAdded = existingCartItem.priceAtAdded; // कार्ट में जोड़ते समय की कीमत

    if (quantity === 0) {
        // यदि मात्रा 0 है, तो आइटम को हटा दें (DELETE एंडपॉइंट के समान)
        const [deletedItem] = await db.delete(cartItems)
            .where(eq(cartItems.id, cartItemId))
            .returning();
        
        if (!deletedItem) {
            return res.status(404).json({ message: 'Cart item not found or failed to delete.' });
        }
        getIO().emit("cart:updated", { userId: userId });
        return res.status(200).json({ message: 'Cart item removed successfully (quantity set to 0).', item: deletedItem });
    }

    if (quantity > product.stock) {
        return res.status(400).json({ error: `Insufficient stock. Only ${product.stock} units available.` });
    }
    if (product.minOrderQty && quantity < product.minOrderQty) {
      return res.status(400).json({ error: `Minimum order quantity for ${product.name} is ${product.minOrderQty}.` });
    }
    if (product.maxOrderQty && quantity > product.maxOrderQty) {
      return res.status(400).json({ error: `Maximum order quantity for ${product.name} is ${product.maxOrderQty}.` });
    }

    const newTotalPrice = priceAtAdded * quantity;

    const [updatedItem] = await db.update(cartItems)
      .set({
        quantity: quantity,
        totalPrice: newTotalPrice, // ✅ totalPrice अपडेट करें
        updatedAt: new Date(), // ✅ updatedAt अपडेट करें
      })
      .where(eq(cartItems.id, cartItemId)) // यहां userId की जांच पहले ही हो चुकी है
      .returning();

    if (!updatedItem) {
      return res.status(404).json({ message: 'Cart item not found or no changes made.' });
    }

    getIO().emit("cart:updated", { userId: userId });

    return res.status(200).json({ message: 'Cart item updated successfully.', item: updatedItem });
  } catch (error: any) {
    console.error('❌ [API] Error updating cart item:', error);
    // next(error); // ✅ त्रुटियों को संभालने के लिए next का उपयोग करें
    return res.status(500).json({ error: 'Failed to update cart item.' });
  }
});

// 4. ✅ DELETE /api/cart/:cartItemId - Remove a single item (अब cartItems टेबल का उपयोग करता है)
cartRouter.delete('/:cartItemId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // ✅ NextFunction जोड़ा
  try {
    const userId = req.user?.id;
    const cartItemId = parseInt(req.params.cartItemId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user ID.' });
    }
    if (isNaN(cartItemId)) {
      return res.status(400).json({ error: 'Invalid cart item ID.' });
    }

    const [deletedItem] = await db.delete(cartItems)
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId))) // ✅ userId की जांच
      .returning();

    if (!deletedItem) {
      return res.status(404).json({ message: 'Cart item not found or does not belong to user.' });
    }

    getIO().emit("cart:updated", { userId: userId });

    return res.status(200).json({ message: 'Cart item removed successfully.' });
  } catch (error: any) {
    console.error('❌ [API] Error removing cart item:', error);
    // next(error); // ✅ त्रुटियों को संभालने के लिए next का उपयोग करें
    return res.status(500).json({ error: 'Failed to remove item from cart.' });
  }
});

// 5. ✅ DELETE /api/cart/clear - Clear the entire cart for a user
cartRouter.delete('/clear', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { // ✅ NextFunction जोड़ा
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: Missing user ID.' });
        }

        const deletedCount = await db.delete(cartItems)
            .where(eq(cartItems.userId, userId))
            .returning({ id: cartItems.id }); // यह हमें बताता है कि कितने आइटम डिलीट हुए

        if (deletedCount.length === 0) {
            return res.status(200).json({ message: 'Cart is already empty.' });
        }

        getIO().emit("cart:updated", { userId: userId });

        return res.status(200).json({ message: 'Cart cleared successfully.', clearedItemsCount: deletedCount.length });
    } catch (error: any) {
        console.error('❌ [API] Error clearing cart:', error);
        // next(error);
        return res.status(500).json({ error: 'Failed to clear cart.' });
    }
});


export default cartRouter;
  
