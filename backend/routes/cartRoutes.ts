import { Router, Response, NextFunction } from "express";
import { db } from "../server/db";
import {
  users,
  cartItems,
  products,
  approvalStatusEnum,
  productVariants,
  sellersPgTable,
} from "../shared/backend/schema";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest } from "../server/middleware/verifyToken";
import { requireAuth } from "../server/middleware/authMiddleware";
import { getIO } from "../server/socket";

const cartRouter = Router();

/* ============================================
   🛒 1. GET /api/cart — Get User’s Cart
==========/* ============================================
   🛒 1. GET /api/cart — Get User’s Cart (Variant Aware)
============================================ */
cartRouter.get(
  "/",
  requireAuth,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized: Missing user ID" });
      }

      // 🎯 फिक्स: प्रोडक्ट के साथ-साथ अब कार्ट आइटम से जुड़ा विशिष्ट वैरिएंट भी लोड होगा भाई!
      const cartItemsWithDetails = await db.query.cartItems.findMany({
        where: eq(cartItems.userId, userId),
        with: {
          product: {
            columns: {
              id: true,
              name: true,
              description: true,
              image: true,
              sellerId: true,
              approvalStatus: true,
            },
          },
          // 🔥 नया रिलेशन जोड़ा गया भाई:
          variant: {
            columns: {
              id: true,
              quantityValue: true,
              unit: true,
              price: true, // लाइव सेलिंग प्राइस
              stock: true, // लाइव वैरिएंट स्टॉक
              minOrderQty: true,
              maxOrderQty: true,
              isActive: true
            }
          },
          seller: {
            columns: {
              id: true,
              businessName: true,
            },
          },
        },
        orderBy: (cartItems, { asc }) => [asc(cartItems.createdAt)],
      });

      let totalAmount = 0;
      const cleanedCartData = cartItemsWithDetails
        .map((item: any) => {
          // सुरक्षा चेक: प्रोडक्ट अप्रूव्ड होना चाहिए और वैरिएंट एक्टिव होना चाहिए भाई
          if (
            !item.product ||
            item.product.approvalStatus !== approvalStatusEnum.enumValues[1] ||
            !item.variant || 
            !item.variant.isActive
          ) {
            return null;
          }

          const effectivePrice = Number(item.variant.price);
          // सेफ़्टी चेक: अगर कार्ट में क्वांटिटी स्टॉक से ज़्यादा हो गई है तो स्टॉक जितना ही दिखाओ
          const effectiveQuantity = Math.min(item.quantity, item.variant.stock);
          const itemTotal = effectivePrice * effectiveQuantity;
          totalAmount += itemTotal;

          return {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId, // ✅ फ्रंटएंड के लिए वैरिएंट आईडी रिटर्न भाई
            quantity: effectiveQuantity,
            priceAtAdded: effectivePrice,
            itemTotal,
            product: {
              id: item.product.id,
              name: item.product.name,
              image: item.product.image,
              variantName: `${item.variant.quantityValue} ${item.variant.unit}`, // e.g. "250 Gram"
              price: effectivePrice,
              unit: item.variant.unit,
              stock: item.variant.stock,
              minOrderQty: item.variant.minOrderQty || 1,
              maxOrderQty: item.variant.maxOrderQty || null,
            },
            seller: item.seller
              ? {
                  id: item.seller.id,
                  businessName: item.seller.businessName,
                }
              : null,
          };
        })
        .filter((item) => item !== null);

      return res.status(200).json({
        message: "Cart fetched successfully with variant snapshot",
        items: cleanedCartData,
        totalAmount,
      });
    } catch (error: any) {
      console.error("❌ Error fetching cart:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch cart. An unexpected error occurred." });
    }
  }
);

