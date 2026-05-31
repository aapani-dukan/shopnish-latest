import { db } from '../db';
import { products, masterProducts } from '../../shared/backend/schema'; 
import { eq, like, or, and, isNull, isNotNull } from 'drizzle-orm';
import axios from 'axios';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { sql } from 'drizzle-orm';

// Cloudinary Configuration
cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU'
});

const DUMMY_KEYWORD = 'placehold';

// -----------------------------
// 🔥 GLOBAL SAFE DELAY HELPER (ऊपर शिफ्ट किया ताकि एरर न आए)
// -----------------------------
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// -----------------------------
// 🔥 PIXABAY SAFE CALL LIMITER
// -----------------------------
let lastPixabayCall = 0;

async function safePixabayRequest<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, 1500 - (now - lastPixabayCall));

  await sleep(wait);
  lastPixabayCall = Date.now();

  return fn();
}

// -----------------------------
// --- HELPER FUNCTIONS
// -----------------------------

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

// -----------------------------
// 🔥 PROCESS & UPLOAD (STEALTH MODE WITH RETRY)
// -----------------------------
export async function processAndUpload(
  imageUrl: string,
  productName: string,
  suffix: string = 'main'
) {
  try {
    // 🔥 RATE LIMIT SAFE DELAY
    await sleep(800);

    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Firefox/123)"
    ];

    const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    // 🔥 RETRY LOGIC for image download
    let response: any = null;

    for (let i = 0; i < 3; i++) {
      try {
        response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: {
            "User-Agent": randomAgent,
            "Referer": "https://pixabay.com/"
          }
        });
        break;
      } catch (err: any) {
        if (i === 2) throw err;
        await sleep(1500 * (i + 1));
      }
    }

    if (!response?.data) return null;

    // 🎯 सुधार: sharp का सिंटैक्स स्टैंडर्ड किया ताकि पुरानी नोड वर्जन्स पर क्रैश न हो
    const buffer = await sharp(Buffer.from(response.data))
      .resize(800, 800, { fit: "contain", background: "#fff" })
      .flatten({ background: "#fff" })
      .toFormat('jpeg', { quality: 85 })
      .toBuffer();

    const safeName = productName
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "_")
      .toLowerCase();

    // 🔥 Cloudinary retry
    for (let i = 0; i < 2; i++) {
      try {
        return await new Promise<string>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "shopnish_products",
              public_id: `${safeName}_${suffix}_${Date.now()}`
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result?.secure_url || "");
            }
          );
          stream.end(buffer);
        });
      } catch (err) {
        if (i === 1) throw err;
        await sleep(2000);
      }
    }

    return null;
  } catch (err: any) {
    console.error(
      `❌ UPLOAD ERROR [Status: ${err?.response?.status || "Unknown"}]:`,
      err?.message || err
    );
    return null;
  }
}

// -----------------------------
// 🔥 BUTTON 1: MASTER SYNC
// -----------------------------
let isSyncRunning = false;

export const syncMasterTableOnly = async () => {
  if (isSyncRunning) {
    console.log("⚠️ Sync already running, skipping duplicate execution...");
    return;
  }

  isSyncRunning = true;

  try {
    console.log("🚀 Pixabay Master Sync Started (Safe Mode)...");
    
    const items = await db.select().from(masterProducts)
      .where(or(
        like(masterProducts.image, `%placehold%`),
        like(masterProducts.image, `%placeholder%`),
        like(masterProducts.image, `%freeiconspng%`),
        like(masterProducts.image, `%no-image%`),
        like(masterProducts.image, `%t4.ftcdn.net%`)
      ))
      .limit(20);

    console.log(`📦 Found ${items.length} Master items to search.`);

    for (const item of items) {
      try {
        console.log(`🔎 Searching image for: ${item.name}`);

        // 🎯 सुधार: मास्टर लूप में भी safePixabayRequest रैपर का इस्तेमाल किया ताकि API सेफ रहे
        const urls = await safePixabayRequest(() => scrapePixabayImage(item.name));

        if (urls && urls.length > 0) {
          await sleep(500);

          const cloudUrl = await processAndUpload(urls[0], item.name, 'master');

          if (cloudUrl) {
            await db.update(masterProducts)
              .set({ image: cloudUrl })
              .where(eq(masterProducts.id, item.id));
              
            console.log(`✅ Successfully Updated: ${item.name} -> ${cloudUrl}`);
          }
        } else {
          console.log(`⚠️ Pixabay के पास इसकी फोटो नहीं है: ${item.name}`);
        }

      } catch (err: any) {
        console.error(`❌ Error processing ${item.name}:`, err?.message || err);
      }

      // 🎯 पिक्सबे और क्लाउडिनरी दोनों के लिए एकदम परफेक्ट 4.5 सेकंड का सेफ़ गैप
      console.log("⏱️ Taking a 4.5-second safe break to avoid 429 Rate Limit...");
      await sleep(4500);
    }

  } catch (globalErr) {
    console.error("❌ Global Master Sync Error:", globalErr);
  } finally {
    isSyncRunning = false;
    console.log("🎯 Master Sync Done & Lock Released.");
  }
};

// -----------------------------
// 🔥 BUTTON 2: SELLER SYNC (Fast Copy)
// -----------------------------
export const syncManualProductsOnly = async () => {
  console.log("🚀 Fast Transfer Started...");

  const dummyProducts = await db.select().from(products)
    .where(and(
      isNotNull(products.masterProductId),
      or(
        like(products.image, `%placehold%`),
        like(products.image, `%placeholder%`), // 🎯 सुधार: यहाँ भी 'placeholder' कीवर्ड बढ़ा दिया है
        like(products.image, `%no-image%`),
        like(products.image, `%freeiconspng%`),
        eq(products.image, ''),
        isNull(products.image)
      )
    ))
    .limit(100);

  let updatedCount = 0;

  for (const prod of dummyProducts) {
    const [masterData] = await db.select({ image: masterProducts.image })
      .from(masterProducts)
      .where(eq(masterProducts.id, prod.masterProductId!));

    if (masterData?.image &&
        !masterData.image.includes('placehold') &&
        !masterData.image.includes('placeholder') &&
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

// -----------------------------
// 🔥 BUTTON 3: GALLERY SYNC
// -----------------------------
export const syncProductGalleriesOnly = async () => {
  console.log("🚀 Pixabay Gallery Sync Started...");

  const items = await db.select().from(products)
    .where(or(isNull(products.images), eq(products.images, [])))
    .limit(20);

  console.log(`📦 Found ${items.length} products to generate galleries.`);

  for (const item of items) {
    try {
      const sourceUrls = await safePixabayRequest(() => scrapePixabayImage(item.name));

      if (!sourceUrls.length) {
        console.log(`⚠️ No gallery images found on Pixabay for: ${item.name}`);
        continue;
      }

      const galleryUrls: string[] = [];
      const maxImages = Math.min(sourceUrls.length, 3);

      for (let i = 0; i < maxImages; i++) {
        console.log(`⏳ Processing image ${i + 1}/${maxImages} for ${item.name}`);

        const url = await processAndUpload(sourceUrls[i], item.name, `gallery_${i}`);

        if (url) galleryUrls.push(url);

        await sleep(500);
      }

      if (galleryUrls.length > 0) {
        await db.update(products)
          .set({ images: galleryUrls })
          .where(eq(products.id, item.id));

        console.log("✅ Gallery Updated:", item.name);
      }

      await sleep(1500);

    } catch (err: any) {
      console.error(`❌ Gallery Error ${item.name}:`, err?.message || err);
    }
  }

  console.log("🎯 Gallery Sync Done");
};