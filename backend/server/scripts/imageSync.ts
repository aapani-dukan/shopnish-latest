// backend/server/scripts/imageSync.ts
import { db } from '../db';
import { products } from '../../shared/backend/schema';
import { eq, like } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary कॉन्फ़िगरेशन
cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

const DUMMY_BASE = 'https://shopnish.com/placeholder.png';

// इमेज को प्रोसेस और अपलोड करने का फंक्शन
async function processAndUpload(imageUrl: string, productName: string) {
  try {
    // 1. इमेज डाउनलोड करें
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const inputBuffer = Buffer.from(response.data);

    // 2. Sharp से प्रोसेस करें (White Background + 800x800)
    const processedBuffer = await sharp(inputBuffer)
      .resize(800, 800, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toFormat('jpeg', { quality: 85 })
      .toBuffer();

    // 3. Cloudinary पर अपलोड करें
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'shopnish_products',
          public_id: productName.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now(),
          upload_preset: 'shopnish_products'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result?.secure_url);
        }
      );
      uploadStream.end(processedBuffer);
    });
  } catch (error) {
    console.error(`❌ Processing failed for ${productName}:`, error);
    return null;
  }
}

export const syncProductImages = async () => {
  console.log("🚀 Shopnish High-Class Sync Started...");

  const pendingProducts = await db.select().from(products)
    .where(like(products.image, `%${DUMMY_BASE}%`));

  console.log(`🔎 Found ${pendingProducts.length} items to fix.`);

  for (const prod of pendingProducts) {
    try {
      console.log(`Searching: ${prod.name}...`);
      
      // Open Food Facts से सर्च
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(prod.name)}&search_simple=1&action=process&json=1`;
      const res = await axios.get(offUrl);
      
      if (res.data.products?.length > 0) {
        const rawUrl = res.data.products[0].image_url;
        
        // प्रोसेस और क्लाउड पर अपलोड
        const newCloudUrl = await processAndUpload(rawUrl, prod.name) as string;

        if (newCloudUrl) {
          await db.update(products)
            .set({
              image: newCloudUrl,
              updatedAt: new Date()
            })
            .where(eq(products.id, prod.id));

          console.log(`✅ Success: ${prod.name} -> ${newCloudUrl}`);
        }
      }
    } catch (err) {
      console.log(`❌ Error skipping ${prod.name}`);
    }
    
    // थोड़ा गैप ताकि API ब्लॉक न हो
    await new Promise(res => setTimeout(res, 1200));
  }
  console.log("🎯 Sync Complete! Shopnish is now officially HD.");
};