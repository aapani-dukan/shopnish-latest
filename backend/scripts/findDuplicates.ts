import { db } from '../server/db';
import { masterProducts } from '../shared/backend/schema';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// 🔥 DUPLICATE FINDER - poore masterProducts table ko scan karta hai
// =========================================================
// Kaam:
// 1. Saare products fetch karta hai
// 2. Naam normalize karke similar naam wale groups banata hai
//    (chhote size/pack/standard jaise words ignore karke)
// 3. Sirf 2+ members wale groups ko ek HTML report mein dikhata hai,
//    jahan aap image dekh ke radio button se "keep" select karte ho
// 4. "Export CSV" button click karne par ek CSV download hoga jisme
//    delete/keep decisions honge - use dusri script mein use karna hai
//
// RUN: npx ts-node findDuplicates.ts
// OUTPUT: duplicate-review.html (isse browser mein khol lo)

// -----------------------------
// Naam normalize karna - noise words hatana taaki
// "Ghadi Detergent Powder 1kg" aur "Ghadi Detergent Powder Standard"
// dono ek jaise dikhein comparison ke liye
// -----------------------------
const NOISE_WORDS = [
  'small', 'large', 'medium', 'standard', 'premium', 'family', 'pack',
  'pouch', 'sachet', 'bottle', 'jar', 'box', 'carton', 'combo', 'pure',
  'gm', 'g', 'kg', 'ml', 'l', 'ltr', 'litre', 'pcs', 'piece', 'new',
];

function normalizeName(name: string): string {
  let n = name.toLowerCase();
  n = n.replace(/[^\w\s]/g, ' '); // punctuation hatao
  n = n.replace(/\d+/g, ' ');     // numbers hatao (500, 1, etc.)
  const words = n.split(/\s+/).filter(w => w && !NOISE_WORDS.includes(w));
  return words.sort().join(' '); // sort karo taaki word-order farak na pade
}

// -----------------------------
// Simple similarity: kitne common words hain (Jaccard-jaisa)
// -----------------------------
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter(w => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

const SIMILARITY_THRESHOLD = 0.75; // 75%+ common words = duplicate maano

async function run() {
  console.log('📦 Fetching all master products...');
  const items = await db.select().from(masterProducts);
  console.log(`Total: ${items.length} products`);

  const normalized = items.map(item => ({
    ...item,
    _norm: normalizeName(item.name),
  }));

  // Union-Find style grouping (simple version)
  const groups: number[][] = []; // har group mein indexes hain `normalized` array ke
  const assigned = new Array(normalized.length).fill(-1);

  for (let i = 0; i < normalized.length; i++) {
    if (assigned[i] !== -1) continue;
    const group = [i];
    assigned[i] = groups.length;

    for (let j = i + 1; j < normalized.length; j++) {
      if (assigned[j] !== -1) continue;
      if (similarity(normalized[i]._norm, normalized[j]._norm) >= SIMILARITY_THRESHOLD) {
        group.push(j);
        assigned[j] = groups.length;
      }
    }
    groups.push(group);
  }

  const duplicateGroups = groups.filter(g => g.length > 1);
  console.log(`🔍 Found ${duplicateGroups.length} duplicate groups (${duplicateGroups.reduce((s, g) => s + g.length, 0)} products total)`);

  // -----------------------------
  // HTML report banana
  // -----------------------------
  const groupsHtml = duplicateGroups.map((group, gIndex) => {
    const itemsHtml = group.map((idx, mIndex) => {
      const item = normalized[idx];
      return `
        <label class="item">
          <input type="radio" name="group_${gIndex}" value="${item.id}" ${mIndex === 0 ? 'checked' : ''} />
          <img src="${item.image || ''}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'" />
          <div class="meta">
            <div class="name">${item.name}</div>
            <div class="id">ID: ${item.id}</div>
          </div>
        </label>`;
    }).join('');

    return `
      <div class="group" data-group="${gIndex}" data-ids="${group.map(idx => normalized[idx].id).join(',')}">
        <h3>Group ${gIndex + 1} (${group.length} similar products)</h3>
        <div class="items">${itemsHtml}</div>
      </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Duplicate Products Review</title>
<style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
  h1 { color: #222; }
  .instructions { background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
  .group { background: white; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .group h3 { margin-top: 0; }
  .items { display: flex; flex-wrap: wrap; gap: 12px; }
  .item { border: 2px solid #ddd; border-radius: 8px; padding: 8px; width: 160px; cursor: pointer; text-align: center; }
  .item:has(input:checked) { border-color: #22c55e; background: #f0fdf4; }
  .item img { width: 100%; height: 120px; object-fit: contain; background: #f9f9f9; }
  .meta .name { font-size: 12px; margin-top: 6px; word-break: break-word; }
  .meta .id { font-size: 11px; color: #888; }
  #exportBtn { position: fixed; top: 20px; right: 20px; background: #22c55e; color: white; border: none; padding: 12px 20px; border-radius: 8px; font-size: 15px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
  #exportBtn:hover { background: #16a34a; }
</style>
</head>
<body>
<button id="exportBtn" onclick="exportCsv()">⬇️ Export Cleanup CSV</button>
<h1>Duplicate Products Review</h1>
<div class="instructions">
  Har group mein <b>green border wali (default first) select</b> hai — jo image sahi hai wahi radio-select karo (wahi "keep" hogi).
  Baaki sab automatically "delete" list mein chali jaayengi. Sab groups dekh lene ke baad <b>"Export Cleanup CSV"</b> dabao.
</div>
${groupsHtml}
<script>
function exportCsv() {
  const rows = [['delete_id', 'keep_id']];
  document.querySelectorAll('.group').forEach(groupEl => {
    const allIds = groupEl.dataset.ids.split(',').map(Number);
    const checked = groupEl.querySelector('input[type=radio]:checked');
    const keepId = Number(checked.value);
    allIds.forEach(id => {
      if (id !== keepId) rows.push([id, keepId]);
    });
  });
  const csvContent = rows.map(r => r.join(',')).join('\\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'duplicate-cleanup.csv';
  a.click();
}
</script>
</body>
</html>`;

  const outputPath = path.join(__dirname, 'duplicate-review.html');
  fs.writeFileSync(outputPath, html);
  console.log(`\n✅ Report ready: ${outputPath}`);
  console.log('Ise browser mein khol ke review karo, fir "Export Cleanup CSV" dabao.');
}

run();