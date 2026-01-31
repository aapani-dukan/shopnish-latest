// backend/server/scripts/imageSync.ts
import { db } from '../db';
import { products } from '../../shared/backend/schema';
import { eq, like } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

const DUMMY_BASE = 'https://shopnish.com/placeholder.png';

async function processAndUpload(imageUrl: string, productName: string, suffix: string = 'main') {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const inputBuffer = Buffer.from(response.data);

    const processedBuffer = await sharp(inputBuffer)
      .resize(800, 800, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toFormat('jpeg', { quality: 85 })
      .toBuffer();

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'shopnish_products',
          // Suffix adds 'main', 'g1', 'g2' to differentiate files
          public_id: `${productName.replace(/\s+/g, '_').toLowerCase()}_${suffix}_${Date.now()}`,
          upload_preset: 'shopnish_products'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result?.secure_url || "");
        }
      );
      uploadStream.end(processedBuffer);
    });
  } catch (error) {
    return null;
  }
}

export const syncProductImages = async () => {
  console.log("🚀 Shopnish High-Class Sync Started (Gallery Mode)...");

  const pendingProducts = await db.select().from(products)
    .where(like(products.image, `%${DUMMY_BASE}%`))
    .limit(25); // छोटे बैच में करें ताकि टाइमआउट न हो

  console.log(`🔎 Found ${pendingProducts.length} items to fix.`);

  for (const prod of pendingProducts) {
    try {
      console.log(`Searching: ${prod.name}...`);
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(prod.name)}&search_simple=1&action=process&json=1`;
      const res = await axios.get(offUrl);
      
      if (res.data.products?.length > 0) {
        // 1. TOP 4 इमेजेस निकालें (1 Main + 3 Gallery)
        const productData = res.data.products[0];
        const imageUrls = [
          productData.image_url,
          productData.image_front_url,
          productData.image_ingredients_url,
          productData.image_nutrition_url
        ].filter(url => url !== undefined); // सिर्फ valid URLs रखें

        const uploadedUrls: string[] = [];

        // 2. सब इमेजेस को लूप में प्रोसेस करें
        for (let i = 0; i < Math.min(imageUrls.length, 4); i++) {
          const suffix = i === 0 ? 'main' : `gallery_${i}`;
          const url = await processAndUpload(imageUrls[i], prod.name, suffix);
          if (url) uploadedUrls.push(url);
        }

        if (uploadedUrls.length > 0) {
          await db.update(products)
            .set({
              image: uploadedUrls[0], // पहली इमेज मेन है
              images: uploadedUrls,    // पूरा एरे गैलरी में
              updatedAt: new Date()
            })
            .where(eq(products.id, prod.id));

          console.log(`✅ Success: ${prod.name} (Images: ${uploadedUrls.length})`);
        }
      }
    } catch (err) {
      console.log(`❌ Skipping ${prod.name} due to error`);
    }
    
    await new Promise(res => setTimeout(res, 1500));
  }
  console.log("🎯 Sync Complete! Gallery and Main images updated.");
};