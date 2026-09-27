import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module mein __dirname available nahi hota - isse manually banate hain
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// 🔧 CONFIG - yahan apni keys daalo
// =========================================================

// Cloudinary (aapki di hui keys - baad mein rotate karna, abhi ke liye reuse)
cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU',
});

// Google Custom Search Engine - https://programmablesearchengine.google.com/
// Multiple projects se milne wali free keys yahan array mein daalo -
// ek ki 100/din limit khatam hote hi agli try hogi (bina billing ke).
const GOOGLE_CSE_ID = '367093f7a81fc4136'; // ek hi CX ID sab keys ke saath chalega
const GOOGLE_CSE_KEYS = [
  'AIzaSyBM5E-P52JmbavaKL8XGJyNI6IKQWPF-VU',
   'AIzaSyAkeT3pTG6Kip_0u4krLu-jpqlc4knPs_E',
   'AIzaSyDK90uLijazm6RMCZgWXK9H5N-ph3iWH4Q',
];
const GOOGLE_CSE_DAILY_LIMIT_PER_KEY = 90; // har key ke liye safe limit (100 se thoda kam)

// Pexels - https://www.pexels.com/api/ (free signup, turant milti hai)
const PEXELS_API_KEY = 'icjVLfmqUI8YcmsGFfcxQsgeGZOeVJgufeSFR0vq3mLEVDtOnG2E0gMh';

// =========================================================
// Helpers
// =========================================================
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const FOOD_KEYWORDS = [
  'food', 'kirana', 'grocery', 'dairy', 'beverage', 'snack',
  'atta', 'rice', 'oil', 'spice', 'masala', 'milk', 'namkeen',
];

function isFoodCategory(name: string): boolean {
  const c = (name || '').toLowerCase();
  return FOOD_KEYWORDS.some(k => c.includes(k));
}

// public_id se product ka naam nikaalna
// e.g. "shopnish_products/amul_milk_master_1699999999999" -> "amul milk"
function extractNameFromPublicId(publicId: string): string {
  const base = publicId.split('/').pop() || publicId;
  const withoutSuffix = base.replace(/_(master|gallery_\d+)_\d+$/, '');
  return withoutSuffix.replace(/_/g, ' ').trim();
}

// =========================================================
// SOURCE 1: Open Food Facts (free, unlimited, no key)
// =========================================================
// Naye (beta) search-a-licious endpoint se best-effort try - schema abhi
// stable nahi hai, isliye response mein kahin bhi image-jaisi URL dhoondte hain
function extractImageUrls(obj: any, found: string[] = [], depth = 0): string[] {
  if (depth > 4 || found.length >= 5) return found;
  if (typeof obj === 'string') {
    if (/^https?:\/\/.*\.(jpg|jpeg|png|webp)/i.test(obj)) found.push(obj);
    return found;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) extractImageUrls(item, found, depth + 1);
    return found;
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) extractImageUrls(obj[key], found, depth + 1);
  }
  return found;
}

async function searchOpenFoodFactsNew(productName: string): Promise<string[]> {
  try {
    const { data } = await axios.get('https://search.openfoodfacts.org/search', {
      params: { q: productName, page_size: 5, langs: 'en' },
      timeout: 8000,
    });
    const urls = extractImageUrls(data?.hits || data);
    if (urls.length > 0) {
      console.log(`🥫 Open Food Facts (new beta search): ${urls.length} results for "${productName}"`);
    }
    return urls;
  } catch (err: any) {
    // Beta endpoint hai, fail hona expected hai - chup-chaap fallback karo
    return [];
  }
}

async function searchOpenFoodFacts(productName: string): Promise<string[]> {
  // Pehle naya beta endpoint try karo
  const newUrls = await searchOpenFoodFactsNew(productName);
  if (newUrls.length > 0) return newUrls.slice(0, 3);

  // Fallback: purana legacy endpoint (abhi globally unstable chal raha hai,
  // isliye ismein retry lagaya hai lekin ye guarantee nahi karta)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data } = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
        params: {
          search_terms: productName,
          search_simple: 1,
          action: 'process',
          json: 1,
          page_size: 5,
          countries: 'India',
        },
        timeout: 10000,
      });
      const urls = (data?.products || [])
        .map((p: any) => p.image_front_url || p.image_url)
        .filter(Boolean);

      if (urls.length > 0) {
        console.log(`🥫 Open Food Facts (legacy): ${urls.length} results for "${productName}"`);
        await sleep(300);
        return urls.slice(0, 3);
      }
      return [];
    } catch (err: any) {
      const status = err?.response?.status;
      console.error(`OPEN FOOD FACTS legacy ERROR (attempt ${attempt}):`, status || err?.message);
      if (attempt < 2) await sleep(3000);
    }
  }
  return [];
}

