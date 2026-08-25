#!/usr/bin/env node
/* 疾患ごとの出典区分（basis）の確認作業を進めるための道具。
 *
 *   node basis-audit.mjs                    未確認の件数を区分ごとに表示
 *   node basis-audit.mjs --list health      未確認の項目名を並べる
 *   node basis-audit.mjs --set health "重症心身障害" public-db editorial
 *                                                1件の区分を確定して reviewed:true にする
 *   node basis-audit.mjs --set-all visual overview public-db
 *                                                区分内の未確認項目の overview をまとめて設定
 *                                                （reviewed は変えない）
 *
 * basis.overview : mext | shouman | nanbyou | grj | dsm-icd | academic | research | editorial
 * basis.sources  : sources.json の id の配列（editorial は空）
 * basis.evidence : 該当ページのURL、または editorial の場合はその理由
 * basis.support  : mext | editorial
 */
import fs from 'fs';
import path from 'path';

const root = import.meta.dirname;
const dp = (id) => path.join(root, id + '.json');
const rj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const wj = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

const cats = rj(path.join(root, 'categories.json'));
const OV = ['mext', 'shouman', 'nanbyou', 'grj', 'dsm-icd', 'academic', 'research', 'editorial'];
const SP = ['mext', 'editorial'];

const [cmd, ...rest] = process.argv.slice(2);

function summary() {
  let tot = 0;
  const grand = {};
  console.log('区分            件数   出典区分の内訳');
  for (const c of cats) {
    const ds = rj(dp(c.id));
    tot += ds.length;
    const t = {};
    for (const d of ds) {
      const k = d.basis ? d.basis.overview : '(なし)';
      t[k] = (t[k] || 0) + 1;
      grand[k] = (grand[k] || 0) + 1;
    }
    const detail = Object.entries(t).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`).join('  ');
    console.log(c.id.padEnd(14), String(ds.length).padStart(4), '  ' + detail);
  }
  console.log('\n合計 ' + tot + ' 件');
  for (const [k, v] of Object.entries(grand).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + k.padEnd(10) + String(v).padStart(4) + ' 件  ' +
      (v / tot * 100).toFixed(1) + '%');
  }
  console.log('\neditorial は「誤り」ではなく、対応する公的分類が見当たらず');
  console.log('本ツールが教育実務上まとめた類型であることを示します。');
}

function list(id, only) {
  const ds = rj(dp(id));
  ds.forEach((d, i) => {
    if (only && d.basis.overview !== only) return;
    const src = d.basis.sources.length ? d.basis.sources.join(',') : '—';
    console.log(String(i).padStart(3) + '  ' + d.name +
      '\n       [' + d.basis.overview + '] 出典: ' + src +
      (d.basis.evidence ? '\n       ' + d.basis.evidence : ''));
  });
}

function setOne(id, name, ov, srcCsv, evidence) {
  if (!OV.includes(ov)) throw new Error('overview は ' + OV.join(' | '));
  const p = dp(id);
  const ds = rj(p);
  const d = ds.find((x) => x.name === name);
  if (!d) throw new Error('見つかりません: ' + id + ' / ' + name);
  const sources = (srcCsv || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ov !== 'editorial' && !sources.length) throw new Error('editorial 以外は出典が必要です');
  d.basis = { overview: ov, sources, support: d.basis ? d.basis.support : 'editorial', reviewed: true };
  if (evidence) d.basis.evidence = evidence;
  wj(p, ds);
  console.log('更新:', id, '/', name, '→', ov, '[' + sources.join(', ') + ']');
}

function setAll(id, field, value) {
  const valid = field === 'overview' ? OV : SP;
  if (!valid.includes(value)) throw new Error(field + ' は ' + valid.join(' | '));
  const p = dp(id);
  const ds = rj(p);
  let n = 0;
  for (const d of ds) {
    if (d.basis && !d.basis.reviewed) { d.basis[field] = value; n++; }
  }
  wj(p, ds);
  console.log('一括設定:', id, field, '→', value, '（' + n + '件。reviewed は未確定のまま）');
}

try {
  if (cmd === '--list') list(rest[0], rest[1]);
  else if (cmd === '--set') setOne(rest[0], rest[1], rest[2], rest[3], rest[4]);
  else if (cmd === '--set-all') setAll(rest[0], rest[1], rest[2]);
  else summary();
} catch (e) {
  console.error('エラー:', e.message);
  process.exit(1);
}