/* ============================================
   ➕ 2. POST /api/cart/add — Add Item to Cart (Variant Level Fix)
============================================ */
cartRouter.post(
  "/add",
  requireAuth,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const { productId, variantId, quantity } = req.body; // 🔥 फ्रंटएंड से variantId आना अब अनिवार्य है भाई!

      if (!userId)
        return res.status(401).json({ error: "Unauthorized: Missing user ID" });

      if (!productId || !variantId || typeof quantity !== "number" || quantity <= 0) {
        return res
          .status(400)
          .json({ error: "Invalid productId, variantId or quantity." });
      }

      // 1. मुख्य प्रोडक्ट चेक करें
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) return res.status(404).json({ error: "Product not found." });
      if (product.approvalStatus !== approvalStatusEnum.enumValues[1]) {
        return res.status(400).json({ error: "Product is not approved for sale." });
      }

      // 2. 🎯 विशिष्ट वैरिएंट का लाइव डेटा निकालें भाई
      const [variant] = await db
        .select()
        .from(productVariants) // आपके स्कीमा का नाम 'productsVariants' है भाई
        .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
        .limit(1);

      if (!variant) return res.status(404).json({ error: "Selected product variant not found." });
      if (!variant.isActive) return res.status(400).json({ error: "This variant is currently inactive." });

      // 3. लिमिट और स्टॉक चेक अब वैरिएंट टेबल से होगा भाई
      if (variant.stock < quantity) {
        return res.status(400).json({
          error: `Insufficient stock. Only ${variant.stock} units available for this size.`,
        });
      }

      if (variant.minOrderQty && quantity < variant.minOrderQty) {
        return res.status(400).json({
          error: `Minimum order quantity for this variant is ${variant.minOrderQty}.`,
        });
      }

      if (variant.maxOrderQty && quantity > variant.maxOrderQty) {
        return res.status(400).json({
          error: `Maximum order quantity for this variant is ${variant.maxOrderQty}.`,
        });
      }

      const priceAtAdded = Number(variant.price);
      const sellerId = product.sellerId;
      const newTotalPrice = priceAtAdded * quantity;

      // 4. 🔥 महा-फिक्स: अब पुराना आइटम चेक करते समय productId और variantId दोनों का मिलान होगा भाई!
      const [existingItem] = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId), 
            eq(cartItems.productId, productId),
            eq(cartItems.variantId, variantId) // वैरिएंट मैच होना ज़रूरी है!
          )
        );

      let item;

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;

        if (newQuantity > variant.stock) {
          return res.status(400).json({
            error: `Cannot add ${quantity} units. Only ${
              variant.stock - existingItem.quantity
            } units available in stock.`,
          });
        }

        const updatedTotalPrice = priceAtAdded * newQuantity;

        const updatedItem = await db
          .update(cartItems)
          .set({
            quantity: newQuantity,
            totalPrice: updatedTotalPrice,
            updatedAt: new Date(),
          })
          .where(eq(cartItems.id, existingItem.id))
          .returning();

        item = updatedItem[0];
      } else {
        // नया आइटम इंसर्ट (variantId कॉलम के साथ भाई)
        const newItem = await db
          .insert(cartItems)
          .values({
            userId,
            productId,
            variantId, // ✅ डेटाबेस में वैरिएंट रिकॉर्ड सिंक भाई!
            quantity,
            priceAtAdded,
            totalPrice: newTotalPrice,
            sellerId,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any)
          .returning();

        item = newItem[0];
      }

      getIO().emit("cart:updated", { userId });
      return res.status(200).json({ message: "Item added to cart successfully.", item });
    } catch (error: any) {
      console.error("❌ Error adding item to cart:", error);
      return res.status(500).json({ error: "Failed to add item to cart." });
    }
  }
);

