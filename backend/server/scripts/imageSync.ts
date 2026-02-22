import { db } from '../db';
import { products, masterProducts } from '../../shared/backend/schema'; 
import { eq, like, or, and, isNull } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { GOOGLE_IMG_SCRAP } from 'google-img-scrap';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

const DUMMY_KEYWORD = 'placehold';

// --- HELPER FUNCTIONS (RE-USABLE) ---

async function getGoogleImages(query: string) {
  try {
    const res = await GOOGLE_IMG_SCRAP({ search: query, limit: 5 });
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

    // 🚀 SPECIAL CHARACTERS FIX (Like '&', '%', etc.)
    // Hum sirf letters, numbers aur underscore hi rehne denge
    const safeName = productName
      .replace(/[^\w\s]/gi, '') // Sabhi special characters hata do
      .replace(/\s+/g, '_')     // Spaces ko underscore bana do
      .toLowerCase();

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'shopnish_products', 
          public_id: `${safeName}_${suffix}_${Date.now()}` 
        },
        (error, result) => { if (error) reject(error); else resolve(result?.secure_url || ""); }
      );
      uploadStream.end(processedBuffer);
    });
  } catch (error) { return null; }
}
// --- BUTTON 1: MASTER PRODUCT SYNC ---
// Isse Master Table update hogi + Product Table ki main image sync hogi
export const syncMasterTableOnly = async () => {
  console.log("🚀 Starting MASTER ONLY Sync...");
  const items = await db.select().from(masterProducts)
    .where(or(
      like(masterProducts.image, `%${DUMMY_KEYWORD}%`),
      like(masterProducts.image, `%placeholder%`),
      like(masterProducts.image, `%freeiconspng%`)
    ))
    .limit(10);

  for (const item of items) {
    console.log(`🔎 Scraping Master: ${item.name}`);
    const urls = await getGoogleImages(item.name);
    if (urls.length > 0) {
      const cloudinaryUrl = await processAndUpload(urls[0], item.name, 'master');
      if (cloudinaryUrl) {
        await db.update(masterProducts).set({ image: cloudinaryUrl }).where(eq(masterProducts.id, item.id));
        await db.update(products).set({ image: cloudinaryUrl }).where(eq(products.masterProductId, item.id));
        console.log(`✅ Master Updated: ${item.name}`);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
};

// --- BUTTON 2: MANUAL PRODUCT SYNC ---
// Isse sirf wo products sync honge jo Master Table mein NAHI hain (No Master ID)
export const syncManualProductsOnly = async () => {
  console.log("🚀 Starting MANUAL ONLY Sync...");
  
  const items = await db.select().from(products)
    .where(and(
      // 🚩 Hum check karenge ki Master ID null ho AUR image dummy ho
      isNull(products.masterProductId), 
      or(
        like(products.image, `%${DUMMY_KEYWORD}%`),
        like(products.image, `%freeiconspng%`),
        like(products.image, `%placeholder%`)
      )
    ))
    .limit(10); // 🚩 Load kam karne ke liye 5 hi rakhein

  console.log(`📦 Database found ${items.length} manual items.`);

  for (const item of items) {
    console.log(`👉 Now processing: ${item.name} (ID: ${item.id})`);

    try {
      // 1. Image Search
      const sourceUrls = await getGoogleImages(item.name);
      console.log(`🔎 Google found ${sourceUrls.length} images for ${item.name}`);

      if (sourceUrls.length === 0) {
        console.log(`⚠️ No images found for ${item.name}, skipping...`);
        continue;
      }

      // 2. Upload Process
      console.log(`☁️ Uploading to Cloudinary...`);
      const cloudinaryUrl = await processAndUpload(sourceUrls[0], item.name, 'manual_main');

      if (cloudinaryUrl) {
        // 3. Database Update
        await db.update(products)
          .set({ 
            image: cloudinaryUrl, 
            updatedAt: new Date() 
          })
          .where(eq(products.id, item.id));
        
        console.log(`✅ SUCCESSFULLY UPDATED: ${item.name}`);
      } else {
        console.log(`❌ Cloudinary upload failed for ${item.name}`);
      }

    } catch (err: any) {
      console.error(`❌ Error in loop for ${item.name}:`, err.message);
    }

    // 🚩 5 second ka gap taaki Render crash na ho
    console.log("⏳ Waiting 5 seconds for next item...");
    await new Promise(r => setTimeout(r, 5000));
  }
  
  console.log("🎯 ALL MANUAL ITEMS PROCESSED!");
};

// --- BUTTON 3: GALLERY SYNC ---
// Isse keval Product Table ka 'images' column update hoga (Extra photos)
export const syncProductGalleriesOnly = async () => {
  console.log("🚀 Filling Product Galleries...");
  // Wo products jinki gallery khali hai ya dummy hai
  const items = await db.select().from(products)
    .where(or(isNull(products.images), eq(products.images, [])))
    .limit(10);

  for (const item of items) {
    console.log(`📸 Generating Gallery for: ${item.name}`);
    const sourceUrls = await getGoogleImages(item.name);
    if (sourceUrls.length > 0) {
      const galleryUrls: string[] = [];
      for (let i = 0; i < Math.min(sourceUrls.length, 3); i++) {
        const url = await processAndUpload(sourceUrls[i], item.name, `gallery_${i}`);
        if (url) galleryUrls.push(url);
      }
      if (galleryUrls.length > 0) {
        await db.update(products).set({ images: galleryUrls }).where(eq(products.id, item.id));
        console.log(`✅ Gallery Fixed: ${item.name}`);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
};