// =========================================================
// SOURCE 2: Google CSE (rate-limited + daily quota + backoff)
// =========================================================
let dailyGoogleCounts: number[] = GOOGLE_CSE_KEYS.map(() => 0);
let dailyResetAt = getNextMidnight();
let lastGoogleCall = 0;

function getNextMidnight(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

async function searchGoogleCSE(productName: string): Promise<string[]> {
  const validKeys = GOOGLE_CSE_KEYS.filter(k => k && !k.startsWith('YAHAN'));
  if (validKeys.length === 0) {
    console.log('⏭️ Koi Google CSE key set nahi hai, skip kar raha hoon.');
    return [];
  }

  if (Date.now() >= dailyResetAt) {
    dailyGoogleCounts = GOOGLE_CSE_KEYS.map(() => 0);
    dailyResetAt = getNextMidnight();
    console.log('🔄 Google CSE daily counters reset (sabhi keys).');
  }

  // Pehli key dhoondo jiski aaj ki limit khatam nahi hui
  let keyIndex = -1;
  for (let i = 0; i < GOOGLE_CSE_KEYS.length; i++) {
    const key = GOOGLE_CSE_KEYS[i];
    if (!key || key.startsWith('YAHAN')) continue;
    if (dailyGoogleCounts[i] < GOOGLE_CSE_DAILY_LIMIT_PER_KEY) {
      keyIndex = i;
      break;
    }
  }

  if (keyIndex === -1) {
    console.log(`⏸️ Sabhi Google CSE keys ki daily limit khatam ho chuki hai, kal try karna.`);
    return [];
  }

  const apiKey = GOOGLE_CSE_KEYS[keyIndex];

  const wait = Math.max(0, 2000 - (Date.now() - lastGoogleCall));
  await sleep(wait);
  lastGoogleCall = Date.now();
  dailyGoogleCounts[keyIndex]++;

  let attempt = 0;
  while (attempt < 3) {
    try {
      const { data } = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: apiKey,
          cx: GOOGLE_CSE_ID,
          q: productName,
          searchType: 'image',
          num: 5,
          safe: 'active',
          imgSize: 'large',
        },
        timeout: 10000,
      });
      const urls = (data?.items || []).map((i: any) => i.link);
      console.log(`📸 Google CSE (key #${keyIndex + 1}): ${urls.length} results for "${productName}"`);
      return urls;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429 || status === 403) {
        // Ye key ka quota khatam ho gaya hoga - agli key try karo bina wait kiye
        console.warn(`⚠️ Key #${keyIndex + 1} rate-limited/quota over. Agli key try karunga...`);
        dailyGoogleCounts[keyIndex] = GOOGLE_CSE_DAILY_LIMIT_PER_KEY; // isse aaj ke liye skip maan lo
        return searchGoogleCSE(productName); // recursively agli available key try karega
      } else {
        console.error('GOOGLE CSE ERROR:', err?.message);
        return [];
      }
    }
  }
  return [];
}

// =========================================================
// SOURCE 3: Pexels (free, hourly limited)
// =========================================================
let hourlyPexelsCount = 0;
let hourlyResetAt = Date.now() + 60 * 60 * 1000;

async function searchPexels(productName: string): Promise<string[]> {
  if (!PEXELS_API_KEY || PEXELS_API_KEY.startsWith('YAHAN')) {
    console.log('⏭️ Pexels key set nahi hai, skip kar raha hoon.');
    return [];
  }

  if (Date.now() >= hourlyResetAt) {
    hourlyPexelsCount = 0;
    hourlyResetAt = Date.now() + 60 * 60 * 1000;
  }
  if (hourlyPexelsCount >= 180) {
    console.log('⏸️ Pexels hourly limit reached, skip.');
    return [];
  }

  try {
    hourlyPexelsCount++;
    const { data } = await axios.get('https://api.pexels.com/v1/search', {
      headers: { Authorization: PEXELS_API_KEY },
      params: { query: productName, per_page: 5 },
      timeout: 10000,
    });
    const urls = (data?.photos || []).map((p: any) => p.src?.large || p.src?.original).filter(Boolean);
    console.log(`🖼️ Pexels: ${urls.length} results for "${productName}"`);
    await sleep(400);
    return urls.slice(0, 3);
  } catch (err: any) {
    console.error('PEXELS ERROR:', err?.message);
    return [];
  }
}

