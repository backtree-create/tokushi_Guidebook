#!/usr/bin/env node
/* データの整合性チェック。CIとローカルの両方で使う。
 *   node validate.mjs
 * 問題があれば終了コード1で落ちる。
 */
import fs from 'fs';
import path from 'path';

const root = import.meta.dirname;
const rj = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const meta = rj('meta.json');
const sources = rj('sources.json');
const jiritsu27 = rj('jiritsu27.json');
const categories = rj('categories.json');

/* --- 1. 自立活動 6区分27項目 --- */
if (jiritsu27.length !== 6) err(`自立活動の区分が6ではありません: ${jiritsu27.length}`);
const itemCount = jiritsu27.reduce((n, k) => n + k.items.length, 0);
if (itemCount !== 27) err(`自立活動の項目が27ではありません: ${itemCount}`);

const validPairs = new Set();
const validKu = new Set();
for (const g of jiritsu27) {
  validKu.add(g.ku);
  for (const it of g.items) validPairs.add(g.ku + ' ' + it.name);
}

/* --- 2. 出典レジストリ --- */
const srcIds = new Set();
for (const s of sources) {
  if (srcIds.has(s.id)) err(`sources.json に重複ID: ${s.id}`);
  srcIds.add(s.id);
  if (!s.title) err(`sources.json: title がありません (${s.id})`);
  if (!['pinned', 'latest'].includes(s.policy)) err(`sources.json: policy が不正 (${s.id}: ${s.policy})`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.checked || '')) err(`sources.json: checked が不正 (${s.id})`);
  if (s.url && !/^https:\/\//.test(s.url)) err(`sources.json: url が https ではありません (${s.id})`);
}

/* --- 3. カテゴリ --- */
const catIds = new Set();
let totalDiseases = 0;
let unreviewed = 0;
const basisTally = {};
const allNames = new Map();

for (const c of categories) {
  if (catIds.has(c.id)) err(`categories.json に重複ID: ${c.id}`);
  catIds.add(c.id);

  for (const k of ['num', 'name', 'en', 'overview', 'needs', 'instruction', 'support', 'places', 'jiritsu', 'quote', 'sourceId']) {
    if (c[k] == null) err(`${c.id}: ${k} がありません`);
  }
  if (!srcIds.has(c.sourceId)) err(`${c.id}: sourceId "${c.sourceId}" が sources.json にありません`);

  for (const j of c.jiritsu || []) {
    if (!validPairs.has(j.ku + ' ' + j.item)) {
      err(`${c.id}: 自立活動の名称が27項目と一致しません -> 「${j.ku}／${j.item}」`);
    }
  }

  const dp = `${c.id}.json`;
  if (!fs.existsSync(path.join(root, dp))) { err(`${dp} がありません`); continue; }
  const diseases = rj(dp);
  totalDiseases += diseases.length;

  const seen = new Set();
  diseases.forEach((d, i) => {
    const where = `${c.id}[${i}] ${d.name || '(名前なし)'}`;
    if (!d.name) err(`${where}: name がありません`);
    if (!d.overview) err(`${where}: overview がありません`);
    if (!Array.isArray(d.support) || !d.support.length) err(`${where}: support が空です`);
    if (!Array.isArray(d.jiritsu)) err(`${where}: jiritsu がありません`);

    if (seen.has(d.name)) err(`${where}: 同じカテゴリ内で病名が重複しています`);
    seen.add(d.name);
    if (!allNames.has(d.name)) allNames.set(d.name, []);
    allNames.get(d.name).push(c.id);

    for (const j of d.jiritsu || []) {
      if (!validKu.has(j.ku)) err(`${where}: 区分名が不正 -> 「${j.ku}」`);
      else if (!validPairs.has(j.ku + ' ' + j.item)) {
        err(`${where}: 自立活動の項目名が27項目と一致しません -> 「${j.ku}／${j.item}」`);
      }
    }

    for (const sv of d.severity || []) {
      if (!sv.level || !sv.criteria || !Array.isArray(sv.support)) {
        err(`${where}: severity の形式が不正です`);
      }
    }

    const b = d.basis;
    if (!b) { err(`${where}: basis がありません`); return; }
    if (!meta.basisLabels.overview[b.overview]) err(`${where}: basis.overview が不正 -> 「${b.overview}」`);
    if (!meta.basisLabels.support[b.support]) err(`${where}: basis.support が不正 -> 「${b.support}」`);
    if (!Array.isArray(b.sources)) err(`${where}: basis.sources が配列ではありません`);
    else {
      for (const sid of b.sources) {
        if (!srcIds.has(sid)) err(`${where}: basis.sources の "${sid}" が sources.json にありません`);
      }
      // editorial 以外は必ず出典を1件以上持つ
      if (b.overview !== 'editorial' && b.sources.length === 0) {
        err(`${where}: overview が ${b.overview} なのに出典が空です`);
      }
      // editorial は出典を持たない代わりに、その理由を evidence に書く
      if (b.overview === 'editorial') {
        if (b.sources.length) err(`${where}: editorial なのに出典が付いています`);
        if (!b.evidence) err(`${where}: editorial には理由（evidence）が必要です`);
      }
    }
    basisTally[b.overview] = (basisTally[b.overview] || 0) + 1;
    if (b.reviewed !== true) unreviewed++;
  });
}

/* --- 4. カテゴリをまたぐ重複 --- */
for (const [name, cats] of allNames) {
  if (cats.length > 1) warn(`複数カテゴリに同じ病名: 「${name}」-> ${cats.join(', ')}`);
}

/* --- 5. メタ情報と Service Worker の版ずれ --- */
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const m = sw.match(/const VERSION = "([^"]+)"/);
if (!m) err('sw.js から VERSION を読み取れません');
else if (m[1] !== meta.version) {
  err(`sw.js の VERSION (${m[1]}) と meta.json の version (${meta.version}) が一致しません。` +
      `内容を更新したら version を上げ、両方を揃えてください（古いキャッシュが残る原因になります）`);
}

/* --- 6. Service Worker のプリキャッシュ漏れ --- */
for (const c of categories) {
  if (!sw.includes(`${c.id}.json`)) {
    err(`sw.js の PRECACHE に ${c.id}.json がありません`);
  }
}

/* --- 出力 --- */
console.log(`検査: ${categories.length}区分 / ${totalDiseases}件 / 出典${sources.length}件 / 自立活動${itemCount}項目`);
console.log(`出典確認が済んでいない疾患: ${unreviewed} / ${totalDiseases} 件`);
console.log('出典区分の内訳:');
for (const [k, v] of Object.entries(basisTally).sort((a, b) => b[1] - a[1])) {
  const pct = (v / totalDiseases * 100).toFixed(1);
  console.log(`  ${k.padEnd(10)} ${String(v).padStart(4)} 件  ${pct}%`);
}
for (const w of warnings) console.log('  注意  ' + w);
for (const e of errors) console.error('  エラー  ' + e);

if (errors.length) {
  console.error(`\n${errors.length}件のエラーがあります。`);
  process.exit(1);
}
console.log('\n問題ありません。');
