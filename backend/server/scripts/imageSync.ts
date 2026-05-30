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


export async function scrapePixabayImage(productName: string): Promise<string[]> {
  try {
    const pixabayKey = process.env.PIXABAY_API_KEY;
    if (!pixabayKey) {
      console.error("❌ PIXABAY_API_KEY missing");
      return [];
    }

    const url = `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(productName)}&image_type=photo&safesearch=true&per_page=20`;

    const { data } = await axios.get(url, { timeout: 10000 });

    if (!data?.hits?.length) return [];

    const ranked = data.hits.map((hit: any) => ({
      url: hit.largeImageURL || hit.webformatURL,
      score:
        (hit.likes || 0) * 3 +
        (hit.views || 0) * 0.01 +
        (hit.downloads || 0) * 0.02 +
        (hit.imageWidth * hit.imageHeight) * 0.000001
    }));

    return ranked
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((i: any) => i.url);

  } catch (err: any) {
    console.error("PIXABAY ERROR:", err?.message);
    return [];
  }
}
async function processAndUpload(imageUrl: string, productName: string, suffix: string = 'main') {
  try {
    // 🎯 FIX: Pixabay को असली क्रोम ब्राउज़र का झांसा देने के लिए हेडर्स जोड़े
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer', 
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://pixabay.com/"
      }
    });

    const buffer = await sharp(Buffer.from(response.data))
      .resize(800, 800, { fit: 'contain', background: '#fff' })
      .flatten({ background: '#ffffff' }) // JPEG के लिए बैकग्राउंड फ़्लैटेन ज़रूरी है
      .toFormat('jpeg', { quality: 85 })
      .toBuffer();

    const safeName = productName
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '_')
      .toLowerCase();

    return await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'shopnish_products',
          public_id: `${safeName}_${suffix}_${Date.now()}`
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result?.secure_url || '');
        }
      );
      stream.end(buffer);
    });

  } catch (err: any) {
    console.error(`❌ UPLOAD ERROR [Status: ${err?.response?.status || 'Unknown'}]:`, err?.message || err);
    return null;
  }
}
// --- BUTTON 1: MASTER PRODUCT SYNC ---
export const syncMasterTableOnly = async () => {
  console.log("🚀 Pixabay Master Sync Started (Safe Mode)...");

  const items = await db.select().from(masterProducts)
    .where(or(
      like(masterProducts.image, `%placehold%`),
      like(masterProducts.image, `%no-image%`)
    ))
    .limit(20);

  console.log(`📦 Processing ${items.length} master items slowly to avoid 429...`);

  for (const item of items) {
    try {
      console.log(`🔎 Searching image for: ${item.name}`);
      const urls = await scrapePixabayImage(item.name);

      if (urls && urls.length > 0) {
        // थोड़ा सा सांस लेने का गैप इमेज मिलने और अपलोड करने के बीच में
        await new Promise(r => setTimeout(r, 500));

        const cloudUrl = await processAndUpload(urls[0], item.name, 'master');

        if (cloudUrl) {
          await db.update(masterProducts)
            .set({ image: cloudUrl })
            .where(eq(masterProducts.id, item.id));

          console.log(`✅ Successfully Updated: ${item.name}`);
        }
      } else {
        console.log(`⚠️ No image found for: ${item.name}`);
      }

    } catch (err: any) {
      console.error(`❌ Error processing ${item.name}:`, err?.message || err);
    }

    // 🎯 FIX: 1 सेकंड का गैप बहुत कम था, इसे बढ़ाकर 3.5 सेकंड (3500ms) कर दिया है
    // इससे पिक्सबे और क्लाउडिनरी दोनों को लगेगा कि कोई इंसान आराम से काम कर रहा है
    console.log("⏱️ Taking a 3.5-second safe break to avoid 429 Rate Limit...");
    await new Promise(r => setTimeout(r, 3500));
  }

  console.log("🎯 Master Sync Done");
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



export const syncProductGalleriesOnly = async () => {
  console.log("🚀 Pixabay Gallery Sync Started...");

  const items = await db.select().from(products)
    .where(or(isNull(products.images), eq(products.images, [])))
    .limit(20);

  console.log(`📦 Found ${items.length} products to generate galleries.`);

  for (const item of items) {
    try {
      const sourceUrls = await scrapePixabayImage(item.name);

      if (!sourceUrls.length) continue;

      const galleryUrls: string[] = [];
      const maxImages = Math.min(sourceUrls.length, 3);

      // 🎯 FIX: Parallel (Promise.all) के बजाय एक-एक करके डाउनलोड करेंगे ताकि Pixabay ब्लॉक न करे
      for (let i = 0; i < maxImages; i++) {
        console.log(`   ⏳ Downloading gallery image ${i + 1}/${maxImages} for: ${item.name}`);
        const url = await processAndUpload(sourceUrls[i], item.name, `gallery_${i}`);
        if (url) {
          galleryUrls.push(url);
        }
        // हर गैलरी इमेज के बीच आधा सेकंड का छोटा सा सांस लेने का गैप
        await new Promise(r => setTimeout(r, 500));
      }
      
      if (galleryUrls.length > 0) {
        await db.update(products)
          .set({ images: galleryUrls })
          .where(eq(products.id, item.id));

        console.log("✅ Gallery Updated:", item.name);
      }

      // 🎯 बटन का सेफ़ गैप: ताकि अगले प्रोडक्ट पर जाने से पहले पिक्सबे शांत रहे
      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      console.error(`❌ Error in Gallery Sync for ${item.name}:`, err);
    }
  }

  console.log("🎯 Gallery Sync Done");
};