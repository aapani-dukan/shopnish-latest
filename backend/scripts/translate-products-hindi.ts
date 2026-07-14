import { db } from "../server/db"; 
import { masterProducts } from "../shared/backend/schema";
import { eq, isNull } from "drizzle-orm";
// 1. Import change karein
import translate from "translate-google";

async function translateProductNames() {
  console.log("🌍 Starting Auto-Translation (Using translate-google)...");

  try {
    const productsToTranslate = await db
      .select({ id: masterProducts.id, name: masterProducts.name })
      .from(masterProducts)
      .where(isNull(masterProducts.nameHindi));

    console.log(`📦 Found ${productsToTranslate.length} products to translate.`);

    for (const prod of productsToTranslate) {
      if (!prod.name) continue;

      try {
        
        const hindiName = await translate(prod.name, { to: 'hi' });

        await db
          .update(masterProducts)
          .set({ nameHindi: hindiName })
          .where(eq(masterProducts.id, prod.id));

        console.log(`✅ Updated ID ${prod.id}: "${prod.name}" -> "${hindiName}"`);

        // 3. Batch delay (Rate limiting ko bachan ke liye 2 seconds ka gap)
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
      } catch (err) {
        console.error(`❌ Error translating ID ${prod.id}:`, err);
        // Agar error aaye toh thoda zyada ruk jao
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    console.log("🎉 Translation completed!");
  } catch (error) {
    console.error("❌ Fatal Error:", error);
  } finally {
    process.exit();
  }
}

translateProductNames();