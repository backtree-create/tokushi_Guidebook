/* 特別支援教育 指導支援ハンドブック — アプリ本体
   データはルート直下の *.json から読み込みます（結合ビルド時は window.__BUNDLE__ に埋め込み）。 */
(function () {
  'use strict';

  /* ---------- 共通ユーティリティ ---------- */

  // データ由来の文字列は必ずこれを通してから innerHTML に埋めること。
  // 病名や説明に < & " が入っても表示が壊れないようにする。
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var DATA = [], JIRITSU27 = [], SOURCES = [], META = {};
  // 区分（DATA）とは別の型で持つ「主題」のタブ。自立活動との対応は持たない。
  //   curriculum: 特別の教育課程（日本語指導・2E。特別支援ガイドブック側）
  //   seito : 生徒指導上の課題（生徒指導提要）
  var TOPICS = {
    curriculum: {
      key: 'curriculum', book: 'tokushi', tab: 'tabCurriculum', mark: '課',
      title: '特別の教育課程', en: 'Special Curricula (Japanese Language / Gifted with Disabilities)',
      intro: '「特別の教育課程」という教育課程上の枠組みで応える対象のうち、障害種別以外の2件を扱います。' +
        '学習指導要領 総則の「特別な配慮を必要とする児童生徒への指導」に並ぶものです。各ページの「関連する障害種別」から、見立ての重なりを確認できます。',
      noteHead: '特別の教育課程は3種類あり、自立活動を用いるのは通級（障害）だけです',
      note: '(1) 通級による指導（学校教育法施行規則 第140条・第141条）：障害のある児童生徒が対象。自立活動の内容を参考に指導する。' +
        '(2) 日本語指導（同 第56条の2 等、平成26年度から）：日本語の指導そのもので、自立活動ではない。' +
        '(3) 特定分野に特異な才能のある児童生徒（制度化を検討中）：大学等での対象活動で、自立活動ではない。' +
        'このタブの2件は(2)(3)にあたります。障害を併せ有する場合、障害の側は障害種別ガイドと自立活動の手順で扱います。',
      foot: '一次資料は文部科学省の手引・通知・審議会資料です。',
      items: []
    },
    seito: {
      key: 'seito', book: 'teiyo', tab: 'tabSeito', mark: '提',
      title: '生徒指導上の課題', en: 'Student Guidance Issues (Seito Shido Teiyo, Part II)',
      intro: '生徒指導提要（令和4年12月改訂）第II部「個別の課題に対する生徒指導」を一次資料とし、章の順に整理しています。' +
        '第I部（生徒指導の基礎・体制）は提要本文を参照してください。' +
        '各課題は提要の重層的支援構造（発達支持的・課題予防的・困難課題対応的）で整理し、「関連する障害種別」から特別支援ガイドブックへ移れます。',
      noteHead: '障害のある児童生徒がこれらの課題に直面している場合',
      note: '自立活動の目標は、課題名から項目を引くのではなく、サポートシートの手順（実態把握 → 課題の整理 → 項目の選定）で決めます。その課題を①実態把握と③指導すべき課題に書き込むところから始めてください。',
      foot: '一次資料は生徒指導提要と、文部科学省・こども家庭庁等の法令・通知・施策文書です。',
      items: []
    }
  };
  var BOOKS = {
    tokushi: { title: '特別支援ガイドブック', home: '#/', modes: ['guide', 'curriculum', 'jiritsu', 'terms'] },
    teiyo:   { title: '指導提要ガイドブック', home: '#/seito', modes: ['seito', 'terms'] }
  };
  var currentBook = 'tokushi';
  var LINKS = [];   // 目的別リンク集（links.json）。URLは持たず sources.json の id を参照する

  /* ---------- メンテナンス中の覆い ---------- */
  // meta.json の maintenance[key].on が true なら、その箇所の中身の代わりに案内を出す。
  // プレビュー: URL に ?preview=合言葉 を付けて開くと、このタブの間だけ覆いを外す。
  var PREVIEW = false;
  function initPreview() {
    var key = META.maintenance && META.maintenance.previewKey;
    var q = location.search.match(/[?&]preview=([^&]*)/);
    try {
      if (q && key && decodeURIComponent(q[1]) === key) {
        sessionStorage.setItem('tk-preview', '1');
        // 合言葉を URL に残さない
        history.replaceState(null, '', location.pathname + location.hash);
      }
      PREVIEW = sessionStorage.getItem('tk-preview') === '1';
    } catch (e) { PREVIEW = !!(q && key && q[1] === key); }
    if (PREVIEW) {
      var bar = document.createElement('div');
      bar.className = 'preview-bar';
      bar.innerHTML = '<span>プレビュー表示中：メンテナンス中の箇所の中身を表示しています（このタブだけ）</span>' +
        '<button type="button" id="previewOff">解除</button>';
      document.body.insertBefore(bar, document.body.firstChild);
      document.getElementById('previewOff').onclick = function () {
        try { sessionStorage.removeItem('tk-preview'); } catch (e) {}
        location.reload();
      };
    }
  }
  function maint(key) {
    if (PREVIEW) return null;
    var m = META.maintenance && META.maintenance[key];
    return (m && m.on) ? m : null;
  }
  function maintCover(m, opts) {
    opts = opts || {};
    return '<div class="maint' + (opts.compact ? ' compact' : '') + '" role="status">' +
      '<span class="maint-tag">メンテナンス中</span>' +
      '<h3>' + esc(m.title || '整備中です') + '</h3>' +
      (m.note ? '<p>' + esc(m.note) + '</p>' : '') +
      (m.until ? '<p class="maint-until">再開の目安：' + esc(m.until) + '</p>' : '') +
      (opts.back ? '<p><a href="' + opts.back.href + '">' + esc(opts.back.label) + '</a></p>' : '') +
      '</div>';
  }
  function renderMaintPage(m, back) {
    mainContent.innerHTML = '<div class="jiritsu-table-wrap">' + maintCover(m, { back: back }) + '</div>';
    playFadeIn();
  }
  function topicOf(key) { return TOPICS[key]; }
  function topicItem(key, id) {
    var t = TOPICS[key];
    return t ? t.items.find(function (x) { return x.id === id; }) : null;
  }
  var SRC = {};   // id -> source

  function srcLink(id) {
    var s = SRC[id];
    if (!s) return '';
    var title = esc(s.title) + (s.edition ? '（' + esc(s.edition) + '）' : '');
    if (!s.url) return title;
    return title + '<br><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a>';
  }

  /* ---------- DOM 参照 ---------- */

  var catList, mainContent, searchBox, sideNav,
      tabGuide, tabCurriculum, tabSeito, tabJiritsu, tabTerms, bookTokushi, bookTeiyo, layoutRoot, homeBtn, homeLink, homeEmblem, siteFooter;

  var currentId = null;
  var mode = 'guide'; // 'guide' | 'curriculum' | 'seito' | 'jiritsu' | 'terms'
  var openDisease = null;   // 開いている疾患名（URLに載せる）
  var routing = false;      // 描画中の navigate を無視するための印

  var supportKeyLabels = {
    content: '教育内容・方法', method: '教材・情報保障',
    system: '支援体制', facility: '施設・設備'
  };

  function playFadeIn() {
    mainContent.classList.remove('fade-in');
    void mainContent.offsetWidth; // 強制リフローでアニメーションを再スタート
    mainContent.classList.add('fade-in');
  }

  /* ==========================================================
     ルーティング
     現在地を URL のハッシュに持たせる。これで
       ・ブラウザの戻る／進むが効く
       ・特定の疾患を指すURLを同僚に送れる
       ・ブックマークできる
     ハッシュを使うのは、GitHub Pages でも単一ファイル版（file://）でも
     サーバ側の設定なしに同じ動きをするため。
     ========================================================== */

  var ROUTES = {
    home:    function () { return '#/'; },
    cat:     function (id, disease) {
      return '#/c/' + encodeURIComponent(id) +
             (disease ? '/' + encodeURIComponent(disease) : '');
    },
    search:  function (q) { return '#/q/' + encodeURIComponent(q); },
    jiritsu: function () { return '#/jiritsu'; },
    support: function () { return '#/jiritsu/support'; },
    terms:   function () { return '#/terms'; },
    curriculum: function (id) { return '#/curriculum' + (id ? '/' + encodeURIComponent(id) : ''); },
    seito:   function (id) { return '#/seito'  + (id ? '/' + encodeURIComponent(id) : ''); },
    topic:   function (key, id) { return key === 'seito' ? ROUTES.seito(id) : ROUTES.curriculum(id); }
  };

  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    if (!h) return { view: 'home' };
    var seg = h.split('/').map(function (x) {
      try { return decodeURIComponent(x); } catch (e) { return x; }
    });
    switch (seg[0]) {
      case 'c':       return { view: 'cat', catId: seg[1], disease: seg[2] || null };
      case 'q':       return { view: 'search', q: seg.slice(1).join('/') };
      case 'jiritsu': return seg[1] === 'support' ? { view: 'support' } : { view: 'jiritsu' };  // 旧逆引き(#/jiritsu/区分/項目)は一覧へ
      case 'terms':   return { view: 'terms' };
      case 'curriculum': return seg[1] ? { view: 'topic-item', topic: 'curriculum', id: seg[1] } : { view: 'topic', topic: 'curriculum' };
      // 旧「配慮を要する背景」(#/haikei)。版4.0.0で振り分けたので転送する
      case 'haikei':  return seg[1] === 'young-carer'
        ? { view: 'topic-item', topic: 'seito', id: 'young-carer', legacy: true }
        : seg[1] ? { view: 'topic-item', topic: 'curriculum', id: seg[1], legacy: true } : { view: 'topic', topic: 'curriculum', legacy: true };
      case 'seito':   return seg[1] ? { view: 'topic-item', topic: 'seito',  id: seg[1] } : { view: 'topic', topic: 'seito' };
      default:        return { view: 'home' };
    }
  }

  // 画面から遷移するときはこれを呼ぶ。描画は hashchange 経由で1本化する。
  function navigate(hash, replace) {
    if (location.hash === hash) { applyRoute(); return; }
    if (replace && history.replaceState) {
      history.replaceState(null, '', hash);
      applyRoute();
    } else {
      navIntent = 'push';     // 自分で押した遷移。戻る／進むと区別する
      location.hash = hash;   // hashchange が発火して applyRoute が走る
    }
  }

  /* ---------- スクロール位置の扱い ----------
     方針: 画面の最上部には戻さない。
     ・自分で押して別の画面に移ったとき → 本文の先頭（タブの直下）が見えるところまで。すでに見えていれば動かさない
     ・戻る／進む → 離れたときの位置に戻す
     ・同じ画面の中の操作（疾患を開く、検索、タブ内の切替）→ 動かさない。開いた疾患が画面外なら最小限だけ寄せる */
  var navIntent = null;           // 'push' | null（null は戻る／進む・URL直打ち）
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';  // ブラウザ任せの復元と競合させない
  var scrollMemo = {};            // hash → 離れたときの scrollY
  var lastHash = location.hash || '#/';

  function contentTop(preferMain) {
    var t = document.querySelector('.mode-tabs');
    var anchor = t ? t.getBoundingClientRect().bottom + window.scrollY : mainContent.getBoundingClientRect().top + window.scrollY;
    // スマホ幅では索引（sideNav）が本文の上に積まれる。障害種別ページを開いたときは索引ではなく本文の先頭へ
    if (preferMain && sideNav.style.display !== 'none') {
      var nav = sideNav.getBoundingClientRect(), main = mainContent.getBoundingClientRect();
      if (nav.bottom <= main.top + 1) anchor = main.top + window.scrollY;
    }
    return Math.max(0, Math.round(anchor - 8));
  }
  function scrollToContent(preferMain) {
    var top = contentTop(preferMain);
    // 本文の先頭が画面の上半分に見えているなら動かさない
    if (window.scrollY <= top && (top - window.scrollY) < window.innerHeight * 0.5) return;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }
  function afterRouteScroll(prevHash, newHash) {
    if (prevHash === newHash) return;
    var isCat = /^#\/c\//.test(newHash);
    if (navIntent === 'push') {
      scrollToContent(isCat);
    } else if (scrollMemo[newHash] != null) {
      var y = scrollMemo[newHash];
      // 描画直後は高さが確定していないことがあるので、少し待ってから戻す
      window.scrollTo({ top: y, behavior: 'auto' });
      setTimeout(function () { window.scrollTo({ top: y, behavior: 'auto' }); }, 60);
    } else {
      scrollToContent(isCat);
    }
    navIntent = null;
  }

  function setTabs(m) {
    // どの冊に属するモードかで上段の切替と下段のタブを揃える
    if (m !== 'terms') currentBook = BOOKS.teiyo.modes.indexOf(m) >= 0 ? 'teiyo' : 'tokushi';
    bookTokushi.classList.toggle('on', currentBook === 'tokushi');
    bookTeiyo.classList.toggle('on', currentBook === 'teiyo');
    document.querySelectorAll('.mode-tabs button').forEach(function (b) {
      var bk = b.getAttribute('data-book');
      b.hidden = !(bk === 'both' || bk === currentBook);
    });
    tabGuide.classList.toggle('on', m === 'guide');
    tabCurriculum.classList.toggle('on', m === 'curriculum');
    tabSeito.classList.toggle('on', m === 'seito');
    tabJiritsu.classList.toggle('on', m === 'jiritsu');
    tabTerms.classList.toggle('on', m === 'terms');
  }

  function applyRoute() {
    if (routing) return;
    routing = true;
    try {
      var r = parseHash();
      mode = (r.view === 'jiritsu' || r.view === 'support') ? 'jiritsu'
           : r.view === 'terms' ? 'terms'
           : (r.view === 'topic' || r.view === 'topic-item') ? r.topic
           : 'guide';
      setTabs(mode);

      var wide = (mode !== 'guide');
      sideNav.style.display = wide ? 'none' : '';
      layoutRoot.classList.toggle('wide', wide);

      if (r.legacy) { navigate(ROUTES.topic(r.topic, r.id), true); return; }
      // サイト全体のメンテナンス。どの画面でも案内だけを出す（プレビュー中は通常どおり）
      if (maint('site')) {
        sideNav.style.display = 'none';
        layoutRoot.classList.add('wide');
        mainContent.innerHTML = '<div class="jiritsu-table-wrap">' + maintCover(maint('site')) + '</div>';
        playFadeIn();
        document.title = 'メンテナンス中｜' + (META.title || '');
        return;
      }
      // 版3.0.0で不登校を障害種別から生徒指導上の課題へ移した。古いURL(#/c/futoukou)は転送する
      if (r.view === 'cat' && r.catId === 'futoukou') { navigate(ROUTES.seito('futoukou'), true); return; }
      if (r.view === 'cat' || r.view === 'search' || r.view === 'home') {
        searchBox.value = (r.view === 'search') ? (r.q || '') : '';
        currentId = (r.view === 'cat') ? r.catId : null;
        openDisease = (r.view === 'cat') ? (r.disease || null) : null;
        renderIndex(searchBox.value);
        if (r.view === 'cat' && DATA.some(function (c) { return c.id === r.catId; })) {
          renderMain(r.catId, r.disease || null);
        } else {
          currentId = null;
          renderHome();
        }
      } else if (r.view === 'jiritsu') {
        renderJiritsuTable();
      } else if (r.view === 'support') {
        if (maint('support')) renderMaintPage(maint('support'), { href: ROUTES.jiritsu(), label: '自立活動 6区分27項目 一覧へ戻る' });
        else renderSupport();
      } else if (r.view === 'terms') {
        renderTerms();
      } else if (r.view === 'topic' || r.view === 'topic-item') {
        if (maint(r.topic)) {
          renderMaintPage(maint(r.topic), { href: ROUTES.home(), label: 'ホームへ戻る' });
        } else if (r.view === 'topic') {
          renderTopicIndex(topicOf(r.topic));
        } else {
          var tp = topicItem(r.topic, r.id);
          if (tp) renderTopicItem(topicOf(r.topic), tp); else renderTopicIndex(topicOf(r.topic));
        }
      }
      document.title = pageTitle(r);
    } finally {
      routing = false;
    }
  }

  function pageTitle(r) {
    var base = META.title || '特別支援教育 指導支援ハンドブック';
    if (r.view === 'cat') {
      var c = DATA.find(function (x) { return x.id === r.catId; });
      if (c) return (r.disease ? r.disease + '｜' : '') + c.name + '｜' + base;
    }
    if (r.view === 'search') return '「' + r.q + '」の検索結果｜' + base;
    if (r.view === 'jiritsu') return '自立活動 6区分27項目｜' + base;
    if (r.view === 'support') return '自立活動サポートシート｜' + base;
    if (r.view === 'terms') return '出典・リンク集｜' + base;
    if (r.view === 'topic') return topicOf(r.topic).title + '｜' + base;
    if (r.view === 'topic-item') {
      var h = topicItem(r.topic, r.id);
      if (h) return h.name + '｜' + topicOf(r.topic).title + '｜' + base;
    }
    return base;
  }

  function goHome() { navigate(ROUTES.home()); }
  function setMode(m) {
    navigate(m === 'guide' ? ROUTES.home()
           : m === 'jiritsu' ? ROUTES.jiritsu()
           : m === 'curriculum' ? ROUTES.curriculum()
           : m === 'seito' ? ROUTES.seito()
           : ROUTES.terms());
  }

  /* ---------- 検索 ---------- */

  var HIT_LABEL = {
    name: '病名', overview: '説明', support: '支援内容',
    severity: '程度別'
  };

  // どのフィールドで当たったかを返す。当たらなければ null。
  function matchDisease(d, f) {
    if ((d.name || '').toLowerCase().indexOf(f) >= 0) return 'name';
    if ((d.overview || '').toLowerCase().indexOf(f) >= 0) return 'overview';
    var i, j;
    for (i = 0; i < (d.support || []).length; i++) {
      if (d.support[i].toLowerCase().indexOf(f) >= 0) return 'support';
    }
    for (i = 0; i < (d.severity || []).length; i++) {
      var sv = d.severity[i];
      if ((sv.level + sv.criteria).toLowerCase().indexOf(f) >= 0) return 'severity';
      for (j = 0; j < (sv.support || []).length; j++) {
        if (sv.support[j].toLowerCase().indexOf(f) >= 0) return 'severity';
      }
    }
    return null;
  }

  /* ---------- 索引 ---------- */

  function renderIndex(filter) {
    var f = (filter || '').trim().toLowerCase();
    catList.innerHTML = '';
    var diseaseHits = [];

    DATA.forEach(function (cat) {
      var catHay = (cat.name + cat.en + cat.overview +
        (cat.needs || []).map(function (n) { return n.k + n.v; }).join('') +
        (cat.instruction || []).map(function (x) { return x.t + x.d; }).join('') +
        Object.keys(cat.support || {}).map(function (k) { return cat.support[k].join(''); }).join('')
      ).toLowerCase();
      // 病名・概要に加え、支援内容・程度別支援・自立活動の項目名まで探す。
      // 「拡大教材」のような手立ての言葉から、それを要する状態を辿れるように。
      var matched = f ? cat.diseases.filter(function (d) {
        d._hit = matchDisease(d, f);
        return !!d._hit;
      }) : [];
      var catMatches = !f || catHay.indexOf(f) >= 0;
      if (f && matched.length) {
        matched.forEach(function (d) { diseaseHits.push({ cat: cat, disease: d }); });
      }
      if (f && !catMatches && !matched.length) return;

      var li = document.createElement('li');
      if (cat.id === currentId) li.className = 'active';
      var btn = document.createElement('button');
      btn.type = 'button';
      var hitBadge = matched.length ? '<span class="idx-hit-count">' + matched.length + '</span>' : '';
      btn.innerHTML = '<span class="num">' + esc(cat.num) + '</span>' +
                      '<span class="cat-name">' + esc(cat.name) + '</span>' + hitBadge;
      btn.onclick = function () { navigate(ROUTES.cat(cat.id)); };
      li.appendChild(btn);
      catList.appendChild(li);
    });

    var hitsEl = document.getElementById('diseaseHits');
    if (hitsEl) hitsEl.remove();
    if (f && diseaseHits.length) {
      hitsEl = document.createElement('div');
      hitsEl.id = 'diseaseHits';
      hitsEl.className = 'disease-hits';
      var label = document.createElement('p');
      label.className = 'index-label';
      label.style.marginTop = '18px';
      label.textContent = '疾患名でのヒット（' + diseaseHits.length + '件）';
      hitsEl.appendChild(label);
      var ul = document.createElement('ul');
      ul.className = 'hit-list';
      diseaseHits.slice(0, 30).forEach(function (h) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.type = 'button';
        var where = h.disease._hit && h.disease._hit !== 'name'
          ? '<span class="hit-where">' + esc(HIT_LABEL[h.disease._hit] || '') + '</span>' : '';
        btn.innerHTML = '<span class="hit-disease">' + esc(h.disease.name) + where + '</span>' +
                        '<span class="hit-cat">' + esc(h.cat.name) + '</span>';
        btn.onclick = function () { navigate(ROUTES.cat(h.cat.id, h.disease.name)); };
        li.appendChild(btn);
        ul.appendChild(li);
      });
      hitsEl.appendChild(ul);
      if (diseaseHits.length > 30) {
        var more = document.createElement('p');
        more.className = 'block-sub';
        more.style.margin = '6px 2px 0';
        more.textContent = '他 ' + (diseaseHits.length - 30) + ' 件（検索語を絞り込んでください）';
        hitsEl.appendChild(more);
      }
      catList.insertAdjacentElement('afterend', hitsEl);
    }
  }

  /* ---------- ホーム ---------- */

  function renderHome() {
    var total = DATA.reduce(function (s, c) { return s + c.diseases.length; }, 0);
    var html = '<div class="home-view">' +
      '<p class="eyebrow" style="color:var(--gold);font-family:var(--sans);letter-spacing:.28em;font-size:11px;">INDEX</p>' +
      '<h2 class="cat-title">障害種別 索引</h2>' +
      '<p>' + DATA.length + 'の障害種別について、原因となる病気・状態別の分類、教育的ニーズ、合理的配慮を含む必要な支援内容、学びの場を整理しています。自立活動の項目は、疾患から引くのではなく、サポートシートの手順で子どもの実態から選びます。左の索引または下の一覧から選んでください。</p>' +
      '<div class="home-stats">' +
        '<div class="home-stat"><b>' + DATA.length + '</b><span>障害種別</span></div>' +
        '<div class="home-stat"><b>' + total + '</b><span>原因疾患・状態の分類</span></div>' +
        '<div class="home-stat"><b>27</b><span>自立活動 項目数</span></div>' +
      '</div>' +
      '<div class="home-grid">';

    DATA.forEach(function (cat) {
      html += '<div class="home-card" data-id="' + esc(cat.id) + '">' +
        '<span class="num">' + esc(cat.num) + '</span>' +
        '<h4>' + esc(cat.name) + '</h4>' +
        '<p>' + cat.diseases.length + '種の分類を収録 ／ ' + esc(cat.overview.slice(0, 40)) + '…</p>' +
        '</div>';
    });

    html += '</div>';
    html += '<div class="hk-home-note">' +
      '<b>指導提要ガイドブック' + (maint('seito') ? '<span class="maint-mini">整備中</span>' : '') + '</b>' +
      '<span>' + (maint('seito') ? esc(maint('seito').title) :
        '不登校・ヤングケアラーなど、生徒指導提要に基づく課題は上段の切替から「指導提要ガイドブック」へ。障害種別の各ページからも関連する課題へ飛べます。') + '</span>' +
      '<a href="' + ROUTES.seito() + '">指導提要ガイドブックを開く</a></div>';
    html += '<div class="disclaimer">' + esc(META.disclaimer.long) + '</div></div>';

    mainContent.innerHTML = html;
    playFadeIn();
    mainContent.querySelectorAll('.home-card').forEach(function (el) {
      el.onclick = function () { navigate(ROUTES.cat(el.dataset.id)); };
    });
  }

  /* ---------- 出典区分バッジ ---------- */

  // 見出しに付ける「出典①」の印。末尾の出典欄の番号と対応する
  function srcRef(n) {
    var circ = ['', '①', '②', '③'][n] || String(n);
    return '<span class="src-ref" title="末尾の出典 ' + circ + '">' + circ + '</span>';
  }

  // 出典欄。①概要 ②個別に求められる支援 ③程度別の支援 の順に、何に基づくかを示す
  function basisBadges(d) {
    var b = d.basis;
    if (!b) return '';
    var ov = META.basisLabels.overview[b.overview];
    var sp = META.basisLabels.support[b.support];
    if (!ov && !sp) return '';

    // どの資料に基づくのかを、資料名と（あれば）URLで示す
    var refs = (b.sources || []).map(function (id) {
      var x = SRC[id];
      if (!x) return '';
      var name = esc(x.title) + (x.edition ? '（' + esc(x.edition) + '）' : '');
      return x.url
        ? '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + name + '</a>' +
          '<span class="basis-pub">' + esc(x.publisher || '') + '</span></li>'
        : '<li>' + name + '<span class="basis-pub">' + esc(x.publisher || '') + '</span></li>';
    }).filter(Boolean);

    var rows = [];
    // ① 概要
    var ovBody = '';
    if (refs.length) ovBody += '<ul class="basis-refs">' + refs.join('') + '</ul>';
    if (b.evidence) {
      var isUrl = /^https?:\/\//.test(b.evidence);
      ovBody += '<p class="basis-evidence">' + (isUrl
        ? '該当ページ：<a href="' + esc(b.evidence) + '" target="_blank" rel="noopener">' + esc(b.evidence) + '</a>'
        : esc(b.evidence)) + '</p>';
    }
    if (ov) rows.push(basisRow('①', '概要（医学的説明）', ov, ovBody));
    // ② 個別に求められる支援
    if (sp) {
      var spBody = (b.support === 'editorial')
        ? '<p class="basis-note">上の資料に示された医学的特性を踏まえ、本ツールが教育実務上まとめたものです。資料に支援内容の記載があるわけではありません。</p>'
        : '';
      rows.push(basisRow('②', '個別に求められる支援', sp, spBody));
    }
    // ③ 程度別の支援
    if (d.severity) {
      var sc = d.severityScale;
      var lab, tone, scBody = '';
      if (sc && sc.basis !== 'editorial') {
        lab = '公的な尺度に基づく区分'; tone = 'ok';
        scBody = '<p class="basis-note">用いている尺度：' + esc(sc.name) + '。区分ごとの支援内容は本ツールによる教育的整理です。</p>';
      } else {
        lab = '本ツールによる目安'; tone = 'info';
        scBody = '<p class="basis-note">' + (sc ? '目安の立て方：' + esc(sc.name) + '。' : '') + '対応する公的な尺度がないため、本ツールが教育実務上の目安として区分したものです。</p>';
      }
      rows.push(basisRow('③', '程度別の支援', { label: lab, tone: tone }, scBody));
    }
    return '<div class="basis-detail"><p class="basis-label">出典</p><dl class="basis-legend">' + rows.join('') + '</dl></div>';
  }
  function basisRow(num, title, lab, body) {
    return '<dt><span class="src-ref">' + num + '</span>' + esc(title) + '</dt>' +
      '<dd><span class="basis-kind tone-' + esc(lab.tone) + '">' + esc(lab.label) + '</span>' + body + '</dd>';
  }

  // 学校生活管理指導表。運動制限は実際にはこの書式で学校に伝わるので、
  // 対象になる疾患にはその旨を出す。様式に根拠のあるものだけに付けている。
  function guidanceFormLine(d) {
    var g = d.guidanceForm;
    if (!g) return '';
    var src = SRC[g.sourceId];
    var also = g.alsoSourceId ? SRC[g.alsoSourceId] : null;
    var link = function (x) {
      if (!x) return '';
      return x.url
        ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>'
        : esc(x.title);
    };
    return '<div class="form-line">' +
      '<p class="form-head">' +
        (g.form === 'allergy' ? 'アレルギー疾患用の' : '') +
        '学校生活管理指導表の対象です</p>' +
      '<p class="form-body">' +
        '主治医が指導区分（A 在宅医療・入院が必要／B 登校はできるが運動は不可／' +
        'C 軽い運動は可／D 中等度の運動まで可／E 強い運動も可）を記入し、' +
        '保護者を通じて学校に提出されます。学校での運動の可否は、この書式の指示に従ってください。</p>' +
      '<p class="form-src">' + link(src) +
        (also ? '／' + link(also) : '') + '</p>' +
      (g.ground ? '<p class="form-ground">対象とした根拠：' + esc(g.ground) +
        (g.alsoNote ? '。' + esc(g.alsoNote) : '') + '</p>' : '') +
      '</div>';
  }

  // 現場の先生が気づいた誤りを送れるようにする。
  // 何について書けばよいか迷わないよう、対象の名前を画面に出しておく。
  function feedbackLink(catName, diseaseName) {
    var fb = META.feedback;
    if (!fb || !fb.url) return '';
    return '<p class="fb-line">' +
      '<a class="fb-link" href="' + esc(fb.url) + '" target="_blank" rel="noopener">' +
      esc(fb.itemLabel || 'この項目について指摘する') + '</a>' +
      '<span class="fb-ctx">フォームに次をお書き添えください：' +
      esc(catName) + '／' + esc(diseaseName) + '</span></p>';
  }

  /* ---------- 法令が定める障害の程度 ---------- */

  // 学校教育法施行令第22条の3。就学先を検討するときの法令上の基準で、
  // 条文をそのまま引用する。要約すると意味が変わるため言い換えない。
  function legalBlock(cat) {
    var lc = cat.legalCriteria;
    if (!lc) return '';
    var src = SRC[lc.sourceId];
    return '<section class="block">' +
      '<h3 class="block-title">特別支援学校の対象となる障害の程度' +
        '<span class="tally">政令</span></h3>' +
      '<p class="block-sub">' + esc(lc.law) + 'が定める「' + esc(lc.term) + '」の程度です。' +
        '条文をそのまま引用しています。</p>' +
      '<div class="legal-box">' +
        lc.clauses.map(function (t) {
          return '<p class="legal-clause">' + esc(t) + '</p>';
        }).join('') +
      '</div>' +
      '<div class="section-disclaimer"><b>この程度に該当することが、就学先を決めるわけではありません</b>' +
        '<p>' + esc(lc.note) + '</p></div>' +
      (src ? '<p class="legal-src">出典：' +
        (src.url
          ? '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.title) + '</a>'
          : esc(src.title)) +
        '（' + esc(src.publisher || '') + '）</p>' : '') +
      '</section>';
  }

  /* ---------- 通知が定める学級・通級の程度 ---------- */

  // 25文科初第756号 通知（別紙）。特別支援学級と通級による指導の対象となる
  // 障害の程度で、施行令第22条の3（特別支援学校）とは別の基準。
  // これも条文の引用なので言い換えない。
  function programBlock(cat) {
    var pc = cat.programCriteria;
    if (!pc) return '';
    var src = SRC[pc.sourceId];
    var byProgram = ['特別支援学級', '通級による指導'].map(function (prog) {
      var hit = (pc.entries || []).filter(function (e) { return e.program === prog; });
      if (hit.length) {
        return '<div class="prog-item">' +
          '<p class="prog-head"><span class="prog-name">' + esc(prog) + '</span>' +
            hit.map(function (e) {
              return '<span class="prog-term">' + esc(e.term) +
                (e.part ? '　第' + esc(e.part) + '号' : '') + '</span>';
            }).join('') +
          '</p>' +
          hit.map(function (e) {
            return e.text.split('\n').map(function (line) {
              return '<p class="legal-clause">' + esc(line) + '</p>';
            }).join('');
          }).join('') +
        '</div>';
      }
      var ab = (pc.absent || []).filter(function (a) { return a.program === prog; })[0];
      if (!ab) return '';
      return '<div class="prog-item prog-absent">' +
        '<p class="prog-head"><span class="prog-name">' + esc(prog) + '</span>' +
          '<span class="prog-term prog-none">この通知には定めなし</span></p>' +
        '<p class="prog-reason">' + esc(ab.reason) + '</p>' +
      '</div>';
    }).join('');

    return '<section class="block">' +
      '<h3 class="block-title">特別支援学級・通級による指導の対象となる障害の程度' +
        '<span class="tally">通知</span></h3>' +
      '<p class="block-sub">' + esc(pc.notice) + 'が示す程度です。条文をそのまま引用しています。</p>' +
      (pc.headNote ? '<p class="block-sub">' + esc(pc.headNote) + '</p>' : '') +
      '<div class="legal-box">' + byProgram + '</div>' +
      '<div class="section-disclaimer"><b>該当すれば必ず利用できる、というものではありません</b>' +
        '<p>' + esc(pc.note) + '</p></div>' +
      (src ? '<p class="legal-src">出典：' +
        (src.url
          ? '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.title) + '</a>'
          : esc(src.title)) +
        '（' + esc(src.publisher || '') + '）</p>' : '') +
      '</section>';
  }

  /* ---------- 障害種別ページ ---------- */

  function renderMain(id, openDiseaseName) {
    var cat = DATA.find(function (c) { return c.id === id; });
    if (!cat) { renderHome(); return; }

    var needsHtml = cat.needs.map(function (n) {
      return '<div class="need-card"><span class="k">' + esc(n.k) + '</span><div>' + esc(n.v) + '</div></div>';
    }).join('');

    var instrHtml = cat.instruction.map(function (i) {
      return '<div class="instr-item"><div class="t">' + esc(i.t) + '</div><div>' + esc(i.d) + '</div></div>';
    }).join('');

    var placesHtml = cat.places.map(function (p) {
      return '<div class="place-row"><div class="p-name">' + esc(p.name) + '</div><div>' + esc(p.note) + '</div></div>';
    }).join('');

    var diseaseHtml = cat.diseases.map(function (d, i) {
      var supportLis = d.support.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');

      var scale = d.severityScale;
      var scaleBlock = scale ? (
        '<div class="scale-box' + (scale.basis === 'editorial' ? ' editorial' : '') + '">' +
          '<p class="scale-name">' +
            (scale.basis === 'editorial' ? '目安の立て方：' : '用いている尺度：') +
            esc(scale.name) + '</p>' +
          (scale.note ? '<p class="scale-note">' + esc(scale.note) + '</p>' : '') +
          ((scale.sources || []).length
            ? '<p class="scale-src">' + scale.sources.map(function (id) {
                var x = SRC[id];
                if (!x) return '';
                return x.url
                  ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a>'
                  : esc(x.title);
              }).filter(Boolean).join('／') + '</p>'
            : '') +
        '</div>'
      ) : '';

      var severityBlock = d.severity ? (
        '<p class="dd-label">程度別の支援' + srcRef(3) + '</p>' + scaleBlock +
        '<div class="severity-list">' + d.severity.map(function (sv) {
          return '<div class="severity-item">' +
            '<div class="sv-level">' + esc(sv.level) + '</div>' +
            '<div class="sv-criteria">' + esc(sv.criteria) + '</div>' +
            '<ul class="sv-support">' + sv.support.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
            '</div>';
        }).join('') + '</div>'
      ) : '';

      var noteBlock = d.note
        ? '<p class="d-note"><b>注記</b>' + esc(d.note) + '</p>'
        : '';

      var badge = d.severity ? '<span class="sev-badge">程度別あり</span>' : '';
      if (d.guidanceForm) {
        badge += '<span class="form-badge">学校生活管理指導表</span>';
      }

      return '<div class="disease-item" data-idx="' + i + '">' +
        '<button class="disease-row" type="button">' +
          '<span class="chevron">▶</span>' +
          '<span class="d-name">' + esc(d.name) + '</span>' + badge +
          '<span class="d-hint">詳細を見る</span>' +
        '</button>' +
        '<div class="disease-detail"><div class="disease-detail-inner">' +
          '<p class="dd-label">概要（医学的説明）' + srcRef(1) + '</p>' +
          '<p class="d-overview">' + esc(d.overview) + '</p>' +
          '<p class="dd-label">個別に求められる支援' + srcRef(2) + '</p>' +
          '<ul class="dd-support">' + supportLis + '</ul>' +
          severityBlock +
          noteBlock +
          basisBadges(d) +
          guidanceFormLine(d) +
          feedbackLink(cat.name, d.name) +
        '</div></div>' +
      '</div>';
    }).join('');

    mainContent.innerHTML =
      '<div class="article-head">' +
        '<div class="article-num">' + esc(cat.num) + '</div>' +
        '<h2 class="cat-title">' + esc(cat.name) + '<span class="en">' + esc(cat.en) + '</span></h2>' +
      '</div>' +
      '<div class="overview">' + esc(cat.overview) + '</div>' +

      '<section class="block">' +
        '<h3 class="block-title">基となる病気・状態による分類<span class="tally">' + cat.diseases.length + '件</span></h3>' +
        '<p class="block-sub">同じ障害種でも、原因となる疾患や状態の違いによって必要な配慮は異なります。各項目をクリックすると、①概要 ②個別に求められる支援 ③程度別の支援 が、それぞれの出典と一緒に表示されます。</p>' +
        // 出典の性質はリストを読む前に示す（フッターまでスクロールしないと読めない状態を避ける）
        '<div class="section-disclaimer">' +
          '<b>この分類についての出典表示</b>' +
          '<p>' + esc(META.disclaimer.short) + '文部科学省の資料に直接記載されているものではありません。各項目を開くと、記述ごとの出典区分を表示します。</p>' +
        '</div>' +
        '<div class="disease-list">' + diseaseHtml + '</div>' +
      '</section>' +

      '<section class="block">' +
        '<h3 class="block-title">教育的ニーズの要点</h3>' +
        '<div class="need-grid">' + needsHtml + '</div>' +
      '</section>' +

      '<section class="block">' +
        '<h3 class="block-title">求められる特別な指導内容（例）</h3>' +
        '<div class="instr-list">' + instrHtml + '</div>' +
      '</section>' +

      '<section class="block">' +
        '<h3 class="block-title">合理的配慮を含む必要な支援の内容</h3>' +
        '<div class="support-tabs" id="supportTabs"></div>' +
        '<div class="support-panel" id="supportPanel"></div>' +
      '</section>' +

      '<section class="block">' +
        '<h3 class="block-title">自立活動<span class="tally">手順で考える</span></h3>' +
        (maint('jiritsu-block') ? maintCover(maint('jiritsu-block'), { compact: true }) :
        '<div class="section-disclaimer"><b>自立活動の項目は、この子の実態から選びます</b>' +
        '<p>疾患や障害種から項目を引くのではなく、実態把握 → 課題の整理 → 項目の選定 → 指導内容、の手順で決めます。' +
        '<a href="' + ROUTES.support() + '">自立活動サポートシートをAIと考える</a>で手順に沿って進められます。' +
        '27項目の正式名称と要旨は<a href="' + ROUTES.jiritsu() + '">一覧</a>にあります。</p></div>') +
      '</section>' +

      '<section class="block">' +
        '<h3 class="block-title">学びの場</h3>' + placesHtml +
      '</section>' +
      crossLinksBlock(cat.id) +
      legalBlock(cat) +
      programBlock(cat) +

      '<div class="source-box">' +
        '<p class="quote">「' + esc(cat.quote) + '」</p>' +
        '<p>出典：' + srcLink(cat.sourceId) + '</p>' +
      '</div>';

    playFadeIn();

    /* --- 支援内容タブ --- */
    var tabWrap = document.getElementById('supportTabs');
    var panel = document.getElementById('supportPanel');
    var keys = Object.keys(cat.support);
    function showTab(k) {
      tabWrap.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); });
      panel.innerHTML = '<ul>' + cat.support[k].map(function (li) { return '<li>' + esc(li) + '</li>'; }).join('') + '</ul>';
    }
    tabWrap.innerHTML = keys.map(function (k) {
      return '<button type="button" data-k="' + esc(k) + '">' + esc(supportKeyLabels[k] || k) + '</button>';
    }).join('');
    tabWrap.querySelectorAll('button').forEach(function (b) { b.onclick = function () { showTab(b.dataset.k); }; });
    showTab(keys[0]);

    /* --- 疾患アコーディオン --- */
    function measureHeight(detail) {
      var inner = detail.querySelector('.disease-detail-inner');
      return inner ? inner.scrollHeight : detail.scrollHeight;
    }
    function openDiseaseItem(item) {
      var detail = item.querySelector('.disease-detail');
      var hint = item.querySelector('.d-hint');
      item.classList.add('open');
      detail.style.maxHeight = measureHeight(detail) + 'px';
      if (hint) hint.textContent = '閉じる';
    }
    function closeDiseaseItem(item) {
      var detail = item.querySelector('.disease-detail');
      var hint = item.querySelector('.d-hint');
      detail.style.maxHeight = measureHeight(detail) + 'px'; // 現在の高さを明示してから0へ
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { detail.style.maxHeight = '0px'; });
      });
      item.classList.remove('open');
      if (hint) hint.textContent = '詳細を見る';
    }
    mainContent.querySelectorAll('.disease-item').forEach(function (item) {
      item.querySelector('.disease-row').onclick = function () {
        var willOpen = !item.classList.contains('open');
        if (willOpen) { openDiseaseItem(item); } else { closeDiseaseItem(item); }
        // 開いている疾患をURLに載せる。履歴は積まない（戻るは前の画面へ）
        var name = cat.diseases[Number(item.dataset.idx)].name;
        openDisease = willOpen ? name : null;
        // 画面は描き直さない（描き直すと位置が飛ぶ）。URLだけ差し替える
        var h = willOpen ? ROUTES.cat(cat.id, name) : ROUTES.cat(cat.id);
        if (history.replaceState) { history.replaceState(null, '', h); lastHash = h; }
        // 開いた詳細が画面の外にはみ出すなら、最小限だけ寄せる
        if (willOpen) {
          setTimeout(function () {
            var r = item.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 320);
        }
      };
    });

    if (openDiseaseName) {
      var idx = cat.diseases.findIndex(function (d) { return d.name === openDiseaseName; });
      if (idx >= 0) {
        var target = mainContent.querySelector('.disease-item[data-idx="' + idx + '"]');
        if (target) {
          openDiseaseItem(target);
          setTimeout(function () {
            var rr = target.getBoundingClientRect();
            if (rr.top < 0 || rr.top > window.innerHeight * 0.6) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 320);
        }
      }
    }
  }

  /* ---------- 自立活動 一覧 ---------- */

  function renderJiritsuTable() {
    var html = '<div class="jiritsu-table-wrap">' +
      '<div class="article-head">' +
        '<div class="article-num" style="border-radius:3px;">27</div>' +
        '<h2 class="cat-title">自立活動 6区分27項目 一覧<span class="en">Six Categories, 27 Items of Jiritsu Katsudo</span></h2>' +
      '</div>' +
      '<div class="overview">自立活動は、障害のある子供が自立を目指し、学習上又は生活上の困難を主体的に改善・克服するために設けられた特別な指導領域です。27項目すべてを一律に指導するのではなく、子供一人一人の実態に応じて必要な項目を選定し、相互に関連付けて具体的な指導内容を組み立てます。</div>' +
      '<a class="sp-entry' + (maint('support') ? ' maint-on' : '') + '" href="' + ROUTES.support() + '">' +
        '<span class="sp-entry-main"><b>自立活動サポートシートをAIと考える' + (maint('support') ? '<span class="maint-mini">整備中</span>' : '') + '</b>' +
        '<span>実態把握 → 課題の整理 → 項目の選定 → 指導内容、の手順で入力し、Copilot・Gemini に渡す指示書を作ります。項目は最後に出てきます。</span></span>' +
        '<span class="sp-entry-mark" aria-hidden="true">›</span></a>' +
      '<div class="section-disclaimer"><b>項目の選び方</b>' +
      '<p>自立活動編解説が示す手順は、実態把握 → 課題の整理 → 項目の選定 → 具体的な指導内容、の順です。' +
      '項目は目の前の子どもの実態と課題から選ぶもので、疾患や障害種から引くものではありません。この一覧は正式名称と要旨の確認用です。</p></div>' +
      '<div class="section-disclaimer"><b>項目名の表記について</b>' +
      '<p>本ツールでは画面上の読みやすさのため短縮した項目名を用いています。学習指導要領の正式名称（「〜に関すること」）は各項目に併記しました。指導計画等の書類に記載する際は正式名称をお使いください。</p></div>';

    JIRITSU27.forEach(function (group, gi) {
      html += '<div class="ku-group">' +
        '<div class="ku-heading"><span class="ku-index">' + (gi + 1) + '</span><h3>' + esc(group.ku) + '</h3></div>' +
        '<div class="table-scroll"><table class="item-table">' +
        '<thead><tr><th style="width:34px;">No.</th><th>項目</th><th>内容の要旨</th></tr></thead><tbody>';
      group.items.forEach(function (it, ii) {
        // 見出しは短縮名、その下に学習指導要領の正式名称を併記する
        var official = it.official
          ? '<span class="item-official">正式名称：' + esc(it.official) + '</span>'
          : '';
        html += '<tr><td class="item-no">(' + (ii + 1) + ')</td>' +
                '<td class="item-name"><span class="item-label">' + esc(it.name) + '</span>' + official + '</td>' +
                '<td>' + esc(it.desc) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    });

    html += '<div class="source-box">' +
      '<p>出典：' + srcLink('jiritsu-kaisetsu') + '</p>' +
      '<p style="margin-top:8px;">項目の説明は原文を要約・言い換えたものです。指導計画作成の際は原文をご確認ください。</p>' +
      '</div></div>';

    mainContent.innerHTML = html;
    playFadeIn();
  }

  /* ---------- 出典・リンク集（旧 診断名・出典） ---------- */

  function renderTerms() {
    var tm = META.termMap;

    var html = '<div class="jiritsu-table-wrap">' +
      '<div class="article-head">' +
        '<div class="article-num" style="border-radius:3px;">典</div>' +
        '<h2 class="cat-title">出典・リンク集<span class="en">Sources &amp; Links by Purpose</span></h2>' +
      '</div>' +
      '<div class="overview">目的別に公的資料を並べています。参照している資料の一覧と、診断名と教育上の区分の対応表はページの後半にあります。</div>' +
      '<nav class="lk-jump" aria-label="ページ内の移動">' +
        '<a href="javascript:void(0)" data-jump="lk-guide">目的別リンク</a>' +
        '<a href="javascript:void(0)" data-jump="termmap">診断名の対応表</a>' +
        '<a href="javascript:void(0)" data-jump="srclist">参照資料の一覧</a>' +
        '<a href="javascript:void(0)" data-jump="research">研究段階の知見</a>' +
      '</nav>' +
      linkGuideHtml() +

      '<div class="ku-group" id="termmap">' +
        '<div class="ku-heading"><span class="ku-index">1</span><h3>教育上の区分と医学的診断名の対応</h3></div>' +
        '<p class="block-sub">' + esc(tm.note) + '</p>' +
        '<div class="table-scroll"><table class="item-table">' +
        '<thead><tr><th>本ツールの見出し（学校教育法・文部科学省）</th><th>医学的診断名（DSM-5-TR ／ ICD-11）</th><th>補足</th></tr></thead><tbody>';
    tm.rows.forEach(function (r) {
      html += '<tr><td class="item-name">' + esc(r.edu) + '</td><td>' + esc(r.med) + '</td><td>' + esc(r.memo) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    /* 出典一覧：確立した資料と研究段階の知見を分けて示す */
    function sourceTable(list) {
      var t = '<div class="table-scroll"><table class="item-table">' +
        '<thead><tr><th>資料</th><th>発行</th><th>版・時点</th><th>更新方針</th></tr></thead><tbody>';
      list.forEach(function (s) {
        var name = s.url
          ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>'
          : esc(s.title);
        var extra = s.indexUrl
          ? '<br><span class="src-index">一覧：<a href="' + esc(s.indexUrl) + '" target="_blank" rel="noopener">' + esc(s.indexUrl) + '</a></span>'
          : '';
        var note = s.note ? '<br><span class="src-note">' + esc(s.note) + '</span>' : '';
        var policy = s.policy === 'latest'
          ? '<span class="policy-tag latest">常に最新を参照' + (s.review ? '／' + esc(s.review) + '見直し' : '') + '</span>'
          : '<span class="policy-tag pinned">特定版の固定引用</span>';
        t += '<tr><td class="item-name">' + name + extra + note + '</td>' +
             '<td>' + esc(s.publisher || '—') + '</td>' +
             '<td>' + esc(s.edition || '—') + '</td>' +
             '<td>' + policy + '<br><span class="src-note">確認 ' + esc(s.checked) + '</span></td></tr>';
      });
      return t + '</tbody></table></div>';
    }

    var established = SOURCES.filter(function (s) { return s.tier !== 'research'; });
    var research = SOURCES.filter(function (s) { return s.tier === 'research'; });

    html += '<div class="ku-group" id="srclist">' +
      '<div class="ku-heading"><span class="ku-index">2</span><h3>参照資料の一覧（一次資料・公的データベース・学会等）</h3></div>' +
      sourceTable(established) + '</div>';

    html += '<div class="ku-group" id="research">' +
      '<div class="ku-heading"><span class="ku-index">3</span><h3>研究段階の知見</h3></div>' +
      '<div class="section-disclaimer"><b>診断・指導の基準ではありません</b>' +
      '<p>以下は個別の研究発表です。DSM-5-TR／ICD-11 のような確立した診断分類とは位置づけが異なります。本ツールの記述の背景として挙げているもので、就学相談や指導計画の根拠として用いるものではありません。</p></div>' +
      sourceTable(research) + '</div>';

    html += '<div class="source-box"><p>' + esc(META.disclaimer.long) + '</p></div></div>';

    mainContent.innerHTML = html;
    playFadeIn();
    mainContent.querySelectorAll('[data-jump]').forEach(function (a) {
      a.addEventListener('click', function () {
        var el = document.getElementById(a.getAttribute('data-jump'));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---------- 目的別リンク集 ---------- */

  // 「○○についてはここから」。行を大きく、押しやすく。
  // 資料の URL は sources.json から引く。route は本ツール内のページ、anchor はこのページ内。
  function linkGuideHtml() {
    if (maint('links')) return '<div class="lk-guide" id="lk-guide">' + maintCover(maint('links')) + '</div>';
    if (!LINKS.length) return '';
    var html = '<div class="lk-guide" id="lk-guide">';
    LINKS.forEach(function (g) {
      html += '<section class="lk-group">' +
        '<h3 class="lk-title">' + esc(g.title) + '</h3>' +
        (g.lead ? '<p class="lk-lead">' + esc(g.lead) + '</p>' : '') +
        '<div class="lk-list">';
      g.items.forEach(function (it) {
        var s = it.sourceId ? SRC[it.sourceId] : null;
        if (it.sourceId && !s) return;
        var label, sub, href, ext = false, cls = 'lk-row';
        if (s) {
          label = it.label || s.title;
          sub = [s.publisher, s.edition].filter(Boolean).join('　');
          href = s.url; ext = !!s.url;
          if (!s.url) cls += ' nolink';
        } else if (it.route) {
          label = it.label; sub = '本ツール内'; href = it.route; cls += ' internal';
        } else {
          label = it.label; sub = 'このページ内'; href = 'javascript:void(0)'; cls += ' internal';
        }
        html += '<a class="' + cls + '"' +
          (href ? ' href="' + esc(href) + '"' : '') +
          (ext ? ' target="_blank" rel="noopener"' : '') +
          (it.anchor ? ' data-jump="' + esc(it.anchor) + '"' : '') + '>' +
          '<span class="lk-main"><span class="lk-label">' + esc(label) + '</span>' +
            (sub ? '<span class="lk-sub">' + esc(sub) + '</span>' : '') + '</span>' +
          (it.note ? '<span class="lk-note">' + esc(it.note) + '</span>' : '') +
          '<span class="lk-mark" aria-hidden="true">' + (ext ? '↗' : '›') + '</span>' +
          '</a>';
      });
      html += '</div></section>';
    });
    return html + '</div>';
  }

  /* ---------- 自立活動サポートシート（AIと考える） ---------- */

  // 解説の流れ図に沿って ①〜④ を教員が書き、⑤〜⑦ を AI と考えるための指示書を作る。
  // AI の役割は「書く人」ではなく「問い返す人」。入力はこのページの中だけで組み立て、保存も送信もしない。

  var SP_KU_HINT = {
    '健康の保持': '生活リズム、体調、病気の理解と自己管理、身体の状態、運動量',
    '心理的な安定': '情緒の安定、状況の変化への対応、困難を改善しようとする意欲',
    '人間関係の形成': '他者との関わり、意図や感情の理解、自己理解と行動の調整、集団への参加',
    '環境の把握': '感覚の活用、感覚や認知の特性、感覚の補助・代行手段、周囲の状況の把握、概念の形成',
    '身体の動き': '姿勢と運動・動作、基本動作、日常生活に必要な動作、身体の移動、作業に必要な動作',
    'コミュニケーション': '基礎的な能力、言語の受容と表出、言語の形成と活用、手段の選択と活用、状況に応じたコミュニケーション'
  };

  var SP = null;  // 入力の状態（ページ内のみ）
  function spBlank() {
    var byKu = {};
    JIRITSU27.forEach(function (g) { byKu[g.ku] = ''; });
    return {
      seed: '',
      stage: '', disability: '',
      status: '', development: '', interest: '', environment: '',
      byKu: byKu,
      issues: '', relations: '',
      central: '', goal: '',
      ask: ''
    };
  }

  function spItemsText(withDesc) {
    return JIRITSU27.map(function (g, gi) {
      return (gi + 1) + ' ' + g.ku + '\n' + g.items.map(function (it, ii) {
        return '  (' + (ii + 1) + ') ' + it.official + (withDesc && it.desc ? '：' + it.desc : '');
      }).join('\n');
    }).join('\n');
  }

  // 詳しい欄に何か書いてあるか
  function spHasAdvanced(d) {
    if (d.status || d.development || d.interest || d.environment || d.issues || d.relations || d.central || d.goal) return true;
    return JIRITSU27.some(function (g) { return !!d.byKu[g.ku]; });
  }
  function spInputBlock(d) {
    var lines = [];
    lines.push('今、困っていること：' + (d.seed || '（未記入）'));
    if (d.stage) lines.push('校種・学年：' + d.stage);
    if (d.disability) lines.push('主たる障害・状態：' + d.disability);
    if (spHasAdvanced(d)) {
      lines.push('');
      lines.push('既に分かっていること（書けたところだけ。ここに書いてあることは聞き直さなくてよい）');
      if (d.status) lines.push('・①障害の状態：' + d.status);
      if (d.development) lines.push('・①発達や経験の程度：' + d.development);
      if (d.interest) lines.push('・①興味・関心、得意なこと：' + d.interest);
      if (d.environment) lines.push('・①生活や学習の環境：' + d.environment);
      JIRITSU27.forEach(function (g) { if (d.byKu[g.ku]) lines.push('・②' + g.ku + '：' + d.byKu[g.ku]); });
      if (d.issues) lines.push('・③指導すべき課題：' + d.issues.replace(/\n+/g, '／'));
      if (d.relations) lines.push('・③課題同士の関係：' + d.relations);
      if (d.central) lines.push('・④中心となる課題：' + d.central);
      if (d.goal) lines.push('・④指導目標：' + d.goal);
    }
    if (d.ask) { lines.push(''); lines.push('特に相談したいこと：' + d.ask); }
    return lines.join('\n');
  }

  function buildSupportPrompt(target, d) {
    var full = target === 'gemini';
    var rules = [
      '児童生徒の氏名は扱いません。「本児」と呼びます。私が氏名を書いていたら指摘し、以後は本児と呼び替えてください。',
      '手順は ①実態把握 → ②実態の整理（6区分の観点）→ ③指導すべき課題の整理 → ④中心となる課題と指導目標 → ⑤項目の選定 → ⑥項目の関連付け → ⑦具体的な指導内容 の順です。私は「今、困っていること」だけを書きました。①から④までは、あなたが質問して私から聞き出してください。',
      '質問は1回に1つだけ。私の答えを短く要約して「こういうことですね」と確認してから、次の質問に進んでください。①は4つの観点（障害の状態／発達や経験の程度／興味・関心、得意なこと／生活や学習の環境）を、②は6区分の観点のうち関係しそうなものだけを聞いてください。全部で5〜8往復を目安にし、細かく聞きすぎないでください。',
      '私が「分からない」「まだ見ていない」と答えたら、そこで止めずに次へ進み、最後に「確認すべき点」として残してください。分からないことを推測で埋めないでください。',
      '④の指導目標まで揃ってから⑤に進んでください。課題（③）がどの実態（①②）から出ているか分からないものは、そのまま通さないでください。',
      '項目は、末尾の「自立活動 6区分27項目」の正式名称だけを使ってください。項目名を創作したり、言い換えたりしないでください。',
      '候補を挙げるときは、選んだ理由と、有力だが選ばなかった項目とその理由も書いてください。',
      '出力の各行に「根拠」（どの実態・どの課題から導いたか）を付けてください。私の入力にない前提を置くときは「仮定」と明示してください。',
      '断定しないでください。最終判断は私（教員）と校内の検討で行います。医学的な診断や治療の判断はしないでください。'
    ];
    var out = [];
    out.push('あなたは特別支援教育で自立活動を担当する教員の同僚として、「自立活動サポートシート」の作成を手伝ってください。' +
      'あなたの役割は、シートを代わりに書くことではなく、問い返しながら一緒に考えることです。');
    out.push('');
    out.push('【守ること】');
    rules.forEach(function (r, i) { out.push((i + 1) + '. ' + r); });
    out.push('');
    out.push('【本児について（私の入力）】');
    out.push(spInputBlock(d));
    out.push('');
    out.push('【お願いすること】');
    out.push('まず「今、困っていること」を受け止めて、①実態把握の最初の質問を1つだけしてください。私が答えたら要約して確認し、次の質問へ。④の指導目標まで揃ったら、そこまでを一度まとめて見せてください。');
    out.push('私が「それでいい」と言ったら、次の形式でシート（案）を出してください。');
    out.push('・⑤ 選定した項目（正式名称）｜区分｜選んだ理由｜根拠');
    out.push('・⑤′ 検討したが選ばなかった項目｜理由');
    out.push('・⑥ 項目の関連付け：選んだ項目同士をどう結び付けて指導するか｜根拠');
    out.push('・⑦ 具体的な指導内容（2〜3案）｜ねらい｜関連する項目｜根拠｜評価の観点');
    out.push('・最後に「教員が確認すべき点」を箇条書きで。私が「分からない」と答えた事項は必ずここに入れてください。');
    out.push('・シートの冒頭に、聞き取りで分かった①〜④の要約も付けてください（校内の検討で使います）。');
    out.push('');
    out.push('【自立活動 6区分27項目（' + (full ? '正式名称と要旨' : '正式名称') + '）】');
    out.push('出典：特別支援学校教育要領・学習指導要領解説 自立活動編（平成30年3月）');
    out.push(spItemsText(full));
    return out.join('\n');
  }

  function spField(id, label, hint, rows) {
    return '<label class="sp-field"><span class="sp-label">' + esc(label) +
      (hint ? '<span class="sp-hint">' + esc(hint) + '</span>' : '') + '</span>' +
      '<textarea data-sp="' + esc(id) + '" rows="' + (rows || 2) + '"></textarea></label>';
  }

  function renderSupport() {
    if (!SP) SP = spBlank();
    var d = SP;

    var kuFields = JIRITSU27.map(function (g) {
      return spField('ku:' + g.ku, g.ku, SP_KU_HINT[g.ku] || '', 2);
    }).join('');

    var html = '<div class="jiritsu-table-wrap sp-view">' +
      '<p class="crumb"><a href="' + ROUTES.jiritsu() + '">自立活動 6区分27項目 一覧</a> › 自立活動サポートシート</p>' +
      '<div class="article-head">' +
        '<div class="article-num" style="border-radius:3px;">AI</div>' +
        '<h2 class="cat-title">自立活動サポートシートをAIと考える<span class="en">Jiritsu Katsudo Support Sheet with AI</span></h2>' +
      '</div>' +
      '<div class="overview">「今、困っていること」を一言書くところから始めます。そこから先の実態把握・課題の整理・指導目標は、Copilot または Gemini が自立活動編解説の手順に沿って1つずつ質問して聞き出し、揃ったところで項目の選定・関連付け・指導内容の案を根拠付きで出します。' +
        'AIの役割は「書く人」ではなく「聞き取り、問い返す人」です。</div>' +
      '<div class="section-disclaimer"><b>氏名を書かないでください</b>' +
        '<p>「本児」「生徒A」で書きます。入力はこのページの中だけで組み立て、どこにも送信・保存しません。ページを離れると消えます。' +
        'AIに貼るのは先生自身です。校内で許可されたAI（学校アカウントの Copilot など）を使ってください。</p></div>' +

      '<form class="sp-form" id="spForm" autocomplete="off">' +

      '<section class="block sp-step"><h3 class="block-title"><span class="sp-num">1</span>今、困っていることを書く</h3>' +
        '<p class="block-sub">1〜3行でかまいません。ここから先の実態把握と課題の整理は、AIが1つずつ質問して聞き出します。書けない欄を埋める必要はありません。</p>' +
        spField('seed', '今、困っていること', '例：授業中に急に立ち歩く。注意すると余計に興奮する。どこから手を付けていいか分からない', 3) +
        '<div class="sp-two">' +
          '<label class="sp-field"><span class="sp-label">校種・学年（任意）</span><input type="text" data-sp="stage" placeholder="例：中学部2年"></label>' +
          '<label class="sp-field"><span class="sp-label">主たる障害・状態（任意）<span class="sp-hint">診断名の細部は不要</span></span><input type="text" data-sp="disability" placeholder="例：知的障害を伴う自閉症"></label>' +
        '</div>' +
        spField('ask', '特に相談したいこと（任意）', '迷っている点、校内で意見が分かれている点など', 2) +
      '</section>' +

      '<details class="sp-adv"><summary>書けるところまで書いておく（任意）<span class="sp-hint">書いてある欄はAIが聞き直しません。空欄のままでかまいません</span></summary>' +

      '<section class="block sp-step"><h3 class="block-title"><span class="sp-num">①</span>実態把握</h3>' +
        spField('status', '障害の状態', '見え方、聞こえ方、身体の動き、理解の仕方など', 2) +
        spField('development', '発達や経験の程度', 'できていること、これまでの学習・生活経験', 2) +
        spField('interest', '興味・関心、得意なこと', '', 2) +
        spField('environment', '生活や学習の環境', '家庭、学級、学びの場、支援者、補助手段', 2) +
      '</section>' +

      '<section class="block sp-step"><h3 class="block-title"><span class="sp-num">②</span>実態を6区分の観点で整理する</h3>' +
        kuFields +
      '</section>' +

      '<section class="block sp-step"><h3 class="block-title"><span class="sp-num">③</span>指導すべき課題を整理する</h3>' +
        spField('issues', '課題（1行に1つ）', '', 3) +
        spField('relations', '課題同士の関係', '原因と結果、どれが先か', 2) +
      '</section>' +

      '<section class="block sp-step"><h3 class="block-title"><span class="sp-num">④</span>中心となる課題と指導目標</h3>' +
        spField('central', '中心となる課題', '', 2) +
        spField('goal', '指導目標（この期間で目指すこと）', '評価できる形で', 2) +
      '</section>' +

      '</details>' +

      '</form>' +

      '<section class="block"><h3 class="block-title"><span class="sp-num">2</span>指示書をコピーしてAIに貼る</h3>' +
        '<p class="block-sub">AIは「今、困っていること」を受け止めて質問を1つ返します。1つずつ答えていくと（目安5〜8往復）、実態把握から指導目標までがまとまり、そのあと項目の選定・関連付け・指導内容の案が根拠付きで出ます。分からないことは「分からない」でかまいません。</p>' +
        '<div class="support-tabs sp-tabs">' +
          '<button type="button" class="on" data-target="copilot">Copilot 用（短め）</button>' +
          '<button type="button" data-target="gemini">Gemini 用（要旨付き）</button>' +
        '</div>' +
        '<div class="sp-actions">' +
          '<button type="button" class="sp-btn primary" id="spCopy">指示書をコピー</button>' +
          '<button type="button" class="sp-btn danger" id="spReset">入力を消す</button>' +
          '<span class="sp-copied" id="spCopied" aria-live="polite"></span>' +
        '</div>' +
        '<textarea class="sp-out" id="spOut" readonly rows="18"></textarea>' +
      '</section>' +

      '<div class="source-box">' +
        '<p>手順と観点は次に基づきます。<br>' + srcLink('jiritsu-kaisetsu') + '</p>' +
        '<p style="margin-top:8px;">AIの出力は案です。根拠欄が「仮定」になっている行、AIが「教員が確認すべき点」に挙げた点は、校内の検討で必ず確かめてください。</p>' +
      '</div>' +
      '</div>';

    mainContent.innerHTML = html;
    playFadeIn();

    var target = 'copilot';
    var out = document.getElementById('spOut');

    function readForm() {
      mainContent.querySelectorAll('[data-sp]').forEach(function (el) {
        var k = el.getAttribute('data-sp');
        if (k.indexOf('ku:') === 0) d.byKu[k.slice(3)] = el.value.trim();
        else d[k] = el.value.trim();
      });
    }
    function fillForm() {
      mainContent.querySelectorAll('[data-sp]').forEach(function (el) {
        var k = el.getAttribute('data-sp');
        el.value = k.indexOf('ku:') === 0 ? (d.byKu[k.slice(3)] || '') : (d[k] || '');
      });
    }
    function refresh() {
      readForm();
      out.value = buildSupportPrompt(target, d);
    }
    fillForm();
    refresh();

    mainContent.querySelectorAll('[data-sp]').forEach(function (el) {
      el.addEventListener('input', refresh);
    });
    mainContent.querySelectorAll('.sp-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        mainContent.querySelectorAll('.sp-tabs button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        target = b.getAttribute('data-target');
        refresh();
      });
    });
    document.getElementById('spCopy').addEventListener('click', function () {
      refresh();
      var note = document.getElementById('spCopied');
      function done(ok) { note.textContent = ok ? 'コピーしました。AIに貼ってください。' : 'コピーできませんでした。指示書を選択して手動でコピーしてください。'; setTimeout(function () { note.textContent = ''; }, 4000); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(out.value).then(function () { done(true); }, function () { done(false); });
      } else {
        out.select(); try { done(document.execCommand('copy')); } catch (e) { done(false); }
      }
    });
    document.getElementById('spReset').addEventListener('click', function () {
      if (!window.confirm('入力をすべて消します。よろしいですか。')) return;
      SP = d = spBlank();
      fillForm(); refresh();
    });
  }

  /* ---------- 障害種別 → 主題 の逆引き（指導提要側・特別の教育課程側が持つ related を逆から引く） ---------- */

  function crossLinksBlock(catId) {
    var groups = [];
    ['seito', 'curriculum'].forEach(function (key) {
      if (maint(key)) return;  // 覆っている冊へは案内しない
      var t = TOPICS[key];
      var hits = [];
      t.items.forEach(function (h) {
        (h.related || []).forEach(function (r) { if (r.catId === catId) hits.push({ item: h, note: r.note }); });
      });
      if (hits.length) groups.push({ t: t, hits: hits });
    });
    if (!groups.length) return '';
    var html = '<section class="block">' +
      '<h3 class="block-title">関連する生徒指導上の課題・特別の教育課程<span class="tally">この障害種を挙げている項目</span></h3>' +
      '<p class="block-sub">それぞれの項目が「関連する障害種別」としてこの障害種を挙げています。見立てを分ける、または重なりを確認するときに参照してください。</p>';
    groups.forEach(function (g) {
      html += '<p class="hk-cross-book">' + esc(BOOKS[g.t.book].title) + '／' + esc(g.t.title) + '</p><div class="hk-rel">' +
        g.hits.map(function (x) {
          return '<a class="hk-rel-card" href="' + ROUTES.topic(g.t.key, x.item.id) + '">' +
            '<span class="num">' + esc(x.item.chapter || x.item.num) + '</span><b>' + esc(x.item.name) + '</b><span>' + esc(x.note) + '</span></a>';
        }).join('') + '</div>';
    });
    return html + '</section>';
  }

  /* ---------- 主題のタブ（特別の教育課程／生徒指導上の課題） ---------- */


  // 区分（DATA）とは別の型。自立活動27項目との対応は持たず、
  // 「関連する障害種別」で既存区分へ内部リンクする。

  function hkStatusTag(h) {
    var st = h.status || {};
    return '<span class="basis-tag tone-' + esc(st.tone || 'info') + '">' + esc(st.label || '') + '</span>';
  }

  function hkSourceRef(id) {
    var s = SRC[id];
    if (!s) return '';
    var name = esc(s.title) + (s.edition ? '（' + esc(s.edition) + '）' : '');
    return '<li>' + (s.url
      ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + name + '</a>'
      : name) +
      '<span class="basis-pub">' + esc(s.publisher || '') + '</span></li>';
  }

  function renderTopicIndex(t) {
    var html = '<div class="jiritsu-table-wrap hk-view">' +
      '<div class="article-head">' +
        '<div class="article-num" style="border-radius:3px;">' + esc(t.mark) + '</div>' +
        '<h2 class="cat-title">' + esc(t.title) + '<span class="en">' + esc(t.en) + '</span></h2>' +
      '</div>' +
      '<div class="overview">' + esc(t.intro) + '</div>' +
      '<div class="section-disclaimer"><b>' + esc(t.noteHead) + '</b><p>' + esc(t.note) + '</p></div>' +
      '<div class="hk-grid">';

    t.items.forEach(function (h) {
      html += '<a class="hk-card" href="' + ROUTES.topic(t.key, h.id) + '">' +
        '<span class="num">' + esc(h.chapter || h.num) + '</span>' +
        '<h4>' + esc(h.name) + '</h4>' +
        '<p>' + esc(h.subtitle) + '</p>' +
        '<div class="hk-card-foot">' + hkStatusTag(h) + '</div>' +
        '</a>';
    });
    html += '</div>';

    html += '<div class="source-box"><p>' + esc(t.foot) + ' 各項目の末尾に出典を示しています。</p></div></div>';

    mainContent.innerHTML = html;
    playFadeIn();
  }

  function renderTopicItem(t, h) {
    var st = h.status || {};

    var basisHtml = (h.basis || []).map(function (b) {
      var s = b.sourceId ? SRC[b.sourceId] : null;
      var ref = s
        ? ' <span class="hk-ref">' + (s.url
            ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>'
            : esc(s.title)) + (s.edition ? '（' + esc(s.edition) + '）' : '') + '</span>'
        : '';
      return '<li>' + esc(b.text) + ref + '</li>';
    }).join('');

    var pointsHtml = (h.points || []).map(function (p, i) {
      return '<li><span class="hk-pt-n">' + (i + 1) + '</span><span>' + esc(p) + '</span></li>';
    }).join('');

    var frameworkHtml = '';
    if (h.framework) {
      frameworkHtml = '<section class="block">' +
        '<h3 class="block-title">' + esc(h.framework.title) + '<span class="tally">検討中</span></h3>' +
        (h.framework.intro ? '<p class="block-sub">' + esc(h.framework.intro) + '</p>' : '') +
        '<dl class="hk-dl">' + h.framework.items.map(function (it) {
          return '<div class="hk-dl-row"><dt>' + esc(it.k) + '</dt><dd>' + esc(it.v) + '</dd></div>';
        }).join('') + '</dl></section>';
    }

    var signsHtml = '<section class="block">' +
      '<h3 class="block-title">' + esc(h.signsLabel) + '<span class="tally">' + h.signs.length + '項目</span></h3>' +
      (h.signsNote ? '<p class="block-sub">' + esc(h.signsNote) + '</p>' : '') +
      '<ul class="hk-list">' + h.signs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '</section>';

    var supportsHtml = '<section class="block">' +
      '<h3 class="block-title">' + esc(h.supportsLabel) + '</h3>' +
      '<div class="hk-groups">' + h.supports.map(function (g) {
        return '<div class="hk-group"><h4>' + esc(g.title) + '</h4>' +
          '<ul class="hk-list">' + g.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + '</div></section>';

    var planningHtml = '';
    if (h.planning) {
      planningHtml = '<section class="block">' +
        '<h3 class="block-title">' + esc(h.planningLabel) + '</h3>' +
        '<ul class="hk-list">' + h.planning.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '</section>';
    } else {
      planningHtml = '<section class="block">' +
        '<h3 class="block-title">計画への落とし込み<span class="tally">対象外</span></h3>' +
        '<div class="section-disclaimer"><b>この項目は個別の指導計画の対象ではありません</b>' +
        '<p>指導ではなく、気づいて関係機関につなぐことが学校の役割です。校内での情報共有と経過の記録は上の要点に沿って行い、計画の様式には載せません。</p></div>' +
        '</section>';
    }

    var jiritsuLine = (t.key === 'seito')
      ? '<div class="section-disclaimer"><b>障害のある児童生徒がこの課題に直面している場合の自立活動</b>' +
        '<p>自立活動の目標は、この課題名から項目を引くのではなく、<a href="' + ROUTES.support() + '">サポートシート</a>の手順（実態把握 → 課題の整理 → 項目の選定）で決めます。' +
        'この課題を①実態把握と③指導すべき課題に書き込むところから始めてください。</p></div>'
      : '';
    var relatedHtml = jiritsuLine + '<section class="block">' +
      '<h3 class="block-title">関連する障害種別<span class="tally">特別支援ガイドブックへ</span></h3>' +
      '<p class="block-sub">見立てを分ける、または重なりを確認するときに参照する区分です。</p>' +
      '<div class="hk-rel">' + (h.related || []).map(function (r) {
        var c = DATA.find(function (x) { return x.id === r.catId; });
        if (!c) return '';
        return '<a class="hk-rel-card" href="' + ROUTES.cat(c.id) + '">' +
          '<span class="num">' + esc(c.num) + '</span><b>' + esc(c.name) + '</b><span>' + esc(r.note) + '</span></a>';
      }).join('') + '</div>' +
      (h.relatedNote ? '<p class="hk-rel-note">' + esc(h.relatedNote) + '</p>' : '') +
      '</section>';

    // 他の主題タブの項目への横リンク（不登校↔ヤングケアラー など）
    if (h.relatedTopics && h.relatedTopics.length) {
      relatedHtml += '<section class="block">' +
        '<h3 class="block-title">関連する項目<span class="tally">他の冊・タブへ</span></h3>' +
        '<div class="hk-rel">' + h.relatedTopics.map(function (r) {
          var it = topicItem(r.tab, r.id), tt = topicOf(r.tab);
          if (!it || !tt) return '';
          return '<a class="hk-rel-card" href="' + ROUTES.topic(r.tab, it.id) + '">' +
            '<span class="num">' + esc(BOOKS[tt.book].title + '／' + tt.title) + '</span><b>' + esc(it.name) + '</b><span>' + esc(r.note) + '</span></a>';
        }).join('') + '</div></section>';
    }

    var srcHtml = '<div class="source-box">' +
      '<p class="basis-label">この項目が基づく資料</p>' +
      '<ul class="basis-refs">' + (h.sources || []).map(hkSourceRef).join('') + '</ul>' +
      '<p style="margin-top:10px;">出典確認 ' + esc(h.reviewed) + '。制度や資料の要旨は本ツールによる整理で、原文の言い換えを含みます。指導計画や会議の根拠にする際は原文をご確認ください。</p>' +
      feedbackLink(t.title, h.name) +
      '</div>';

    var html = '<div class="jiritsu-table-wrap hk-view">' +
      '<p class="crumb"><a href="' + ROUTES.topic(t.key) + '">' + esc(t.title) + '</a> › ' + esc(h.name) + '</p>' +
      '<div class="article-head">' +
        '<div class="article-num" style="border-radius:3px;">' + esc(h.num) + '</div>' +
        '<h2 class="cat-title">' + esc(h.name) + '<span class="en">' + esc(h.en) + '</span></h2>' +
      '</div>' +
      (h.chapter ? '<p class="hk-chapter">生徒指導提要 ' + esc(h.chapter) + '</p>' : '') +
      '<p class="hk-subtitle">' + esc(h.subtitle) + '</p>' +
      '<div class="hk-status tone-' + esc(st.tone || 'info') + '">' + hkStatusTag(h) + '<span>' + esc(st.text || '') + '</span></div>' +
      '<div class="overview">' + esc(h.overview) + '</div>' +
      '<section class="block">' +
        '<h3 class="block-title">公的な位置づけ</h3>' +
        '<ul class="hk-list hk-basis">' + basisHtml + '</ul>' +
      '</section>' +
      '<section class="block">' +
        '<h3 class="block-title">押さえておきたい点</h3>' +
        '<ol class="hk-points">' + pointsHtml + '</ol>' +
      '</section>' +
      frameworkHtml + signsHtml + supportsHtml + planningHtml + relatedHtml + srcHtml +
      '</div>';

    mainContent.innerHTML = html;
    playFadeIn();
  }

  /* ---------- フッター ---------- */

  function renderFooter() {
    var fb = META.feedback;
    siteFooter.innerHTML =
      '<p>' + esc(META.disclaimer.long) + '</p>' +
      '<p class="footer-meta">' +
        '最終更新 ' + esc(META.updated) + '（版 ' + esc(META.version) + '）／ ' +
        '収録 ' + DATA.length + '区分・' +
        DATA.reduce(function (s, c) { return s + c.diseases.length; }, 0) + '件／ ' +
        '特別の教育課程 ' + TOPICS.curriculum.items.length + '件／ 生徒指導上の課題 ' + TOPICS.seito.items.length + '件／ ' +
        '出典 ' + SOURCES.length + '件（詳細は上部タブ「出典・リンク集」）' +
      '</p>' +
      '<p class="footer-feedback"><b>' + esc(fb.label) + '</b>：' + esc(fb.note) +
        ' <a href="' + esc(fb.url) + '" target="_blank" rel="noopener">' + esc(fb.url) + '</a></p>';
  }

  /* ---------- ホーム画面追加の案内 ---------- */

  function installBanner() {
    try {
      var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;
      if (standalone || localStorage.getItem('installBannerDismissed') === '1') return;
      var ua = navigator.userAgent;
      var isIOS = /iPhone|iPad|iPod/.test(ua);
      var isAndroid = /Android/.test(ua);
      if (!isIOS && !isAndroid) return;
      var banner = document.getElementById('installBanner');
      document.getElementById('installText').textContent = isIOS
        ? '画面下部の共有ボタン（□に↑）から「ホーム画面に追加」でアプリのように使えます'
        : 'ブラウザメニュー（⋮）から「ホーム画面に追加」または「アプリをインストール」でアプリのように使えます';
      banner.style.display = 'flex';
      document.getElementById('installClose').onclick = function () {
        banner.style.display = 'none';
        try { localStorage.setItem('installBannerDismissed', '1'); } catch (e) {}
      };
    } catch (e) { /* localStorage等が使えない環境では何もしない */ }
  }

  /* ---------- 起動 ---------- */

  function bindDom() {
    catList = document.getElementById('catList');
    mainContent = document.getElementById('mainContent');
    searchBox = document.getElementById('searchBox');
    sideNav = document.getElementById('sideNav');
    tabGuide = document.getElementById('tabGuide');
    tabCurriculum = document.getElementById('tabCurriculum');
    bookTokushi = document.getElementById('bookTokushi');
    bookTeiyo = document.getElementById('bookTeiyo');
    tabSeito = document.getElementById('tabSeito');
    tabJiritsu = document.getElementById('tabJiritsu');
    tabTerms = document.getElementById('tabTerms');
    layoutRoot = document.getElementById('layoutRoot');
    homeBtn = document.getElementById('homeBtn');
    homeLink = document.getElementById('homeLink');
    homeEmblem = document.getElementById('homeEmblem');
    siteFooter = document.getElementById('siteFooter');

    // ホームへ戻る操作は3か所。いずれも button 要素なので、
    // Enter / Space の処理はブラウザに任せられる。
    homeBtn.onclick = goHome;
    homeLink.onclick = goHome;
    if (homeEmblem) homeEmblem.onclick = goHome;
    tabGuide.onclick = function () { setMode('guide'); };
    tabCurriculum.onclick = function () { setMode('curriculum'); };
    bookTokushi.onclick = function () { navigate(BOOKS.tokushi.home); };
    bookTeiyo.onclick = function () { navigate(BOOKS.teiyo.home); };
    tabSeito.onclick = function () { setMode('seito'); };
    tabJiritsu.onclick = function () { setMode('jiritsu'); };
    tabTerms.onclick = function () { setMode('terms'); };

    // 検索は打つたびにURLを積むと戻るボタンが使い物にならないので、
    // 表示だけ即座に更新し、URLは打ち終わってから置き換える。
    var searchTimer = null;
    searchBox.addEventListener('input', function () {
      renderIndex(searchBox.value);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var q = searchBox.value.trim();
        navigate(q ? ROUTES.search(q) : ROUTES.home(), true);
      }, 600);
    });
  }

  function boot(bundle) {
    META = bundle.meta;
    SOURCES = bundle.sources;
    JIRITSU27 = bundle.jiritsu27;
    DATA = bundle.categories;
    TOPICS.curriculum.items = bundle.curriculum || [];
    TOPICS.seito.items = bundle.seito || [];
    LINKS = bundle.links || [];
    SOURCES.forEach(function (s) { SRC[s.id] = s; });

    bindDom();
    initPreview();
    // 整備中のタブに印を付ける
    [['curriculum', tabCurriculum], ['seito', tabSeito]].forEach(function (pair) {
      if (maint(pair[0])) pair[1].insertAdjacentHTML('beforeend', '<span class="maint-mini">整備中</span>');
    });
    renderFooter();
    installBanner();

    // 戻る／進む、URL直打ち、リンク経由のいずれもここで拾う
    window.addEventListener('hashchange', function () {
      var prev = lastHash, next = location.hash || '#/';
      scrollMemo[prev] = window.scrollY;   // 離れる画面の位置を覚える（戻る用）
      applyRoute();
      lastHash = next;
      afterRouteScroll(prev, next);
    });
    applyRoute();
  }

  function fail(err) {
    console.error(err);
    var main = document.getElementById('mainContent');
    if (main) {
      main.innerHTML = '<div class="section-disclaimer"><b>データを読み込めませんでした</b>' +
        '<p>通信状況をご確認のうえ、ページを再読み込みしてください。' +
        'ローカルのファイルを直接開いた場合は、<code>python3 -m http.server</code> などのローカルサーバー経由で開いてください。</p></div>';
    }
  }

  function loadJson(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
      return r.json();
    });
  }

  function start() {
    // 結合ビルド（tokushi-guidebook-standalone.html）ではデータが埋め込み済み
    if (window.__BUNDLE__) { boot(window.__BUNDLE__); return; }

    Promise.all([
      loadJson('meta.json'),
      loadJson('sources.json'),
      loadJson('jiritsu27.json'),
      loadJson('categories.json'),
      loadJson('curriculum.json'),
      loadJson('seito.json'),
      loadJson('links.json')
    ]).then(function (r) {
      var meta = r[0], sources = r[1], jiritsu27 = r[2], categories = r[3], curriculum = r[4], seito = r[5], links = r[6];
      return Promise.all(categories.map(function (c) {
        return loadJson(c.id + '.json').then(function (ds) {
          c.diseases = ds;
          return c;
        });
      })).then(function (cats) {
        boot({ meta: meta, sources: sources, jiritsu27: jiritsu27, categories: cats, curriculum: curriculum, seito: seito, links: links });
      });
    }).catch(fail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
