#!/usr/bin/env node
/* index.html + assets/ + data/ を1ファイルに結合する。
 * GitHub Pages には分割版（ルート直下の index.html）を置き、
 * USB配布やメール添付には dist/tokushi-guidebook-standalone.html を使う。
 * ファイル名をルートの index.html と変えてあるのは、
 * 同名だとまとめてアップロードするときに衝突するため。
 *
 *   node tools/build.mjs
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const rj = (p) => JSON.parse(rd(p));

const meta = rj('data/meta.json');
const sources = rj('data/sources.json');
const jiritsu27 = rj('data/jiritsu27.json');
const categories = rj('data/categories.json');
for (const c of categories) {
  c.diseases = rj(`data/diseases/${c.id}.json`);
}

const bundle = { meta, sources, jiritsu27, categories };

// </script> がデータ中に現れてもHTMLが壊れないようにエスケープする
const bundleJson = JSON.stringify(bundle)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

let html = rd('index.html');

html = html.replace(
  /<!--BUILD:STYLE-->[\s\S]*?<!--\/BUILD:STYLE-->/,
  '<style>\n' + rd('assets/style.css') + '\n</style>'
);
html = html.replace(
  /<!--BUILD:DATA-->[\s\S]*?<!--\/BUILD:DATA-->/,
  '<script>window.__BUNDLE__=' + bundleJson + ';</script>'
);
html = html.replace(
  /<!--BUILD:SCRIPT-->[\s\S]*?<!--\/BUILD:SCRIPT-->/,
  '<script>\n' + rd('assets/app.js') + '\n</script>'
);
// 単一ファイル版に Service Worker と manifest は不要
html = html.replace(/^\s*<script src="assets\/sw-register\.js"><\/script>\s*$/m, '');
html = html.replace(/^\s*<link rel="manifest" href="manifest\.json">\s*$/m, '');

// アイコンを data URI で埋め込み、外部ファイルへの依存をなくす
const iconDataUri = 'data:image/png;base64,' +
  fs.readFileSync(path.join(root, 'icon-192.png')).toString('base64');
html = html.replace(/(href|src)="icon-192\.png"/g, '$1="' + iconDataUri + '"');

const OUT = 'dist/tokushi-guidebook-standalone.html';
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, OUT), html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
const n = categories.reduce((s, c) => s + c.diseases.length, 0);
console.log(`${OUT} を出力しました（${kb} KB／${categories.length}区分・${n}件・版 ${meta.version}）`);
