import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// 🔥 OFF REVIEW V2 - naam-verified candidates (top 3, score ke saath)
// =========================================================
// Farak pehle wale se:
// - Har candidate ka OFF product naam + brand nikaalta hai
// - Aapke product naam se word-match score nikaalta hai
// - Kam match (MIN_SCORE se neeche) wale candidates hata deta hai
// - Top 3 candidates naam ke saath dikhata hai, aap choose karo
//
// RUN: npx tsx reviewOFFMatchesV2.ts processed
// Baad mein wahi purani applyOFFReview.ts chalao (CSV format same hai)

cloudinary.config({
  cloud_name: 'dcah0b2jy',
  api_key: '963456643785286',
  api_secret: 'GX3ZZi6a1dW25NkJSmQ6667OZrU',
});

const MIN_SCORE = 0.3;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function extractNameFromPublicId(publicId: string): string {
  const base = publicId.split('/').pop() || publicId;
  return base.replace(/_(master|gallery_\d+)_\d+$/, '').replace(/_/g, ' ').trim();
}

const NOISE = ['small', 'large', 'medium', 'standard', 'premium', 'family', 'pack', 'pouch',
  'sachet', 'bottle', 'jar', 'box', 'carton', 'combo', 'pure', 'gm', 'g', 'kg', 'ml', 'l',
  'ltr', 'litre', 'pcs', 'piece', 'new', 'the', 'and', 'of'];

function words(s: string): Set<string> {
  const cleaned = (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\d+/g, ' ');
  return new Set(cleaned.split(/\s+/).filter(w => w.length > 1 && !NOISE.includes(w)));
}

// Kitne % words aapke naam ke candidate mein maujood hain
function score(query: string, candidate: string): number {
  const q = words(query);
  const c = words(candidate);
  if (q.size === 0 || c.size === 0) return 0;
  const common = [...q].filter(w => c.has(w)).length;
  return common / Math.max(q.size, 1) * 0.7 + common / Math.max(c.size, 1) * 0.3;
}

function asText(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.join(' ');
  if (typeof v === 'object') return String(v.en || Object.values(v)[0] || '');
  return String(v);
}

function firstImageUrl(hit: any): string {
  const direct = hit.image_front_url || hit.image_url || hit.image_front_small_url;
  if (typeof direct === 'string' && direct.startsWith('http')) return direct;
  const nested = hit?.selected_images?.front?.display;
  const nestedUrl = typeof nested === 'string' ? nested : asText(nested);
  if (nestedUrl.startsWith('http')) return nestedUrl;
  return '';
}

type Cand = { name: string; brand: string; image: string; score: number };

let debugSaved = false;

