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
  var SRC = {};   // id -> source
  var REV = {};    // 「区分／項目」-> [{cat, disease}]  自立活動からの逆引き

  function srcLink(id) {
    var s = SRC[id];
    if (!s) return '';
    var title = esc(s.title) + (s.edition ? '（' + esc(s.edition) + '）' : '');
    if (!s.url) return title;
    return title + '<br><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a>';
  }

  /* ---------- DOM 参照 ---------- */

  var catList, mainContent, searchBox, sideNav,
      tabGuide, tabJiritsu, tabTerms, layoutRoot, homeBtn, homeLink, homeEmblem, siteFooter;

  var currentId = null;
  var mode = 'guide'; // 'guide' | 'jiritsu' | 'terms'
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
    kumoku:  function (ku, item) {
      return '#/jiritsu/' + encodeURIComponent(ku) + '/' + encodeURIComponent(item);
    },
    terms:   function () { return '#/terms'; }
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
      case 'jiritsu': return seg[1]
        ? { view: 'kumoku', ku: seg[1], item: seg[2] }
        : { view: 'jiritsu' };
      case 'terms':   return { view: 'terms' };
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
      location.hash = hash;   // hashchange が発火して applyRoute が走る
    }
  }

  function setTabs(m) {
    tabGuide.classList.toggle('on', m === 'guide');
    tabJiritsu.classList.toggle('on', m === 'jiritsu');
    tabTerms.classList.toggle('on', m === 'terms');
  }

  function applyRoute() {
    if (routing) return;
    routing = true;
    try {
      var r = parseHash();
      mode = (r.view === 'jiritsu' || r.view === 'kumoku') ? 'jiritsu'
           : r.view === 'terms' ? 'terms'
           : 'guide';
      setTabs(mode);

      var wide = (mode !== 'guide');
      sideNav.style.display = wide ? 'none' : '';
      layoutRoot.classList.toggle('wide', wide);

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
      } else if (r.view === 'kumoku') {
        renderKumoku(r.ku, r.item);
      } else if (r.view === 'terms') {
        renderTerms();
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
    if (r.view === 'kumoku') return r.item + '｜自立活動から探す｜' + base;
    if (r.view === 'terms') return '診断名・出典｜' + base;
    return base;
  }

  function goHome() { navigate(ROUTES.home()); }
  function setMode(m) {
    navigate(m === 'guide' ? ROUTES.home()
           : m === 'jiritsu' ? ROUTES.jiritsu()
           : ROUTES.terms());
  }

  /* ---------- 検索 ---------- */

  var HIT_LABEL = {
    name: '病名', overview: '説明', support: '支援内容',
    severity: '程度別', jiritsu: '自立活動'
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
    for (i = 0; i < (d.jiritsu || []).length; i++) {
      if ((d.jiritsu[i].ku + d.jiritsu[i].item).toLowerCase().indexOf(f) >= 0) return 'jiritsu';
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
      '<p>' + DATA.length + 'の障害種別・状態について、原因となる病気・状態別の分類、教育的ニーズ、合理的配慮を含む必要な支援内容、自立活動、学びの場を整理しています。左の索引または下の一覧から選んでください。</p>' +
      '<div class="home-stats">' +
        '<div class="home-stat"><b>' + DATA.length + '</b><span>障害種別・状態</span></div>' +
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

    html += '</div><div class="disclaimer">' + esc(META.disclaimer.long) + '</div></div>';

    mainContent.innerHTML = html;
    playFadeIn();
    mainContent.querySelectorAll('.home-card').forEach(function (el) {
      el.onclick = function () { navigate(ROUTES.cat(el.dataset.id)); };
    });
  }

  /* ---------- 出典区分バッジ ---------- */

  function basisBadges(d) {
    var b = d.basis;
    if (!b) return '';

    var ov = META.basisLabels.overview[b.overview];
    var sp = META.basisLabels.support[b.support];
    var tags = [];
    if (ov) tags.push('<span class="basis-tag tone-' + esc(ov.tone) + '">' + esc(ov.label) + '</span>');
    if (sp) tags.push('<span class="basis-tag tone-' + esc(sp.tone) + '">' + esc(sp.label) + '</span>');
    if (!tags.length) return '';

    // どの資料に基づくのかを、資料名と（あれば）URLで示す
    var refs = (b.sources || []).map(function (id) {
      var s = SRC[id];
      if (!s) return '';
      var name = esc(s.title) + (s.edition ? '（' + esc(s.edition) + '）' : '');
      return s.url
        ? '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + name + '</a>' +
          '<span class="basis-pub">' + esc(s.publisher || '') + '</span></li>'
        : '<li>' + name + '<span class="basis-pub">' + esc(s.publisher || '') + '</span></li>';
    }).filter(Boolean);

    var body = '';
    if (refs.length) {
      body += '<p class="basis-label">この項目の医学的説明が基づく資料</p>' +
              '<ul class="basis-refs">' + refs.join('') + '</ul>';
    }
    if (b.evidence) {
      var isUrl = /^https?:\/\//.test(b.evidence);
      body += '<p class="basis-evidence">' + (isUrl
        ? '該当ページ：<a href="' + esc(b.evidence) + '" target="_blank" rel="noopener">' + esc(b.evidence) + '</a>'
        : esc(b.evidence)) + '</p>';
    }

    return '<div class="basis-row">' + tags.join('') + '</div>' +
           (body ? '<div class="basis-detail">' + body + '</div>' : '');
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

    var jiritsuHtml = cat.jiritsu.map(function (j) {
      return '<div class="jiritsu-row"><span class="ku-tag">' + esc(j.ku) + '</span>' +
             '<span class="item-name">' + esc(j.item) + '</span>' +
             '<div class="j-note">' + esc(j.note) + '</div></div>';
    }).join('');

    var diseaseHtml = cat.diseases.map(function (d, i) {
      var chips = d.jiritsu.map(function (j) {
        return '<span class="jiritsu-chip"><span class="ku-mini">' + esc(j.ku) + '</span>' + esc(j.item) + '</span>';
      }).join('');

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
        '<p class="dd-label">程度別の支援</p>' + scaleBlock +
        '<div class="severity-list">' + d.severity.map(function (sv) {
          return '<div class="severity-item">' +
            '<div class="sv-level">' + esc(sv.level) + '</div>' +
            '<div class="sv-criteria">' + esc(sv.criteria) + '</div>' +
            '<ul class="sv-support">' + sv.support.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
            '</div>';
        }).join('') + '</div>'
      ) : '';

      var noteBlock = d.note
        ? '<p class="d-note"><b>編集上の注記</b>' + esc(d.note) + '</p>'
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
          '<p class="d-overview">' + esc(d.overview) + '</p>' +
          '<p class="dd-label">個別に求められる支援</p>' +
          '<ul class="dd-support">' + supportLis + '</ul>' +
          '<p class="dd-label">関連する自立活動項目</p>' +
          '<div class="dd-jiritsu">' + chips + '</div>' +
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
        '<p class="block-sub">同じ障害種でも、原因となる疾患や状態の違いによって必要な配慮は異なります。各項目をクリックすると、個別に求められる支援と関連する自立活動項目が表示されます。</p>' +
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
        '<h3 class="block-title">求められる自立活動（障害種として選定されることが多い項目）</h3>' +
        '<p class="block-sub">自立活動は27項目すべてを行うものではなく、子供一人一人の実態に応じて必要な項目を選定し関連付けて指導します。詳細な全項目は上部タブ「自立活動 6区分27項目 一覧」をご覧ください。</p>' +
        '<div class="jiritsu-list">' + jiritsuHtml + '</div>' +
      '</section>' +

      '<section class="block">' +
        '<h3 class="block-title">学びの場</h3>' + placesHtml +
      '</section>' +
      legalBlock(cat) +
      programBlock(cat) +

      '<div class="source-box">' +
        '<p class="quote">「' + esc(cat.quote) + '」</p>' +
        '<p>出典：' + srcLink(cat.sourceId) + '</p>' +
        '<p style="margin-top:10px;">自立活動の区分・項目は次に基づきます。<br>' + srcLink('jiritsu-kaisetsu') + '</p>' +
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
        navigate(willOpen ? ROUTES.cat(cat.id, name) : ROUTES.cat(cat.id), true);
      };
    });

    if (openDiseaseName) {
      var idx = cat.diseases.findIndex(function (d) { return d.name === openDiseaseName; });
      if (idx >= 0) {
        var target = mainContent.querySelector('.disease-item[data-idx="' + idx + '"]');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () { openDiseaseItem(target); }, 280);
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
        var n = (REV[group.ku + '／' + it.name] || []).length;
        html += '<tr><td class="item-no">(' + (ii + 1) + ')</td>' +
                '<td class="item-name">' +
                  '<a class="ku-link" href="' + ROUTES.kumoku(group.ku, it.name) + '">' +
                    esc(it.name) + '</a>' + official +
                '</td>' +
                '<td>' + esc(it.desc) +
                  '<a class="rev-count" href="' + ROUTES.kumoku(group.ku, it.name) + '">' +
                  'この項目を要する状態を見る（' + n + '件）</a>' +
                '</td></tr>';
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

  /* ---------- 自立活動から疾患を逆引き ---------- */

  function renderKumoku(ku, item) {
    var key = ku + '／' + item;
    var list = REV[key] || [];
    var group = JIRITSU27.find(function (g) { return g.ku === ku; });
    var def = group && group.items.find(function (x) { return x.name === item; });

    if (!def) { navigate(ROUTES.jiritsu(), true); return; }

    // 障害種ごとにまとめる
    var byCat = {};
    list.forEach(function (x) {
      (byCat[x.cat.id] = byCat[x.cat.id] || { cat: x.cat, items: [] }).items.push(x.disease);
    });

    var html = '<div class="jiritsu-table-wrap">' +
      '<p class="crumb"><a href="' + ROUTES.jiritsu() + '">← 自立活動 6区分27項目 一覧</a></p>' +
      '<div class="article-head">' +
        '<div class="article-num" style="border-radius:3px;">' + esc(ku.slice(0, 2)) + '</div>' +
        '<h2 class="cat-title">' + esc(item) +
          '<span class="en">' + esc(ku) + '</span></h2>' +
      '</div>' +
      '<div class="overview">' + esc(def.desc) + '</div>' +
      (def.official
        ? '<p class="official-line">学習指導要領の正式名称：' + esc(def.official) + '</p>' : '') +

      '<section class="block">' +
        '<h3 class="block-title">この項目を要することが多い状態' +
          '<span class="tally">' + list.length + '件</span></h3>' +
        '<p class="block-sub">自立活動は27項目すべてを行うものではなく、一人一人の実態に応じて選定します。' +
          'この一覧は「この項目を選定するとき、他にどのような背景が考えられるか」を見渡すためのものです。' +
          '掲載されている状態に当てはまるからといって、この項目を選定すべきという意味ではありません。</p>';

    if (!list.length) {
      html += '<p class="block-sub">現在この項目に紐づく状態は登録されていません。</p>';
    }

    Object.keys(byCat).forEach(function (cid) {
      var g = byCat[cid];
      html += '<div class="rev-group">' +
        '<p class="rev-cat"><a href="' + ROUTES.cat(g.cat.id) + '">' +
          '<span class="rev-num">' + esc(g.cat.num) + '</span>' + esc(g.cat.name) + '</a>' +
          '<span class="rev-n">' + g.items.length + '件</span></p>' +
        '<ul class="rev-list">' +
        g.items.map(function (d) {
          return '<li><a href="' + ROUTES.cat(g.cat.id, d.name) + '">' + esc(d.name) + '</a>' +
                 '<span class="rev-ov">' + esc(d.overview) + '</span></li>';
        }).join('') +
        '</ul></div>';
    });

    html += '</section>' +
      '<div class="source-box"><p>自立活動の区分・項目は次に基づきます。<br>' +
      srcLink('jiritsu-kaisetsu') + '</p>' +
      '<p style="margin-top:8px;">状態との対応づけは本ツールによる教育的整理であり、' +
      'いずれの資料にも直接記載されているものではありません。</p></div></div>';

    mainContent.innerHTML = html;
    playFadeIn();
  }

  /* ---------- 診断名・出典 ---------- */

  function renderTerms() {
    var tm = META.termMap;

    var html = '<div class="jiritsu-table-wrap">' +
      '<div class="article-head">' +
        '<div class="article-num" style="border-radius:3px;">対</div>' +
        '<h2 class="cat-title">診断名の対応と出典一覧<span class="en">Terminology Map &amp; Sources</span></h2>' +
      '</div>' +
      '<div class="overview">' + esc(tm.note) + '</div>' +

      '<div class="ku-group">' +
        '<div class="ku-heading"><span class="ku-index">1</span><h3>教育上の区分と医学的診断名の対応</h3></div>' +
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

    html += '<div class="ku-group">' +
      '<div class="ku-heading"><span class="ku-index">2</span><h3>一次資料・公的データベース</h3></div>' +
      sourceTable(established) + '</div>';

    html += '<div class="ku-group">' +
      '<div class="ku-heading"><span class="ku-index">3</span><h3>研究段階の知見</h3></div>' +
      '<div class="section-disclaimer"><b>診断・指導の基準ではありません</b>' +
      '<p>以下は個別の研究発表です。DSM-5-TR／ICD-11 のような確立した診断分類とは位置づけが異なります。本ツールの記述の背景として挙げているもので、就学相談や指導計画の根拠として用いるものではありません。</p></div>' +
      sourceTable(research) + '</div>';

    html += '<div class="source-box"><p>' + esc(META.disclaimer.long) + '</p></div></div>';

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
        '出典 ' + SOURCES.length + '件（詳細は上部タブ「診断名・出典」）' +
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
    SOURCES.forEach(function (s) { SRC[s.id] = s; });

    // 自立活動の項目 → その項目を要する疾患、の索引を作る。
    // データはすでに疾患側に持っているので、向きを変えるだけ。
    DATA.forEach(function (c) {
      c.diseases.forEach(function (d) {
        (d.jiritsu || []).forEach(function (j) {
          var k = j.ku + '／' + j.item;
          (REV[k] = REV[k] || []).push({ cat: c, disease: d });
        });
      });
    });

    bindDom();
    renderFooter();
    installBanner();

    // 戻る／進む、URL直打ち、リンク経由のいずれもここで拾う
    window.addEventListener('hashchange', function () {
      applyRoute();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      loadJson('categories.json')
    ]).then(function (r) {
      var meta = r[0], sources = r[1], jiritsu27 = r[2], categories = r[3];
      return Promise.all(categories.map(function (c) {
        return loadJson(c.id + '.json').then(function (ds) {
          c.diseases = ds;
          return c;
        });
      })).then(function (cats) {
        boot({ meta: meta, sources: sources, jiritsu27: jiritsu27, categories: cats });
      });
    }).catch(fail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
