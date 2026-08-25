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

**フォルダを作らず、すべてルート直下に置いています。** GitHub のサイト上でファイルをまとめてアップロードすると、ブラウザがフォルダ構造を落としてしまうためです。実際にそれで一度壊れました。整理された見た目より、更新できることを優先しています。

```
index.html            画面の骨組み（GitHub Pages が配信するのはこれ）
style.css             スタイル
app.js                描画ロジック
sw-register.js        Service Worker の登録
sw.js                 オフライン対応
manifest.json         PWA 設定

meta.json             版・更新日・免責文・診断名対応表
sources.json          参考資料の一元管理（URL はここにしか書かない）
categories.json       障害種別 11区分（疾患は含まない）
jiritsu27.json        自立活動 6区分27項目

visual.json           疾患・状態 514件。区分ごとに1ファイル
hearing.json          （visual / hearing / intellectual / physical /
intellectual.json       health / language / autism / emotional /
physical.json           ld / adhd / futoukou の11本）
health.json
language.json
autism.json
emotional.json
ld.json
adhd.json
futoukou.json

build.mjs             配布用の単一ファイルを生成
validate.mjs          データ整合性チェック
basis-audit.mjs       出典区分の確認作業を進める道具

tokushi-guidebook-standalone.html
                      配布用の単一ファイル（USB・メール添付向け）

.github/workflows/    GitHub Actions の設定
                      ここだけはフォルダが必須（GitHub の決まり）
```

疾患ファイルの名前は `categories.json` の `id` と一致させる決まりです。区分を増やすときは、`categories.json` に追記し、同じ名前の `<id>.json` をルートに置き、`sw.js` の `PRECACHE` にも1行足してください（足し忘れは `validate.mjs` が検出します）。

---

## 編集のしかた

### 内容を直す

ルート直下の JSON を直接編集します。`index.html` に内容は書かれていません。

編集したら **必ず** 次を実行してください。

```bash
node validate.mjs   # 整合性チェック
node build.mjs      # 配布用の単一ファイルを作り直す
```

**GitHub のサイト上で編集した場合は、これらを自分で実行する必要はありません。**
`build.yml` が push のたびに検査とビルドを行い、配布用ファイルを自動でコミットします。

`validate.mjs` は次を見ています。

- 疾患に書かれた自立活動の項目名が、27項目と一字一句一致しているか（**タイポしても画面上は静かに表示されるだけなので、これが唯一の防波堤です**）
- `sourceId` が `sources.json` に存在するか
- 区分内で病名が重複していないか
- `sw.js` の `VERSION` と `meta.json` の `version` が揃っているか
- `sw.js` の `PRECACHE` に疾患ファイルの記載漏れがないか
- 全ファイル名が一意か（同名だとアップロード時に衝突するため）
- 文字色のコントラスト比が 4.5 以上か、文字サイズが 11px 以上か

### 見た目を変えるときの下限

`style.css` の色と文字サイズには下限を設けてあり、`validate.mjs` が検査します。

- `--ink` `--ink-soft` `--ink-faint` `--gold` `--teal` は、`--paper` `--card` `--paper2` のどの背景に置いても **コントラスト比 4.5 以上**
- `font-size` は **11px 以上**

薄いグレーや小さい文字は一見おしゃれに見えますが、教室のプロジェクターや明るい部屋では読めなくなります。下限を割る値を書くと `validate.mjs` が落ちます。色を変えたいときは、色相はそのままに明度だけ下げてください。

### 動作を確認する

`index.html` をダブルクリックしても **動きません**（`fetch` が CORS で止まります）。ローカルサーバー経由で開いてください。

```bash
python3 -m http.server 8000
# → http://localhost:8000/
```

単一ファイル版（`tokushi-guidebook-standalone.html`）はダブルクリックで開けます。

### 内容を更新したときのチェックリスト

1. 該当する JSON を編集
2. `meta.json` の `updated` を今日の日付に、`version` を上げる
3. **`sw.js` の `VERSION` を `version` と同じ値に**（揃っていないと `validate.mjs` が落ちます）
4. `meta.json` の `changelog` に1行足す
5. `node validate.mjs && node build.mjs`（サイト上で編集した場合は不要）
6. コミット・プッシュ

---

## Service Worker について

**HTML と JSON はネットワーク優先**、CSS/JS/画像はキャッシュ優先です。

