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

// -----------------------------
// 🔥 GLOBAL SAFE DELAY HELPER
// -----------------------------
//const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
// 🔥 PROCESS & UPLOAD (UNCHANGED LOGIC)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function processAndUpload(
  imageUrl: string,
  productName: string,
  suffix: string = 'main'
) {
  try {
    // 🔥 RATE LIMIT SAFE DELAY (IMPORTANT)
    await sleep(800);

    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Firefox/123)"
    ];

    const randomAgent =
      userAgents[Math.floor(Math.random() * userAgents.length)];

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

    const buffer = await sharp(Buffer.from(response.data))
      .resize(800, 800, { fit: "contain", background: "#fff" })
      .flatten({ background: "#fff" })
      .jpeg({ quality: 85 })
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
// 🔥 MASTER SYNC
// -----------------------------
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

    // 🔥 RATE LIMIT BREAK
    await new Promise(r => setTimeout(r, 3000));

    if (urls && urls.length > 0) {
      const cloudUrl = await processAndUpload(urls[0], item.name, 'master');

      // 🔥 ANOTHER SAFE GAP
      await new Promise(r => setTimeout(r, 3000));

      if (cloudUrl) {
        await db.update(masterProducts)
          .set({ image: cloudUrl })
          .where(eq(masterProducts.id, item.id));
      }
    }
  } catch (err) {
    console.error(err);
  }

  // 🔥 VERY IMPORTANT GAP BETWEEN PRODUCTS
  await new Promise(r => setTimeout(r, 5000));
}

  console.log("🎯 Master Sync Done");
};

// -----------------------------
// 🔥 SELLER SYNC (UNCHANGED LOGIC)
// -----------------------------
export const syncManualProductsOnly = async () => {
  console.log("🚀 Fast Transfer Started...");

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
    .limit(100);

  let updatedCount = 0;

  for (const prod of dummyProducts) {
    const [masterData] = await db.select({ image: masterProducts.image })
      .from(masterProducts)
      .where(eq(masterProducts.id, prod.masterProductId!));

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

// -----------------------------
// 🔥 GALLERY SYNC
// -----------------------------
export const syncProductGalleriesOnly = async () => {
  console.log("🚀 Pixabay Gallery Sync Started...");

  const items = await db.select().from(products)
    .where(or(isNull(products.images), eq(products.images, [])))
    .limit(20);

  console.log(`📦 Found ${items.length} products to generate galleries.`);

  for (const item of items) {
    try {
      const sourceUrls = await safePixabayRequest(() =>
        scrapePixabayImage(item.name)
      );

      if (!sourceUrls.length) continue;

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