import { db } from '../server/db';
import { masterProducts, productSubcategories } from '../shared/backend/schema';
import { eq } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary config - apni actual keys yahan daalo (baad mein rotate karna)
cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU',
});

// Cloudinary URL se public_id nikaalna
// e.g. https://res.cloudinary.com/xxx/image/upload/v123/shopnish_products/name_master_123.jpg
//      -> "shopnish_products/name_master_123"
function extractPublicIdFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+(?:\?.*)?$/);
  return match ? match[1] : null;
}

// =========================================================
// 🔥 DUPLICATE CLEANUP - findDuplicates.ts se bani CSV ko apply karta hai
// =========================================================
// NOTE: 'productSubcategories' table aur uski fields (masterProductId,
// subcategoryId) apni schema ke actual naam se match karke adjust kar lena
// agar alag hain.
//
// Kaam har row (delete_id, keep_id) ke liye:
// 1. delete_id ki saari subcategory rows dekhta hai
//    - agar wahi subcategory keep_id ke paas already hai -> us duplicate
//      row ko delete kar deta hai
//    - agar keep_id ke paas nahi hai -> us row ko keep_id par shift kar
//      deta hai (taaki subcategory data loss na ho)
// 2. Fir "delete_id" wali duplicate master row ko delete kar deta hai
//
// Seller/products table ko is script mein CHUAYA NAHI gaya hai - abhi
// sirf dummy data hai, alag se handle hoga.
//
// RUN: npx ts-node applyDuplicateCleanup.ts duplicate-cleanup.csv

async function run() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('❌ CSV file ka path do: npx ts-node applyDuplicateCleanup.ts duplicate-cleanup.csv');
    process.exit(1);
  }

  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.join(__dirname, csvPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.trim().split('\n').slice(1); // header skip karo

  console.log(`📄 ${lines.length} duplicate entries CSV mein mile.`);

  let mergedCount = 0;
  let skippedDuplicateSubcatCount = 0;
  let deletedCount = 0;
  let errorCount = 0;

  for (const line of lines) {
    const [deleteIdStr, keepIdStr] = line.split(',').map(s => s.trim());
    const deleteId = Number(deleteIdStr);
    const keepId = Number(keepIdStr);

    if (!deleteId || !keepId) {
      console.log(`⚠️ Invalid row skip: ${line}`);
      continue;
    }

    try {
      // Step 0: images compare karo - agar alag hain to delete wali image
      // Cloudinary se bhi hata do (orphan storage na bache)
      const [deleteProduct] = await db.select().from(masterProducts).where(eq(masterProducts.id, deleteId));
      const [keepProduct] = await db.select().from(masterProducts).where(eq(masterProducts.id, keepId));

      if (deleteProduct?.image && deleteProduct.image !== keepProduct?.image) {
        const publicId = extractPublicIdFromUrl(deleteProduct.image);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
            console.log(`🗑️ Cloudinary image deleted: ${publicId}`);
          } catch (imgErr: any) {
            console.error(`⚠️ Cloudinary image delete fail (${publicId}):`, imgErr?.message);
          }
        }
      } else {
        console.log(`ℹ️ ID ${deleteId} ki image keep_id se same hai (ya khaali) - Cloudinary delete skip.`);
      }

      // Step 1: keep_id ki existing subcategories nikaalo
      const keepRows = await db.select().from(productSubcategories)
        .where(eq(productSubcategories.masterProductId, keepId));
      const keepSubcatIds = new Set(keepRows.map((r: any) => r.subCategoryId));

      // Step 2: delete_id ki subcategories dekho, merge ya shift karo
      const deleteRows = await db.select().from(productSubcategories)
        .where(eq(productSubcategories.masterProductId, deleteId));

      for (const row of deleteRows) {
        if (keepSubcatIds.has(row.subCategoryId)) {
          // Already keep_id ke paas hai - duplicate row delete karo
          await db.delete(productSubcategories).where(eq(productSubcategories.id, row.id));
          skippedDuplicateSubcatCount++;
        } else {
          // Missing hai keep_id mein - shift kar do
          await db.update(productSubcategories)
            .set({ masterProductId: keepId })
            .where(eq(productSubcategories.id, row.id));
          mergedCount++;
        }
      }

      console.log(`↪️ ID ${deleteId} -> ${keepId}: subcategories merge ho gayi.`);

      // Step 3: duplicate master row delete karo
      await db.delete(masterProducts).where(eq(masterProducts.id, deleteId));
      console.log(`🗑️ Deleted duplicate master product ID ${deleteId}`);
      deletedCount++;
    } catch (err: any) {
      console.error(`❌ Error processing ID ${deleteId}:`, err?.message || err);
      errorCount++;
    }
  }

  console.log('\n----- CLEANUP SUMMARY -----');
  console.log(`Subcategories shifted (merged): ${mergedCount}`);
  console.log(`Duplicate subcategory rows removed: ${skippedDuplicateSubcatCount}`);
  console.log(`Master duplicates deleted: ${deletedCount}`);
  console.log(`Errors: ${errorCount}`);
}

run();