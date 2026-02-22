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
      isNull(products.masterProductId),
      or(
        like(products.image, `%${DUMMY_KEYWORD}%`),
        like(products.image, `%freeiconspng%`)
      )
    ))
    .limit(10);

  for (const item of items) {
    console.log(`🔎 Scraping Manual: ${item.name}`);
    const urls = await getGoogleImages(item.name);
    if (urls.length > 0) {
      const cloudinaryUrl = await processAndUpload(urls[0], item.name, 'manual');
      if (cloudinaryUrl) {
        await db.update(products).set({ image: cloudinaryUrl, updatedAt: new Date() }).where(eq(products.id, item.id));
        console.log(`✅ Manual Updated: ${item.name}`);
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
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