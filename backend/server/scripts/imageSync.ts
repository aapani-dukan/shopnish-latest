import { db } from '../db';
import { products, masterProducts } from '../../shared/backend/schema'; 
import { eq, like, or } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { GOOGLE_IMG_SCRAP } from 'google-img-scrap';

cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

// ✅ Purana base hata kar hum broad keywords use karenge
const DUMMY_KEYWORD = 'placehold'; 

async function getGoogleImages(query: string) {
  try {
    const res = await GOOGLE_IMG_SCRAP({
      search: query,
      limit: 5,
    });
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
        { 
          folder: 'shopnish_products', 
          public_id: `${productName.replace(/\s+/g, '_').toLowerCase()}_${suffix}_${Date.now()}` 
        },
        (error, result) => { if (error) reject(error); else resolve(result?.secure_url || ""); }
      );
      uploadStream.end(processedBuffer);
    });
  } catch (error) { return null; }
}

export const syncProductImages = async () => {
  console.log("🚀 Shopnish Master-Level Sync Started...");

  // --- STEP 1: Master Table Fix ---
  // ✅ Broadened query to catch placehold.co, freeiconspng, etc.
  const pendingMasterItems = await db.select().from(masterProducts)
    .where(or(
      like(masterProducts.image, `%${DUMMY_KEYWORD}%`),
      like(masterProducts.image, `%placeholder%`),
      like(masterProducts.image, `%freeiconspng%`)
    ))
    .limit(10); 

  console.log(`📦 Found ${pendingMasterItems.length} Master items to update.`);

  for (const masterProd of pendingMasterItems) {
    let finalUrls: string[] = [];
    try {
      console.log(`🔎 Scraping Master: ${masterProd.name}`);
      const offRes = await axios.get(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(masterProd.name)}&search_simple=1&action=process&json=1`);
      
      if (offRes.data.products?.length > 0) {
        finalUrls = [offRes.data.products[0].image_url].filter(Boolean);
      }

      if (finalUrls.length === 0) {
        finalUrls = await getGoogleImages(masterProd.name);
      }

      if (finalUrls.length > 0) {
        const uploadedUrl = await processAndUpload(finalUrls[0], masterProd.name, 'master');
        
        if (uploadedUrl) {
          await db.update(masterProducts)
            .set({ image: uploadedUrl }) 
            .where(eq(masterProducts.id, masterProd.id));

          await db.update(products)
            .set({ image: uploadedUrl, updatedAt: new Date() })
            .where(eq(products.masterProductId, masterProd.id));

          console.log(`✅ Master Sync OK: ${masterProd.name}`);
        }
      }
    } catch (err) { console.error(`❌ Error with ${masterProd.name}`); }
    await new Promise(res => setTimeout(res, 3000)); // Google block na kare isliye 3s gap
  }

  // --- STEP 2: Manual Products Fix ---
  const pendingManualProducts = await db.select().from(products)
    .where(or(
        like(products.image, `%${DUMMY_KEYWORD}%`),
        like(products.image, `%placeholder%`),
        like(products.image, `%freeiconspng%`),
        like(products.image, `%no-image%`)
    ))
    .limit(10);

  console.log(`📦 Found ${pendingManualProducts.length} Manual items to update.`);

  for (const prod of pendingManualProducts) {
    if (prod.masterProductId) continue; 

    let finalUrls = await getGoogleImages(prod.name);
    if (finalUrls.length > 0) {
      const uploadedUrl = await processAndUpload(finalUrls[0], prod.name, 'manual');
      if (uploadedUrl) {
        await db.update(products)
          .set({ image: uploadedUrl, updatedAt: new Date() })
          .where(eq(products.id, prod.id));
        console.log(`✅ Manual Fix OK: ${prod.name}`);
      }
    }
  }

  console.log("🎯 All Sync Process Finished!");
};