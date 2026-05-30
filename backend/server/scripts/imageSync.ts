import { db } from '../db';
import { products, masterProducts } from '../../shared/backend/schema'; 
import { eq, like, or, and, isNull,isNotNull } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { GOOGLE_IMG_SCRAP } from 'google-img-scrap';
import { sql } from 'drizzle-orm';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

const DUMMY_KEYWORD = 'placehold';

// --- HELPER FUNCTIONS (RE-USABLE) ---



export async function scrapeDuckDuckGoImage(productName: string): Promise<string[]> {
  try {
    console.log(`📡 [DDG SCRAPER]: इमेज खोज रहे हैं -> ${productName}`);

    const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(productName)}&iax=images&ia=images`;
    
    const tokenResponse = await axios.get(tokenUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      }
    });

    const vqdRegex = /vqd=([\d-]+)\&/;
    const match = tokenResponse.data.match(vqdRegex);
    
    if (!match) {
      console.error("❌ DDG Token (vqd) नहीं मिला!");
      return [];
    }

    const vqd = match[1];
    const apiUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(productName)}&vqd=${vqd}&f=,,,`;

    const apiResponse = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Referer": "https://duckduckgo.com/"
      }
    });

    const results = apiResponse.data?.results;
    if (results && results.length > 0) {
      // 🎯 सुधार: यहाँ से सीधे सभी इमेजेस के लिंक्स का ऐरे (List) बाहर भेजेंगे
      return results.map((item: any) => item.image).filter(Boolean);
    }

    console.log(`⚠️ [DDG NOT FOUND]: ${productName} की कोई इमेज नहीं मिली`);
    return [];

  } catch (error: any) {
    console.error(`❌ [DDG ERROR] ${productName}:`, error?.message || error);
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
// --- 1. MASTER SYNC (अब ये DuckDuckGo से बिना कोटे के धड़ाधड़ सिंक करेगा) ---
export const syncMasterTableOnly = async () => {
  console.log("🚀 Deep Syncing Master Catalog via DuckDuckGo...");
  
  const items = await db.select().from(masterProducts)
    .where(or(
      like(masterProducts.image, `%placehold%`),
      like(masterProducts.image, `%placeholder%`),
      like(masterProducts.image, `%freeiconspng%`),
      like(masterProducts.image, `%no-image%`),
      like(masterProducts.image, `%t4.ftcdn.net%`)
    ))
    .orderBy(sql`RANDOM()`)
    .limit(20);
    
  console.log(`📦 Found ${items.length} Master items to search.`);

  for (const item of items) {
    try {
      console.log(`🔎 Scraping HD Image for Master: ${item.name}`);
      
      // 🎯 FIX 1: पुराने गूगल की जगह सीधे DuckDuckGo से सिंगल HD इमेज यूआरएल लाएं
    const urls = await scrapeDuckDuckGoImage(item.name);
if (urls.length > 0) {
  const cloudinaryUrl = await processAndUpload(urls[0], item.name, 'master');
  // ... बाकी आपका पुराना कोड वैसा का वैसा ही रहेगा
        
        if (cloudinaryUrl) {
          await db.update(masterProducts)
            .set({ image: cloudinaryUrl })
            .where(eq(masterProducts.id, item.id));
          console.log(`✅ Master Table Updated: ${item.name} -> ${cloudinaryUrl}`);
        }
      } else {
        console.log(`⚠️ No image found on DDG for: ${item.name}`);
      }
    } catch (err: any) {
      console.error(`❌ Error with ${item.name}:`, err?.message || err);
    }
    
    // 🎯 FIX 3: DuckDuckGo के लिए 4 सेकंड का लंबा इंतजार ज़रूरी नहीं है, 2 सेकंड (2000ms) काफी है।
    console.log("⏱️ Taking a 2-second safety break...");
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log("🎯 Master Sync Batch Finished Successfully!");
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
export const syncProductGalleriesOnly = async () => {
  console.log("🚀 Filling Product Galleries via DuckDuckGo...");
  
  const items = await db.select().from(products)
    .where(or(isNull(products.images), eq(products.images, [])))
    .limit(10);

  console.log(`📦 Found ${items.length} products with empty galleries.`);

  for (const item of items) {
    try {
      console.log(`📸 Generating 3-Image Gallery for: ${item.name}`);
      
      // 🎯 सुधार: अब यहाँ पूरी लिस्ट (Array) आएगी
      const sourceUrls = await scrapeDuckDuckGoImage(item.name);
      
      if (sourceUrls.length > 0) {
        const galleryUrls: string[] = [];
        
        // 🎯 सुधार: लूप चलाकर शुरू की अधिकतम 3 अलग-अलग इमेजेस को अपलोड करें
        const maxImages = Math.min(sourceUrls.length, 3);
        for (let i = 0; i < maxImages; i++) {
          console.log(`   ⏳ Processing gallery image ${i+1}/${maxImages}...`);
          const url = await processAndUpload(sourceUrls[i], item.name, `gallery_${i}`);
          if (url) {
            galleryUrls.push(url);
          }
        }

        // अगर गैलरी में इमेजेस मिल गई हैं, तो डेटाबेस में अपडेट मारें
        if (galleryUrls.length > 0) {
          await db.update(products)
            .set({ images: galleryUrls })
            .where(eq(products.id, item.id));
          console.log(`✅ Gallery Fixed with ${galleryUrls.length} images for: ${item.name}`);
        }
      } else {
        console.log(`⚠️ No images found on DDG for gallery: ${item.name}`);
      }
      
    } catch (err: any) {
      console.error(`❌ Error filling gallery for ${item.name}:`, err?.message || err);
    }

    console.log("⏱️ Taking a 2-second safety break...");
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log("🎯 Product Galleries Batch Finished!");
};