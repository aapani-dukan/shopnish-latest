import { db } from '../db';
import { products, masterProducts } from '../../shared/backend/schema'; 
import { eq, like, or, and, isNull,isNotNull } from 'drizzle-orm';
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
    console.error(`❌ Google Scraping failed for: ${query}`, err);
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
  } catch (error) { 
  console.error("PROCESS UPLOAD ERROR:", error);
  return null; 
}
}
// --- BUTTON 1: MASTER PRODUCT SYNC ---
// --- 1. MASTER SYNC (Ab ye sirf Master Table chamkayega) ---
export const syncMasterTableOnly = async () => {
  console.log("🚀 Deep Syncing Master Catalog...");
  const items = await db.select().from(masterProducts)
    .where(or(
      like(masterProducts.image, `%placehold%`),
      like(masterProducts.image, `%placeholder%`),
      like(masterProducts.image, `%freeiconspng%`),
      like(masterProducts.image, `%no-image%`),
      like(masterProducts.image, `%t4.ftcdn.net%`)
    ))
    .limit(20); 

  console.log(`📦 Found ${items.length} Master items to search on Google.`);

  for (const item of items) {
    try {
      console.log(`🔎 Scraping HD Image for Master: ${item.name}`);
      const urls = await getGoogleImages(item.name);
      console.log("GOOGLE URLS:", urls);
      if (urls.length > 0) {
        // SafeName fix ke sath upload
        const cloudinaryUrl = await processAndUpload(urls[0], item.name, 'master');
        console.log("CLOUDINARY URL:", cloudinaryUrl);
    console.log(`🌐 Google Result:`, urls[0]);

console.log(`☁️ Uploaded To Cloudinary:`, cloudinaryUrl);
        if (cloudinaryUrl) {
          await db.update(masterProducts)
            .set({ image: cloudinaryUrl })
            .where(eq(masterProducts.id, item.id));
          console.log(`✅ Master Table Updated: ${item.name}`);
        }
      }
    } catch (err) {
      console.error(`❌ Error with ${item.name}`);
    }
    // 4 second gap taaki Google block na kare
    await new Promise(r => setTimeout(r, 4000));
  }
  console.log("🎯 Master Sync Batch Finished!");
};

// --- 2. seller product SYNC (Ab ye Fast Transfer karega: Master -> Product) ---
export const syncManualProductsOnly = async () => {
  console.log("🚀 Fast Transfer Started: Copying Master links to Products...");
  
  const dummyProducts = await db.select().from(products)
    .where(and(
      isNotNull(products.masterProductId),
      or(
        like(products.image, `%placehold%`),
        like(products.image, `%no-image%`),
        like(products.image, `%freeiconspng%`),
        eq(products.image, ''),
        isNull(products.image)
      )
    ))
    .limit(100); // Scraping nahi hai, isliye limit 100 rakhi hai

  console.log(`📦 Found ${dummyProducts.length} dummy products to fix via Master Table.`);

  let updatedCount = 0;

  for (const prod of dummyProducts) {
    // Master table se is product ki photo check karo
    const [masterData] = await db.select({ image: masterProducts.image })
      .from(masterProducts)
      .where(eq(masterProducts.id, prod.masterProductId!));

    // Agar Master table mein asli photo mil gayi (dummy nahi hai), toh copy karo
    if (masterData?.image && 
        !masterData.image.includes('placehold') && 
        !masterData.image.includes('no-image') &&
        !masterData.image.includes('freeiconspng')) {
      
      await db.update(products)
        .set({ 
          image: masterData.image, 
          updatedAt: new Date() 
        })
        .where(eq(products.id, prod.id));
      
      updatedCount++;
      console.log(`⚡ Fast Fixed: ${prod.name}`);
    }
  }
  console.log(`🎯 Fast Transfer Complete! Total ${updatedCount} products updated.`);
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