async function fetchCandidates(query: string): Promise<Cand[]> {
  let hits: any[] = [];

  try {
    const { data } = await axios.get('https://search.openfoodfacts.org/search', {
      params: { q: query, page_size: 10, langs: 'en' },
      timeout: 10000,
    });
    if (!debugSaved) {
      fs.writeFileSync(path.join(__dirname, 'off-debug-sample.json'), JSON.stringify(data, null, 2).slice(0, 20000));
      debugSaved = true;
    }
    hits = data?.hits || [];
  } catch {
    // fallback: purana endpoint
    try {
      const { data } = await axios.get('https://world.openfoodfacts.org/cgi/search.pl', {
        params: { search_terms: query, search_simple: 1, action: 'process', json: 1, page_size: 10 },
        timeout: 10000,
      });
      hits = data?.products || [];
    } catch {
      return [];
    }
  }

  const out: Cand[] = [];
  for (const h of hits) {
    const name = asText(h.product_name || h.product_name_en);
    const brand = asText(h.brands);
    const image = firstImageUrl(h);
    if (!name || !image) continue;
    const s = score(query, `${brand} ${name}`);
    if (s >= MIN_SCORE) out.push({ name, brand, image, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

async function run() {
  const tagName = process.argv[2] || 'processed';
  console.log(`🚀 Fetching images with tag: "${tagName}"...`);

  const result = await cloudinary.api.resources_by_tag(tagName, { max_results: 500, resource_type: 'image' });
  const resources = result?.resources || [];
  console.log(`📦 Found ${resources.length} images`);

  const rows: Array<{ publicId: string; name: string; oldUrl: string; cands: Cand[] }> = [];
  const noMatch: Array<{ publicId: string; name: string }> = [];

  for (const r of resources) {
    const name = extractNameFromPublicId(r.public_id);
    console.log(`🔎 ${name}`);
    const cands = await fetchCandidates(name);
    await sleep(600);
    if (cands.length > 0) {
      console.log(`   ✅ ${cands.length} candidate(s), best score ${cands[0].score.toFixed(2)}`);
      rows.push({ publicId: r.public_id, name, oldUrl: r.secure_url, cands });
    } else {
      console.log('   ⚠️ koi bharosemand match nahi');
      noMatch.push({ publicId: r.public_id, name });
    }
  }

  fs.writeFileSync(path.join(__dirname, 'off-no-match.json'), JSON.stringify(noMatch, null, 2));
  console.log(`\n📊 ${rows.length} products ke liye candidates mile, ${noMatch.length} ke liye nahi (off-no-match.json)`);

  const esc = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;');

  const rowsHtml = rows.map((row, idx) => `
    <div class="row" data-publicid="${esc(row.publicId)}">
      <div class="name">${esc(row.name)}</div>
      <div class="compare">
        <label class="option">
          <input type="radio" name="c_${idx}" value="keep" data-url="" checked />
          <div class="label">Purani (abhi)</div>
          <img src="${row.oldUrl}" />
        </label>
        ${row.cands.map(c => `
        <label class="option">
          <input type="radio" name="c_${idx}" value="new" data-url="${esc(c.image)}" />
          <div class="label">Match ${(c.score * 100).toFixed(0)}%</div>
          <img src="${esc(c.image)}" />
          <div class="cname">${esc(c.brand)} ${esc(c.name)}</div>
        </label>`).join('')}
      </div>
    </div>`).join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OFF Review V2</title>
<style>
body{font-family:Arial,sans-serif;background:#f5f5f5;padding:20px}
.instructions{background:#fff3cd;padding:12px;border-radius:8px;margin-bottom:20px}
.row{background:#fff;border-radius:10px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.name{font-weight:bold;margin-bottom:10px}
.compare{display:flex;gap:12px;flex-wrap:wrap}
.option{border:2px solid #ddd;border-radius:8px;padding:8px;width:170px;cursor:pointer;text-align:center}
.option:has(input:checked){border-color:#22c55e;background:#f0fdf4}
.option img{width:100%;height:140px;object-fit:contain;background:#f9f9f9}
.label{font-size:12px;font-weight:600;margin:4px 0}
.cname{font-size:11px;color:#555;word-break:break-word}
#exportBtn{position:fixed;top:20px;right:20px;background:#22c55e;color:#fff;border:none;padding:12px 20px;border-radius:8px;font-size:15px;cursor:pointer;z-index:50}
#csvOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center}
#csvBox{background:#fff;padding:20px;border-radius:10px;width:600px;max-width:90%}
#csvBox textarea{width:100%;height:300px;font-family:monospace;font-size:12px}
#csvBox button{margin-top:10px;padding:8px 16px;border-radius:6px;border:none;cursor:pointer}
</style></head><body>
<button id="exportBtn" onclick="exportCsv()">⬇️ Export Review CSV</button>
<div class="instructions">Default "Purani" select hai. Jahan nayi image <b>sahi product ki</b> lage (naam neeche likha hai) wahi select karo. Fir Export dabao.</div>
${rowsHtml}
<div id="csvOverlay"><div id="csvBox"><h3>CSV - copy karo</h3>
<p style="font-size:13px;color:#666">Textarea click → Ctrl+A → Ctrl+C → Notepad → "off-review.csv" (Save As: All Files) scripts folder mein</p>
<textarea id="csvText" readonly onclick="this.select()"></textarea><br/>
<button onclick="document.getElementById('csvOverlay').style.display='none'">Band karo</button></div></div>
<script>
function exportCsv(){
  const rows=[['public_id','decision','new_url']];
  document.querySelectorAll('.row').forEach(r=>{
    const c=r.querySelector('input:checked');
    rows.push([r.dataset.publicid,c.value,c.dataset.url||'']);
  });
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\\n');
  document.getElementById('csvText').value=csv;
  document.getElementById('csvOverlay').style.display='flex';
}
</script></body></html>`;

  fs.writeFileSync(path.join(__dirname, 'off-review.html'), html);
  console.log('✅ off-review.html ready - browser mein kholo.');
}

run();