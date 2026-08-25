# 特別支援教育 指導支援ハンドブック

障害種別・原因疾患ごとの教育的ニーズ、合理的配慮、自立活動を整理した実務参照ツールです。

公開先: https://backtree-create.github.io/tokushi_Guidebook/

---

## 出典の扱い（先に読んでください）

このツールの内容は、性質の異なる3種類が混ざっています。編集するときは、どれを触っているのかを意識してください。

| 区分 | 内容 | 出典 |
|---|---|---|
| 障害種別ページ | 教育的ニーズ／指導内容／合理的配慮／学びの場 | 文部科学省「障害のある子供の教育支援の手引」（令和3年6月） |
| 自立活動 6区分27項目 | 区分・項目・内容の要旨 | 文部科学省「解説 自立活動編」（平成30年3月） |
| **疾患・状態別の分類（514件）** | 医学的説明は公的疾患データベース由来。**支援内容と自立活動の対応づけは本ツールによる教育的整理** | 文部科学省の資料に直接記載されているものではありません |

3つ目が全体の分量の大半を占めます。各疾患を開くと、記述ごとの出典区分がバッジで表示されます。

---

## ファイル構成

```
index.html            画面の骨組み（GitHub Pages が配信するのはこれ）
assets/style.css      スタイル
assets/app.js         描画ロジック
assets/sw-register.js Service Worker の登録
sw.js                 オフライン対応
manifest.json         PWA 設定

data/meta.json        版・更新日・免責文・診断名対応表
data/sources.json     参考資料の一元管理（URL はここにしか書かない）
data/categories.json  障害種別 11区分（疾患は含まない）
data/jiritsu27.json   自立活動 6区分27項目
data/diseases/*.json  疾患・状態 514件（区分ごとに1ファイル）

tools/build.mjs       配布用の単一ファイルを生成
tools/validate.mjs    データ整合性チェック
tools/basis-audit.mjs 出典区分の確認作業を進める道具
dist/tokushi-guidebook-standalone.html
                      配布用の単一ファイル（USB・メール添付向け）
                      ルートの index.html と名前を分けてあるのは、同名だと
                      まとめてアップロードするときに衝突するため
```

---

## 編集のしかた

### 内容を直す

`data/` 以下の JSON を直接編集します。`index.html` に内容は書かれていません。

編集したら **必ず** 次を実行してください。

```bash
node tools/validate.mjs   # 整合性チェック
node tools/build.mjs      # 配布用の単一ファイルを作り直す
```

**GitHub のサイト上で編集した場合は、これらを自分で実行する必要はありません。**
`build.yml` が push のたびに検査とビルドを行い、配布用ファイルを自動でコミットします。

`validate.mjs` は次を見ています。

- 疾患に書かれた自立活動の項目名が、27項目と一字一句一致しているか（**タイポしても画面上は静かに表示されるだけなので、これが唯一の防波堤です**）
- `sourceId` が `sources.json` に存在するか
- 区分内で病名が重複していないか
- `sw.js` の `VERSION` と `meta.json` の `updated` が揃っているか
- `sw.js` の `PRECACHE` に疾患ファイルの記載漏れがないか

### 動作を確認する

`index.html` をダブルクリックしても **動きません**（`fetch` が CORS で止まります）。ローカルサーバー経由で開いてください。

```bash
python3 -m http.server 8000
# → http://localhost:8000/
```

単一ファイル版（`dist/tokushi-guidebook-standalone.html`）はダブルクリックで開けます。

### 内容を更新したときのチェックリスト

1. `data/` を編集
2. `data/meta.json` の `updated` を今日の日付に、`version` を上げる
3. **`sw.js` の `VERSION` を `updated` と同じ日付に**（揃っていないと `validate.mjs` が落ちます）
4. `meta.json` の `changelog` に1行足す
5. `node tools/validate.mjs && node tools/build.mjs`（サイト上で編集した場合は不要）
6. コミット・プッシュ

---

## Service Worker について

**HTML と JSON はネットワーク優先**、CSS/JS/画像はキャッシュ優先です。

これは意図的な設計です。以前の版はすべてキャッシュ優先かつキャッシュ名が固定だったため、一度開いた端末には更新内容が二度と届かない状態でした。現場で参照される資料でこれが起きると、古い情報が独り歩きします。

`VERSION` を変えると、`activate` 時に古いキャッシュが破棄されます。**内容を更新したら必ず `VERSION` も更新してください。**

---

## 参考資料の管理

URL は `data/sources.json` にのみ書きます。画面のフッターと「診断名・出典」タブは、このファイルから自動生成されます。

各資料には更新方針を持たせています。

- `"policy": "pinned"` — 特定版の引用。令和3年6月の手引など。更新不要
- `"policy": "latest"` — 常に最新を参照すべき資料。年報・年次調査など

**リンクチェックは「生きているが年度が古い」を検出できません。** 旧年度のページは残り続けるからです。そのため `policy: "latest"` の資料は、毎年3月に GitHub Actions が見直し用の Issue を自動で立てます。

### 自動化されているもの

| ワークフロー | 実行時期 | 内容 |
|---|---|---|
| `validate.yml` | push / PR ごと | データ整合性チェック、ビルド確認 |
| `build.yml` | `data/` 等の変更時 | 配布用の単一ファイルを再生成して自動コミット |
| `linkcheck.yml` | 毎月1日 | URL の到達性確認。切れていたら Issue を自動作成 |
| `annual-review.yml` | 毎年3月1日 | `policy: latest` の資料の見直し Issue を自動作成 |

重要な PDF は [web.archive.org の Save Page Now](https://web.archive.org/save) に手動保存しておくことをおすすめします。mext.go.jp は PDF の URL をよく変えます。

---

## 出典区分の確認作業

514件すべてが未確認の状態から始まります。一度に全部やる必要はありません。

```bash
node tools/basis-audit.mjs                 # 進捗を見る
node tools/basis-audit.mjs --list health   # 未確認の項目を並べる
node tools/basis-audit.mjs --set health "重症心身障害" public-db editorial
```

- `basis.overview` … `mext`（手引に記載）／ `public-db`（公的DB由来）／ `unverified`（未確認）
- `basis.support` … `mext`（手引に記載）／ `editorial`（本ツールによる整理）
- `basis.reviewed` … `true` にすると画面から「出典未確認」の表示が消えます

---

## 誤りのご指摘

特別支援教育の実務に携わる方からのご指摘を歓迎します。
https://github.com/backtree-create/tokushi_Guidebook/issues

個々の指導計画は、必ず専門家・主治医・教育委員会の判断のもとで作成してください。
