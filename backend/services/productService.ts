// backend/src/services/productService.ts
import { db } from '../server/db';
import { products, productHistory,sellersPgTable, users, notifications,productVariants} from '../shared/backend/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { sendLowStockWhatsAppAlert } from '../server/lib/whatsappHelpers'; 
export class ProductService {
  
 // ✅ HIGH-CLASS UPDATE: Versioning + Price History (Variant Aware Fix भाई)
  static async updateProduct(productId: number, variantId: number, sellerId: number, updateData: any) {
    return await db.transaction(async (tx) => {
      // 1. Pehle check karo ki product aur variant sahi hain ya nahi भाई
      const [existingProduct] = await tx.select().from(products)
        .where(and(eq(products.id, productId), eq(products.sellerId, sellerId), isNull(products.deletedAt)));

      if (!existingProduct) throw new Error("Product not found or access denied.");

      const [existingVariant] = await tx.select().from(productVariants) // ध्यान दें भाई, स्कीमा के अनुसार productVariants नाम है
        .where(eq(productVariants.id, variantId));

      if (!existingVariant) throw new Error("Product Variant not found.");

     // 2. Versioning Logic: Agar price badla toh variant level par history record karo भाई
      if (updateData.price && Number(updateData.price) !== Number(existingVariant.price)) {
        await tx.insert(productHistory).values({
          productId: productId,
          variantId: variantId,
          oldPrice: existingVariant.price.toString(),
          newPrice: updateData.price.toString(),
          changedBy: sellerId, 
          changeReason: updateData.changeReason || "Variant Price updated",
        } as any);

        // 🎯 फिक्स: वर्जन को हमेशा मुख्य 'existingProduct' से उठाएं भाई!
        const nextVersion = (existingProduct.version || 1) + 1;

        // मुख्य प्रोडक्ट टेबल में भी नया वर्जन नंबर सिंक कर दो भाई
        await tx.update(products)
          .set({ version: nextVersion, updatedAt: new Date() })
          .where(eq(products.id, productId));
          
        // अगर updateData में सेलर ने कुछ भेजा है तो उसे क्लीन रखें
        delete updateData.version; 
      }
      // 3. Final Update: वैरिएंट की डिटेल्स को वैरिएंट टेबल में अपडेट करो भाई
      const [updatedVariant] = await tx.update(productVariants)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId))
        .returning();

      return updatedVariant;
    });
  }
 // ✅ SOFT DELETE: Database se gayab nahi hoga, bas product aur uske saare variants hide honge bhai
  static async softDelete(productId: number, sellerId: number) {
    return await db.transaction(async (tx) => {
      // 1. मुख्य प्रोडक्ट को soft delete करो भाई
      await tx.update(products)
        .set({ 
          deletedAt: new Date(), 
          isActive: false 
        })
        .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));

      // 2. 🎯 मास्टरस्ट्रोक: उसके सारे वैरिएंट्स को भी पैरेलल में डीएक्टिवेट कर दो भाई
      await tx.update(productVariants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(productVariants.productId, productId));
        
      return { success: true };
    });
  }

// ✅ 3. LOW STOCK NOTIFIER: Real-time Alert Logic (Variant Level Connected भाई)
  static async checkLowStockAndNotify(productId: number, variantId: number, currentStock: number | null, sellerId: number | null) {
    if (currentStock === null || sellerId === null) return;

    const LOW_STOCK_THRESHOLD = 5;

    if (currentStock <= LOW_STOCK_THRESHOLD) {
      try {
        // 1. 🎯 फिक्स: अब प्रोडक्ट नाम के साथ वैरिएंट की मात्रा और यूनिट भी जॉइन से निकालेंगे भाई
        const [sellerData] = await db
          .select({
            phone: users.phone,
            businessName: sellersPgTable.businessName,
            productName: products.name,
            variantQty: productVariants.quantityValue,
            variantUnit: productVariants.unit
          })
          .from(products)
          .innerJoin(productVariants, eq(products.id, productVariants.productId))
          .innerJoin(sellersPgTable, eq(products.sellerId, sellersPgTable.id))
          .innerJoin(users, eq(sellersPgTable.userId, users.id))
          .where(and(eq(products.id, productId), eq(productVariants.id, variantId)));

        // सुंदर नाम तैयार करो भाई, जैसे: "Colgate (250 Gram)"
        const fullItemName = sellerData 
          ? `${sellerData.productName} (${sellerData.variantQty} ${sellerData.variantUnit})`
          : "Product Variant";

        if (sellerData && sellerData.phone) {
          // 2. WhatsApp Alert bhejo
          await sendLowStockWhatsAppAlert(
            sellerData.phone, 
            fullItemName, // ✅ अब साइज के साथ नाम जाएगा भाई
            currentStock
          );
          console.log(`✅ WhatsApp Alert sent to seller for variant: ${fullItemName}`);
        }

        // 3. In-App Notification entry
        await db.insert(notifications).values({
          userId: sellerId,
          title: "Low Stock Alert! 📉",
          message: `${fullItemName} का स्टॉक सिर्फ ${currentStock} बचा है भाई। कृपया रीस्टॉक करें।`,
          type: "LOW_STOCK",
        } as any);

      } catch (err) {
        console.error("❌ Notification flow failed:", err);
      }
    }
  }
}