/* ============================================
   ✏️ 3. PUT /api/cart/:id — Update Quantity (Variant Aware)
============================================ */
cartRouter.put(
  "/:cartItemId",
  requireAuth,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const cartItemId = parseInt(req.params.cartItemId);
      const { quantity } = req.body;

      if (!userId)
        return res.status(401).json({ error: "Unauthorized: Missing user ID" });

      if (isNaN(cartItemId) || typeof quantity !== "number" || quantity < 0) {
        return res
          .status(400)
          .json({ error: "Invalid cart item ID or quantity." });
      }

      // 🎯 फिक्स: यहाँ भी रिलेशंस में 'product' के बजाय 'variant' लोड किया भाई!
      const [existingCartItem] = await db.query.cartItems.findMany({
        where: and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)),
        with: {
          product: {
            columns: { id: true, name: true }
          },
          variant: {
            columns: {
              id: true,
              stock: true,
              price: true,
              minOrderQty: true,
              maxOrderQty: true,
            },
          },
        },
      });

      if (!existingCartItem || !existingCartItem.variant || !existingCartItem.product) {
        return res.status(404).json({
          message: "Cart item or associated variant not found.",
        });
      }

      const variant = existingCartItem.variant;
      const product = existingCartItem.product;
      const priceAtAdded = Number(variant.price);

      // अगर क्वांटिटी 0 कर दी है तो कार्ट से हटा दो भाई
      if (quantity === 0) {
        const [deletedItem] = await db
          .delete(cartItems)
          .where(eq(cartItems.id, cartItemId))
          .returning();

        getIO().emit("cart:updated", { userId });
        return res.status(200).json({
          message: "Cart item removed successfully (quantity set to 0).",
          item: deletedItem,
        });
      }

      // स्टॉक और लिमिट वैलिडेशन अब सीधा वैरिएंट से सिंक है भाई
      if (quantity > variant.stock) {
        return res.status(400).json({
          error: `Insufficient stock. Only ${variant.stock} units available for this size.`,
        });
      }

      if (variant.minOrderQty && quantity < variant.minOrderQty) {
        return res.status(400).json({
          error: `Minimum order quantity is ${variant.minOrderQty}.`,
        });
      }

      if (variant.maxOrderQty && quantity > variant.maxOrderQty) {
        return res.status(400).json({
          error: `Maximum order quantity is ${variant.maxOrderQty}.`,
        });
      }

      const updatedTotalPrice = priceAtAdded * quantity;

      const [updatedItem] = await db
        .update(cartItems)
        .set({
          quantity,
          totalPrice: updatedTotalPrice,
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, cartItemId))
        .returning();

      getIO().emit("cart:updated", { userId });

      return res
        .status(200)
        .json({ message: "Cart item quantity updated successfully.", item: updatedItem });
    } catch (error: any) {
      console.error("❌ Error updating cart item:", error);
      return res.status(500).json({ error: "Failed to update cart item." });
    }
  }
);

/* ============================================
   ❌ 4. DELETE /api/cart/:id — Remove Item
============================================ */
cartRouter.delete(
  "/:cartItemId",
  requireAuth,
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const cartItemId = parseInt(req.params.cartItemId);

      if (!userId)
        return res.status(401).json({ error: "Unauthorized: Missing user ID" });
      if (isNaN(cartItemId))
        return res.status(400).json({ error: "Invalid cart item ID" });

      const [deletedItem] = await db
        .delete(cartItems)
        .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)))
        .returning();

      if (!deletedItem) {
        return res.status(404).json({
          message: "Cart item not found or does not belong to user.",
        });
      }

      getIO().emit("cart:updated", { userId });
      return res.status(200).json({ message: "Cart item removed successfully" });
    } catch (error: any) {
      console.error("❌ Error removing cart item:", error);
      return res.status(500).json({ error: "Failed to remove item from cart." });
    }
  }
);

/* ============================================
   🧹 5. DELETE /api/cart/clear — Clear All
============================================ */
cartRouter.delete(
  "/clear",
  requireAuth,
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId)
        return res.status(401).json({ error: "Unauthorized: Missing user ID" });

      const deletedCount = await db
        .delete(cartItems)
        .where(eq(cartItems.userId, userId))
        .returning({ id: cartItems.id });

      if (deletedCount.length === 0)
        return res.status(200).json({ message: "Cart is already empty." });

      getIO().emit("cart:updated", { userId });
      return res.status(200).json({
        message: "Cart cleared successfully.",
        clearedItemsCount: deletedCount.length,
      });
    } catch (error: any) {
      console.error("❌ Error clearing cart:", error);
      return res.status(500).json({ error: "Failed to clear cart." });
    }
  }
);

export default cartRouter;