これは意図的な設計です。以前の版はすべてキャッシュ優先かつキャッシュ名が固定だったため、一度開いた端末には更新内容が二度と届かない状態でした。現場で参照される資料でこれが起きると、古い情報が独り歩きします。

`VERSION` を変えると、`activate` 時に古いキャッシュが破棄されます。**内容を更新したら必ず `VERSION` も更新してください。**

---

## 参考資料の管理

URL は `sources.json` にのみ書きます。画面のフッターと「診断名・出典」タブは、このファイルから自動生成されます。

各資料には更新方針を持たせています。

- `"policy": "pinned"` — 特定版の引用。令和3年6月の手引など。更新不要
- `"policy": "latest"` — 常に最新を参照すべき資料。年報・年次調査など

**リンクチェックは「生きているが年度が古い」を検出できません。** 旧年度のページは残り続けるからです。そのため `policy: "latest"` の資料は、毎年3月に GitHub Actions が見直し用の Issue を自動で立てます。

### 自動化されているもの

| ワークフロー | 実行時期 | 内容 |
|---|---|---|
| `validate.yml` | push / PR ごと | データ整合性チェック、ビルド確認 |
| `build.yml` | JSON 等の変更時 | 配布用の単一ファイルを再生成して自動コミット |
| `linkcheck.yml` | 毎月1日 | URL の到達性確認。切れていたら Issue を自動作成 |
| `annual-review.yml` | 毎年3月1日 | `policy: latest` の資料の見直し Issue を自動作成 |

重要な PDF は [web.archive.org の Save Page Now](https://web.archive.org/save) に手動保存しておくことをおすすめします。mext.go.jp は PDF の URL をよく変えます。

---

## 出典区分（各項目がどの資料に基づくか）

疾患・状態514件それぞれについて、医学的説明がどの資料に基づくかを特定し、項目を開くと表示されます。

| 区分 | 意味 | 件数 |
|---|---|---|
| `academic` | 学会・国立研究機関の一般向け解説 | 144 |
| `shouman` | 小児慢性特定疾病 対象疾病 | 127 |
| `editorial` | 対応する公的分類が見当たらず、本ツールが整理した類型 | 81 |
| `mext` | 文部科学省「教育支援の手引」に記載 | 70 |
| `dsm-icd` | DSM-5-TR ／ ICD-11 の診断分類 | 59 |
| `grj` | GeneReviews Japan に日本語解説あり | 14 |
| `research` | 個別の研究発表に基づく | 11 |
| `nanbyou` | 指定難病 | 8 |

**`editorial` は「誤り」ではありません。** 「聴覚過敏が特に顕著なタイプ」「漢字の習得に特化した困難」のように、公的な疾患分類には存在しないが教育実務上は区別する意味がある類型です。81件の大半は自閉症・LD・ADHD・不登校の下位類型で、それぞれ理由を `evidence` に書いてあります。

支援内容と自立活動の対応づけは、**どの項目でも `editorial`** です。これはどの資料にも直接書かれていません。

```bash
node basis-audit.mjs                        # 内訳を見る
node basis-audit.mjs --list ld editorial    # 出典を特定できていない項目を並べる
node basis-audit.mjs --set health "重症心身障害" academic ncchd "補足"
```

`validate.mjs` は、`sources` に書かれたIDが `sources.json` に実在するか、`editorial` 以外に出典が付いているか、`editorial` に理由が書かれているかを検査します。

### 判定に使った資料

- 文部科学省「障害のある子供の教育支援の手引」第3編 各章PDF（記載の有無を確認）
- 小児慢性特定疾病情報センター 16疾患群別の対象疾病一覧
- 難病情報センター 五十音別の指定難病一覧
- GeneReviews Japan 疾患リストおよび個別ページ
- 日本眼科学会／日本耳鼻咽喉科頭頸部外科学会／国立成育医療研究センター／こころの情報サイト（NCNP）／日本小児心身医学会／日本神経学会／国立障害者リハビリテーションセンター

いずれも `sources.json` に登録し、「診断名・出典」タブから一覧できます。

---

## 誤りのご指摘

特別支援教育の実務に携わる方からのご指摘を歓迎します。
https://github.com/backtree-create/tokushi_Guidebook/issues

個々の指導計画は、必ず専門家・主治医・教育委員会の判断のもとで作成してください。
