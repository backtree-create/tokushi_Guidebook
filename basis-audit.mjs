#!/usr/bin/env node
/* 疾患ごとの出典区分（basis）の確認作業を進めるための道具。
 *
 *   node tools/basis-audit.mjs                    未確認の件数を区分ごとに表示
 *   node tools/basis-audit.mjs --list health      未確認の項目名を並べる
 *   node tools/basis-audit.mjs --set health "重症心身障害" public-db editorial
 *                                                1件の区分を確定して reviewed:true にする
 *   node tools/basis-audit.mjs --set-all visual overview public-db
 *                                                区分内の未確認項目の overview をまとめて設定
 *                                                （reviewed は変えない）
 *
 * basis.overview : mext | public-db | unverified   医学的説明の出典
 * basis.support  : mext | editorial                支援内容の出典
 * basis.reviewed : true にすると画面から「出典未確認」の表示が消える
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const dp = (id) => path.join(root, 'data/diseases', id + '.json');
const rj = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const wj = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

const cats = rj(path.join(root, 'data/categories.json'));
const OV = ['mext', 'public-db', 'unverified'];
const SP = ['mext', 'editorial'];

const [cmd, ...rest] = process.argv.slice(2);

function summary() {
  let tot = 0, done = 0;
  console.log('区分            確認済 / 全件   未確認の内訳');
  for (const c of cats) {
    const ds = rj(dp(c.id));
    const r = ds.filter((d) => d.basis && d.basis.reviewed).length;
    const unv = ds.filter((d) => d.basis && d.basis.overview === 'unverified').length;
    tot += ds.length; done += r;
    console.log(
      c.id.padEnd(14),
      String(r).padStart(4) + ' / ' + String(ds.length).padEnd(5),
      '  医学的説明の出典未確認 ' + unv + '件'
    );
  }
  console.log('\n合計 ' + done + ' / ' + tot + ' 件が確認済み（' +
    Math.round((done / tot) * 100) + '%）');
  if (done < tot) {
    console.log('\n手順：文部科学省「教育支援の手引」第3編の該当章に病名が出てくれば mext、');
    console.log('      小慢・難病情報センター・GeneReviews に記載があれば public-db を指定します。');
    console.log('      支援内容は、手引に直接書かれていなければ editorial のままで構いません。');
  }
}

function list(id) {
  const ds = rj(dp(id));
  ds.forEach((d, i) => {
    if (d.basis && d.basis.reviewed) return;
    console.log(String(i).padStart(3) + '  ' + d.name +
      '   [overview=' + d.basis.overview + ' support=' + d.basis.support + ']');
  });
}

function setOne(id, name, ov, sp) {
  if (!OV.includes(ov)) throw new Error('overview は ' + OV.join(' | '));
  if (!SP.includes(sp)) throw new Error('support は ' + SP.join(' | '));
  const p = dp(id);
  const ds = rj(p);
  const d = ds.find((x) => x.name === name);
  if (!d) throw new Error('見つかりません: ' + id + ' / ' + name);
  d.basis = { overview: ov, support: sp, reviewed: true };
  wj(p, ds);
  console.log('確定:', id, '/', name, '→', ov, '/', sp);
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
  if (cmd === '--list') list(rest[0]);
  else if (cmd === '--set') setOne(rest[0], rest[1], rest[2], rest[3]);
  else if (cmd === '--set-all') setAll(rest[0], rest[1], rest[2]);
  else summary();
} catch (e) {
  console.error('エラー:', e.message);
  process.exit(1);
}
