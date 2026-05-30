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
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 12000 });

    const buffer = await sharp(Buffer.from(response.data))
      .resize(800, 800, { fit: 'contain', background: '#fff' })
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

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return null;
  }
}
// --- BUTTON 1: MASTER PRODUCT SYNC ---
export const syncMasterTableOnly = async () => {
  console.log("🚀 Pixabay Master Sync Started...");

  const items = await db.select().from(masterProducts)
    .where(or(
      like(masterProducts.image, `%placehold%`),
      like(masterProducts.image, `%no-image%`)
    ))
    .limit(20);

  for (const item of items) {
    try {
      const urls = await scrapePixabayImage(item.name);

      if (urls.length > 0) {
        const cloudUrl = await processAndUpload(urls[0], item.name, 'master');

        if (cloudUrl) {
          await db.update(masterProducts)
            .set({ image: cloudUrl })
            .where(eq(masterProducts.id, item.id));

          console.log("✅ Updated:", item.name);
        }
      }

      await new Promise(r => setTimeout(r, 1000)); // fast now

    } catch (err: any) {
      console.error(err);
    }
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

  for (const item of items) {
    try {
      const sourceUrls = await scrapePixabayImage(item.name);

      if (!sourceUrls.length) continue;

      // 🚀 parallel upload (FAST)
      const uploadPromises = sourceUrls.map((url, i) =>
        processAndUpload(url, item.name, `gallery_${i}`)
      );

      const uploaded = await Promise.all(uploadPromises);
const gallery = uploaded
  .filter((url): url is string => typeof url === "string")
  .slice(0, 3);
      
      if (gallery.length) {
        await db.update(products)
          .set({ images: gallery })
          .where(eq(products.id, item.id));

        console.log("✅ Gallery Updated:", item.name);
      }

      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.error(err);
    }
  }

  console.log("🎯 Gallery Sync Done");
};