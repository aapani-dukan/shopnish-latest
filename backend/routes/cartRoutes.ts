import { Router, Response, NextFunction } from "express";
import { db } from "../server/db.ts";
import {
  users,
  cartItems,
  products,
  approvalStatusEnum,
  sellersPgTable,
} from "../shared/backend/schema.ts";
import { eq, and } from "drizzle-orm";
import { AuthenticatedRequest } from "../server/middleware/verifyToken.ts";
import { requireAuth } from "../server/middleware/authMiddleware.ts";
import { getIO } from "../server/socket.ts";

const cartRouter = Router();

/* ============================================
   🛒 1. GET /api/cart — Get User’s Cart
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
            },
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
        .map((item) => {
          if (
            !item.product ||
            item.product.approvalStatus !== approvalStatusEnum.enumValues[1]
          ) {
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
        message: "Cart fetched successfully",
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
   ➕ 2. POST /api/cart/add — Add Item to Cart
============================================ */
cartRouter.post(
  "/add",
  requireAuth,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const { productId, quantity } = req.body;

      if (!userId)
        return res.status(401).json({ error: "Unauthorized: Missing user ID" });

      if (!productId || typeof quantity !== "number" || quantity <= 0) {
        return res
          .status(400)
          .json({ error: "Invalid productId or quantity." });
      }

      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product)
        return res.status(404).json({ error: "Product not found." });

      if (product.approvalStatus !== approvalStatusEnum.enumValues[1]) {
        return res
          .status(400)
          .json({ error: "Product is not approved for sale." });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          error: `Insufficient stock. Only ${product.stock} units available.`,
        });
      }

      if (product.minOrderQty && quantity < product.minOrderQty) {
        return res.status(400).json({
          error: `Minimum order quantity for ${product.name} is ${product.minOrderQty}.`,
        });
      }

      if (product.maxOrderQty && quantity > product.maxOrderQty) {
        return res.status(400).json({
          error: `Maximum order quantity for ${product.name} is ${product.maxOrderQty}.`,
        });
      }

      const priceAtAdded = product.price;
      const sellerId = product.sellerId;
      const newTotalPrice = priceAtAdded * quantity;

      const [existingItem] = await db
        .select()
        .from(cartItems)
        .where(
          and(eq(cartItems.userId, userId), eq(cartItems.productId, productId))
        );

      let item;

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;

        if (newQuantity > product.stock) {
          return res.status(400).json({
            error: `Cannot add ${quantity} units. Only ${
              product.stock - existingItem.quantity
            } units available.`,
          });
        }

        const newTotalPrice = priceAtAdded * newQuantity;

        const updatedItem = await db
          .update(cartItems)
          .set({
            quantity: newQuantity,
            totalPrice: newTotalPrice,
            updatedAt: new Date(),
          })
          .where(eq(cartItems.id, existingItem.id))
          .returning();

        item = updatedItem[0];
      } else {
        const newItem = await db
          .insert(cartItems)
          .values({
            userId,
            productId,
            quantity,
            priceAtAdded,
            totalPrice: newTotalPrice,
            sellerId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }as any) // Type assertion to any to bypass type issues
          .returning();

        item = newItem[0];
      }

      getIO().emit("cart:updated", { userId });
      return res.status(200).json({ message: "Item added to cart.", item });
    } catch (error: any) {
      console.error("❌ Error adding item to cart:", error);
      return res.status(500).json({ error: "Failed to add item to cart." });
    }
  }
);

/* ============================================
   ✏️ 3. PUT /api/cart/:id — Update Quantity
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

      const [existingCartItem] = await db.query.cartItems.findMany({
        where: and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)),
        with: {
          product: {
            columns: {
              id: true,
              name: true,
              stock: true,
              price: true,
              minOrderQty: true,
              maxOrderQty: true,
            },
          },
        },
      });

      if (!existingCartItem || !existingCartItem.product) {
        return res.status(404).json({
          message:
            "Cart item or associated product not found or does not belong to user.",
        });
      }

      const product = existingCartItem.product;
      const priceAtAdded = existingCartItem.priceAtAdded;

      if (quantity === 0) {
        const [deletedItem] = await db
          .delete(cartItems)
          .where(eq(cartItems.id, cartItemId))
          .returning();

        if (!deletedItem) {
          return res
            .status(404)
            .json({ message: "Cart item not found or failed to delete." });
        }

        getIO().emit("cart:updated", { userId });
        return res.status(200).json({
          message: "Cart item removed successfully (quantity set to 0).",
          item: deletedItem,
        });
      }

      if (quantity > product.stock) {
        return res.status(400).json({
          error: `Insufficient stock. Only ${product.stock} units available.`,
        });
      }

      if (product.minOrderQty && quantity < product.minOrderQty) {
        return res.status(400).json({
          error: `Minimum order quantity for ${product.name} is ${product.minOrderQty}.`,
        });
      }

      if (product.maxOrderQty && quantity > product.maxOrderQty) {
        return res.status(400).json({
          error: `Maximum order quantity for ${product.name} is ${product.maxOrderQty}.`,
        });
      }

      const newTotalPrice = priceAtAdded * quantity;

      const [updatedItem] = await db
        .update(cartItems)
        .set({
          quantity,
          totalPrice: newTotalPrice,
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, cartItemId))
        .returning();

      getIO().emit("cart:updated", { userId });

      return res
        .status(200)
        .json({ message: "Cart item updated successfully.", item: updatedItem });
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
