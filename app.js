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
  var SRC = {}; // id -> source

  function srcLink(id) {
    var s = SRC[id];
    if (!s) return '';
    var title = esc(s.title) + (s.edition ? '（' + esc(s.edition) + '）' : '');
    if (!s.url) return title;
    return title + '<br><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a>';
  }

  /* ---------- DOM 参照 ---------- */

  var catList, mainContent, searchBox, sideNav,
      tabGuide, tabJiritsu, tabTerms, layoutRoot, homeBtn, homeLink, siteFooter;

  var currentId = null;
  var mode = 'guide'; // 'guide' | 'jiritsu' | 'terms'

  var supportKeyLabels = {
    content: '教育内容・方法', method: '教材・情報保障',
    system: '支援体制', facility: '施設・設備'
  };

  function playFadeIn() {
    mainContent.classList.remove('fade-in');
    void mainContent.offsetWidth; // 強制リフローでアニメーションを再スタート
    mainContent.classList.add('fade-in');
  }

  /* ---------- 画面モード ---------- */

  function goHome() {
    currentId = null;
    searchBox.value = '';
    setMode('guide');
  }

  function setMode(m) {
    mode = m;
    tabGuide.classList.toggle('on', m === 'guide');
    tabJiritsu.classList.toggle('on', m === 'jiritsu');
    tabTerms.classList.toggle('on', m === 'terms');
    if (m === 'guide') {
      sideNav.style.display = '';
      layoutRoot.classList.remove('wide');
      renderIndex(searchBox.value);
      if (currentId) { renderMain(currentId); } else { renderHome(); }
    } else {
      sideNav.style.display = 'none';
      layoutRoot.classList.add('wide');
      if (m === 'jiritsu') { renderJiritsuTable(); } else { renderTerms(); }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 索引 ---------- */

  function renderIndex(filter) {
    var f = (filter || '').trim().toLowerCase();
    catList.innerHTML = '';
    var diseaseHits = [];

    DATA.forEach(function (cat) {
      var catHay = (cat.name + cat.en + cat.overview).toLowerCase();
      var matched = f ? cat.diseases.filter(function (d) {
        return d.name.toLowerCase().indexOf(f) >= 0 ||
               (d.overview || '').toLowerCase().indexOf(f) >= 0;
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
      btn.onclick = function () {
        currentId = cat.id;
        renderIndex(searchBox.value);
        renderMain(cat.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
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
        btn.innerHTML = '<span class="hit-disease">' + esc(h.disease.name) + '</span>' +
                        '<span class="hit-cat">' + esc(h.cat.name) + '</span>';
        btn.onclick = function () {
          currentId = h.cat.id;
          renderIndex(searchBox.value);
          renderMain(h.cat.id, h.disease.name);
        };
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
      el.onclick = function () {
        currentId = el.dataset.id;
        renderIndex(searchBox.value);
        renderMain(currentId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
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

      var severityBlock = d.severity ? (
        '<p class="dd-label">程度別の支援（重症度分類に基づく細分化）</p>' +
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
        if (!item.classList.contains('open')) { openDiseaseItem(item); } else { closeDiseaseItem(item); }
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
        html += '<tr><td class="item-no">(' + (ii + 1) + ')</td>' +
                '<td class="item-name">' + esc(it.name) + official + '</td>' +
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
    siteFooter = document.getElementById('siteFooter');

    homeBtn.onclick = goHome;
    homeLink.onclick = goHome;
    homeLink.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); }
    };
    tabGuide.onclick = function () { setMode('guide'); };
    tabJiritsu.onclick = function () { setMode('jiritsu'); };
    tabTerms.onclick = function () { setMode('terms'); };
    searchBox.addEventListener('input', function () { renderIndex(searchBox.value); });
  }

  function boot(bundle) {
    META = bundle.meta;
    SOURCES = bundle.sources;
    JIRITSU27 = bundle.jiritsu27;
    DATA = bundle.categories;
    SOURCES.forEach(function (s) { SRC[s.id] = s; });

    bindDom();
    renderIndex('');
    renderHome();
    renderFooter();
    installBanner();
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