// =========================================================
// ROUTER: category ke hisaab se sahi order try karta hai
// =========================================================
async function resolveProductImage(productName: string): Promise<{ url: string | null; source: string }> {
  // Abhi sirf food-category batches par focus hai (aap khud tag lagate waqt
  // filter kar rahe ho), isliye har product ke liye pehle Open Food Facts
  // try karte hain, uske baad Google CSE / Pexels fallback.
  const attempts = [
    { name: 'open_food_facts', fn: () => searchOpenFoodFacts(productName) },
    { name: 'google_cse', fn: () => searchGoogleCSE(productName) },
    { name: 'pexels', fn: () => searchPexels(productName) },
  ];

  for (const attempt of attempts) {
    const urls = await attempt.fn();
    if (urls.length > 0) return { url: urls[0], source: attempt.name };
  }
  return { url: null, source: 'none' };
}

// =========================================================
// Image download + resize
// =========================================================
async function downloadAndPrepare(imageUrl: string): Promise<Buffer | null> {
  try {
    const { data } = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return await sharp(Buffer.from(data))
      .resize(800, 800, { fit: 'contain', background: '#fff' })
      .flatten({ background: '#fff' })
      .toFormat('jpeg', { quality: 85 })
      .toBuffer();
  } catch (err: any) {
    console.error('DOWNLOAD/RESIZE ERROR:', err?.message);
    return null;
  }
}

// =========================================================
// UNRESOLVED LOG - jo kahin se nahi mile
// =========================================================
const UNRESOLVED_LOG_PATH = path.join(__dirname, 'unresolved-products.json');

function logUnresolved(publicId: string, name: string) {
  let list: any[] = [];
  try {
    if (fs.existsSync(UNRESOLVED_LOG_PATH)) {
      list = JSON.parse(fs.readFileSync(UNRESOLVED_LOG_PATH, 'utf-8'));
    }
  } catch {
    list = [];
  }
  if (!list.some(item => item.publicId === publicId)) {
    list.push({ publicId, name, loggedAt: new Date().toISOString() });
    fs.writeFileSync(UNRESOLVED_LOG_PATH, JSON.stringify(list, null, 2));
  }
}

// =========================================================
// MAIN - tag-based batch replace
// =========================================================
async function run() {
  const tagName = process.argv[2];
  if (!tagName) {
    console.error('❌ Tag name do: npx ts-node bulkReplaceAll.ts <tag_name>');
    console.error('   Example: npx ts-node bulkReplaceAll.ts needs_replace');
    process.exit(1);
  }

  console.log(`🚀 Fetching images with tag: "${tagName}"...`);

  const result = await cloudinary.api.resources_by_tag(tagName, {
    max_results: 500,
    resource_type: 'image',
  });

  const resources = result?.resources || [];
  console.log(`📦 Found ${resources.length} images tagged "${tagName}"`);

  let successCount = 0;
  let failCount = 0;

  for (const resource of resources) {
    const publicId: string = resource.public_id;
    const productName = extractNameFromPublicId(publicId);

    console.log(`\n🔎 Processing: "${productName}" (public_id: ${publicId})`);

    try {
      const { url, source } = await resolveProductImage(productName);

      if (!url) {
        console.log(`⚠️ Koi sahi image nahi mili "${productName}" ke liye - skip.`);
        logUnresolved(publicId, productName);
        failCount++;
        continue;
      }

      console.log(`✅ Image mili (source: ${source}) - downloading & uploading...`);

      const buffer = await downloadAndPrepare(url);
      if (!buffer) {
        failCount++;
        continue;
      }

      await new Promise<void>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { public_id: publicId, overwrite: true, invalidate: true },
          (err, res) => {
            if (err) {
              console.error(`❌ Upload failed for ${publicId}:`, err.message);
              reject(err);
            } else {
              console.log(`☁️ Replaced: ${res?.secure_url}`);
              resolve();
            }
          }
        );
        stream.end(buffer);
      });

      // Tag hata do taaki dobara same tag chalane par ye dobara process na ho
      await cloudinary.uploader.remove_tag(tagName, [publicId]);
      await cloudinary.uploader.add_tag('processed', [publicId]);

      successCount++;
    } catch (err: any) {
      console.error(`❌ Error processing ${publicId}:`, err?.message || err);
      failCount++;
    }

    await sleep(500);
  }

  console.log('\n----- BATCH SUMMARY -----');
  console.log(`Tag: ${tagName}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed/Skipped: ${failCount}`);
  console.log('Fail hui images ka tag abhi bhi laga hai, dobara same command chala sakte ho.');
  console.log('Bilkul na milne wali images ki list "unresolved-products.json" mein hai.');
}

run();