// backend/src/services/productService.ts
import { db } from '../server/db';
import { products, productHistory,sellersPgTable, users, notifications} from '../shared/backend/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { sendLowStockWhatsAppAlert } from '../server/lib/whatsappHelpers'; 
export class ProductService {
  
  // ✅ HIGH-CLASS UPDATE: Versioning + Price History
  static async updateProduct(productId: number, sellerId: number, updateData: any) {
    return await db.transaction(async (tx) => {
      // 1. Pehle existing product check karo
      const [existing] = await tx.select().from(products)
        .where(and(eq(products.id, productId), eq(products.sellerId, sellerId), isNull(products.deletedAt)));

      if (!existing) throw new Error("Product not found or access denied.");

      // 2. Versioning Logic: Agar price badla toh history record karo
      if (updateData.price && Number(updateData.price) !== Number(existing.price)) {
        await tx.insert(productHistory).values({
          productId: productId,
          oldPrice: existing.price.toString(),
          newPrice: updateData.price.toString(),
          changedBy: sellerId, // Seller ID
          changeReason: updateData.changeReason || "Price updated",
        });
        updateData.version = (existing.version || 1) + 1;
      }

      // 3. Final Update
      const [updated] = await tx.update(products)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning();

      return updated;
    });
  }

  // ✅ SOFT DELETE: Database se gayab nahi hoga, bas hide hoga
  static async softDelete(productId: number, sellerId: number) {
    return await db.update(products)
      .set({ 
        deletedAt: new Date(), 
        isActive: false 
      })
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));
  }
  // backend/src/services/productService.ts

// ✅ 3. LOW STOCK NOTIFIER: Real-time Alert Logic
  static async checkLowStockAndNotify(productId: number, currentStock: number | null, sellerId: number | null) {
    if (currentStock === null || sellerId === null) return;

    const LOW_STOCK_THRESHOLD = 5;

    if (currentStock <= LOW_STOCK_THRESHOLD) {
      try {
        // 1. Seller ka phone number nikalo (Users table se join karke)
        const [sellerData] = await db
          .select({
            phone: users.phone,
            businessName: sellersPgTable.businessName,
            name: products.name
          })
          .from(products)
          .innerJoin(sellersPgTable, eq(products.sellerId, sellersPgTable.id))
          .innerJoin(users, eq(sellersPgTable.userId, users.id))
          .where(eq(products.id, productId));

        if (sellerData && sellerData.phone) {
          // 2. WhatsApp Alert bhejo
          await sendLowStockWhatsAppAlert(
            sellerData.phone, 
            sellerData.name, 
            currentStock
          );
          console.log(`✅ WhatsApp Alert sent to seller for product: ${sellerData.name}`);
        }

        // 3. In-App Notification entry (Purana logic)
        await db.insert(notifications).values({
          userId: sellerId,
          title: "Low Stock Alert! 📉",
          message: `${sellerData?.name || 'Product'} ka stock sirf ${currentStock} bacha hai.`,
          type: "LOW_STOCK",
        } as any);

      } catch (err) {
        console.error("❌ Notification flow failed:", err);
      }
    }
  }
}