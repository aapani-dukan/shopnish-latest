import { db } from '../db';
import { products } from '../../shared/backend/schema';
import { eq, like } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

const DUMMY_BASE = 'https://shopnish.com/placeholder.png';

// ✅ DuckDuckGo से फ्री और अनलिमिटेड इमेज सर्च करने का फंक्शन
async function getDuckDuckGoImages(query: string) {
  try {
    const searchUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json`;
    const res = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    // टॉप 5 इमेज लिंक्स निकालें
    return res.data.results?.map((img: any) => img.image).filter(Boolean).slice(0, 5) || [];
  } catch (err) {
    console.error(`❌ DuckDuckGo search failed for: ${query}`);
    return [];
  }
}

async function processAndUpload(imageUrl: string, productName: string, suffix: string = 'main') {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
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
          public_id: `${productName.replace(/\s+/g, '_').toLowerCase()}_${suffix}_${Date.now()}`,
          upload_preset: 'shopnish_products' // सुनिश्चित करें कि ये आपके क्लाउडिनरी में बना हो
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
  console.log("🚀 Shopnish High-Class Sync Started (DuckDuckGo Mode)...");

  const pendingProducts = await db.select().from(products)
    .where(like(products.image, `%${DUMMY_BASE}%`))
    .limit(25); 

  console.log(`🔎 Found ${pendingProducts.length} items to fix.`);

  for (const prod of pendingProducts) {
    try {
      console.log(`🔎 Searching: ${prod.name}...`);
      
      // ✅ DuckDuckGo से फोटो ढूंढें (अब Dal Makhani भी मिलेगा!)
      const imageUrls = await getDuckDuckGoImages(prod.name);

      if (imageUrls.length > 0) {
        const uploadedUrls: string[] = [];

        // ✅ Top 3 फोटो प्रोसेस करें (Main + 2 Gallery)
        for (let i = 0; i < Math.min(imageUrls.length, 3); i++) {
          const suffix = i === 0 ? 'main' : `gallery_${i}`;
          const url = await processAndUpload(imageUrls[i], prod.name, suffix);
          if (url) uploadedUrls.push(url);
        }

        if (uploadedUrls.length > 0) {
          await db.update(products)
            .set({
              image: uploadedUrls[0], // पहली फोटो मेन में
              images: uploadedUrls,    // सारी फोटो एरे में
              updatedAt: new Date()
            })
            .where(eq(products.id, prod.id));

          console.log(`✅ Success: ${prod.name} (Updated with ${uploadedUrls.length} images)`);
        } else {
          console.log(`⚠️ Image found but failed to upload for: ${prod.name}`);
        }
      } else {
        console.log(`⚠️ No images found for: ${prod.name}`);
      }
    } catch (err: any) {
      console.log(`❌ Error Processing ${prod.name}:`, err.response?.status || err.message);
    }
    
    // 2 सेकंड का गैप (Anti-spam)
    await new Promise(res => setTimeout(res, 2000));
  }
  console.log("🎯 Sync Complete! All products processed.");
};