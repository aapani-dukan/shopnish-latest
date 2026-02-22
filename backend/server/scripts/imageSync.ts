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
  console.log("🚀 Shopnish High-Class Sync Started...");

  // --- STEP 1: Master Table & Product Gallery Sync ---
  const pendingMasterItems = await db.select().from(masterProducts)
    .where(or(
      like(masterProducts.image, `%${DUMMY_KEYWORD}%`),
      like(masterProducts.image, `%placeholder%`),
      like(masterProducts.image, `%freeiconspng%`)
    ))
    .limit(10); 

  console.log(`📦 Found ${pendingMasterItems.length} Master items.`);

  for (const masterProd of pendingMasterItems) {
    try {
      console.log(`🔎 Processing: ${masterProd.name}`);
      let sourceUrls = await getGoogleImages(masterProd.name);

      if (sourceUrls.length > 0) {
        const uploadedGallery: string[] = [];
        
        // Top 3 photos ko Cloudinary pe bhejo Gallery ke liye
        for (let i = 0; i < Math.min(sourceUrls.length, 3); i++) {
          const url = await processAndUpload(sourceUrls[i], masterProd.name, i === 0 ? 'main' : `gallery_${i}`);
          if (url) uploadedGallery.push(url);
        }

        if (uploadedGallery.length > 0) {
          // 1. Master Table: Sirf pehli photo (Kyunki isme gallery column nahi hai)
          await db.update(masterProducts)
            .set({ image: uploadedGallery[0] }) 
            .where(eq(masterProducts.id, masterProd.id));

          // 2. Product Table: Main Image + Images Gallery dono!
          await db.update(products)
            .set({ 
              image: uploadedGallery[0], 
              images: uploadedGallery, // ✅ Yahan extra images save hongi
              updatedAt: new Date() 
            })
            .where(eq(products.masterProductId, masterProd.id));

          console.log(`✅ Fully Synced (Gallery Included): ${masterProd.name}`);
        }
      }
    } catch (err) { console.error(`❌ Error with ${masterProd.name}`); }
    await new Promise(res => setTimeout(res, 3000));
  }

  // --- STEP 2: Manual Items Fix (No Master) ---
  const pendingManual = await db.select().from(products)
    .where(or(
        like(products.image, `%${DUMMY_KEYWORD}%`),
        like(products.image, `%freeiconspng%`)
    ))
    .limit(10);

  for (const prod of pendingManual) {
    if (prod.masterProductId) continue; 

    let sourceUrls = await getGoogleImages(prod.name);
    if (sourceUrls.length > 0) {
      const uploadedGallery: string[] = [];
      for (let i = 0; i < Math.min(sourceUrls.length, 3); i++) {
        const url = await processAndUpload(sourceUrls[i], prod.name, `manual_${i}`);
        if (url) uploadedGallery.push(url);
      }
      
      if (uploadedGallery.length > 0) {
        await db.update(products)
          .set({ 
            image: uploadedGallery[0], 
            images: uploadedGallery, // ✅ Gallery updated
            updatedAt: new Date() 
          })
          .where(eq(products.id, prod.id));
        console.log(`✅ Manual Fix with Gallery: ${prod.name}`);
      }
    }
  }
  console.log("🎯 All Sync Process Finished!");
};