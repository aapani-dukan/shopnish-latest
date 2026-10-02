import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// 🔥 APPLY OFF REVIEW - reviewOFFMatches.ts se bani CSV apply karta hai
// =========================================================
// Sirf un rows ko process karta hai jinme "new" choose kiya gaya tha.
// "keep" wali rows ko touch nahi karta (purani image jaisi hai waisi rahegi).
// Har case mein tag hata deta hai (dobara review na ho isliye).
//
// RUN: npx tsx applyOFFReview.ts off-review.csv processed

cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU',
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseCsvLine(line: string): string[] {
  // Simple CSV parser jo quoted fields handle kare
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

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

async function run() {
  const csvPath = process.argv[2];
  const tagName = process.argv[3] || 'processed';

  if (!csvPath) {
    console.error('❌ CSV path do: npx tsx applyOFFReview.ts off-review.csv processed');
    process.exit(1);
  }

  const fullPath = path.isAbsolute(csvPath) ? csvPath : path.join(__dirname, csvPath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.trim().split('\n').slice(1); // header skip

  console.log(`📄 ${lines.length} rows CSV mein.`);

  let updatedCount = 0;
  let keptCount = 0;
  let errorCount = 0;

  for (const line of lines) {
    const [publicId, decision, newUrl] = parseCsvLine(line);
    if (!publicId) continue;

    try {
      if (decision === 'new' && newUrl) {
        console.log(`\n🔄 Updating: ${publicId}`);
        const buffer = await downloadAndPrepare(newUrl);
        if (!buffer) {
          errorCount++;
          continue;
        }

        await new Promise<void>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { public_id: publicId, overwrite: true, invalidate: true },
            (err, res) => {
              if (err) { console.error(`❌ Upload failed:`, err.message); reject(err); }
              else { console.log(`☁️ Updated: ${res?.secure_url}`); resolve(); }
            }
          );
          stream.end(buffer);
        });
        updatedCount++;
      } else {
        console.log(`⏭️ Keeping old image: ${publicId}`);
        keptCount++;
      }

      // Dono cases mein tag hata do - review ho chuka hai
      await cloudinary.uploader.remove_tag(tagName, [publicId]);
      await cloudinary.uploader.add_tag('off_reviewed', [publicId]);

      await sleep(300);
    } catch (err: any) {
      console.error(`❌ Error processing ${publicId}:`, err?.message || err);
      errorCount++;
    }
  }

  console.log('\n----- SUMMARY -----');
  console.log(`Updated (new image): ${updatedCount}`);
  console.log(`Kept (old image): ${keptCount}`);
  console.log(`Errors: ${errorCount}`);
}

run();