import { db } from '../db';
import { products } from '../../shared/backend/schema';
import { eq, like } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { GOOGLE_IMG_SCRAP } from 'google-img-scrap'; // ✅ नई लाइब्रेरी

cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

const DUMMY_BASE = 'https://shopnish.com/placeholder.png';

// ✅ LAYER 2: Google Image Scraper
async function getGoogleImages(query: string) {
  try {
    const res = await GOOGLE_IMG_SCRAP({
      search: query,
      limit: 5,
      
    });
    // 'url' प्रॉपर्टी से असली इमेज लिंक्स निकालें
    return res.result.map(img => img.url).filter(Boolean);
  } catch (err) {
    console.error(`❌ Google Scraping failed for: ${query}`);
    return [];
  }
}

async function processAndUpload(imageUrl: string, productName: string, suffix: string = 'main') {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 12000 });
    const processedBuffer = await sharp(Buffer.from(response.data))
      .resize(800, 800, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .toFormat('jpeg', { quality: 85 })
      .toBuffer();

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'shopnish_products', public_id: `${productName.replace(/\s+/g, '_').toLowerCase()}_${suffix}_${Date.now()}` },
        (error, result) => { if (error) reject(error); else resolve(result?.secure_url || ""); }
      );
      uploadStream.end(processedBuffer);
    });
  } catch (error) { return null; }
}

export const syncProductImages = async () => {
  console.log("🚀 Shopnish Multi-Layer Sync Started (OFF + Google Scrap)...");

  const pendingProducts = await db.select().from(products)
    .where(like(products.image, `%${DUMMY_BASE}%`))
    .limit(15); 

  for (const prod of pendingProducts) {
    let finalImageUrls: string[] = [];
    console.log(`🔎 Processing: ${prod.name}`);

    try {
      // --- LAYER 1: Open Food Facts ---
      const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(prod.name)}&search_simple=1&action=process&json=1`;
      const offRes = await axios.get(offUrl);
      
      if (offRes.data.products?.length > 0) {
        const p = offRes.data.products[0];
        finalImageUrls = [p.image_url, p.image_front_url].filter(Boolean);
      }

      // --- LAYER 2: Google Scraper Fallback ---
      if (finalImageUrls.length === 0) {
        console.log(`🔄 Layer 1 empty. Using Google Scrap for: ${prod.name}`);
        finalImageUrls = await getGoogleImages(prod.name);
      }

      // --- Process & Update ---
      if (finalImageUrls.length > 0) {
        const uploadedUrls: string[] = [];
        for (let i = 0; i < Math.min(finalImageUrls.length, 3); i++) {
          const url = await processAndUpload(finalImageUrls[i], prod.name, i === 0 ? 'main' : `gallery_${i}`);
          if (url) uploadedUrls.push(url);
        }

        if (uploadedUrls.length > 0) {
          await db.update(products).set({
            image: uploadedUrls[0],
            images: uploadedUrls,
            updatedAt: new Date()
          }).where(eq(products.id, prod.id));
          console.log(`✅ Success: ${prod.name}`);
        }
      }
    } catch (err) { console.error(`❌ Error with ${prod.name}`); }

    await new Promise(res => setTimeout(res, 3000));
  }
  console.log("🎯 Batch Sync Complete!");
};