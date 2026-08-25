/* Service Worker の登録と、新版が出たときの自動リロード。
   キャッシュに古い版が居座らないよう、更新を検知したら即座に切り替える。 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return; // ローカルで直接開いた場合は何もしない

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // 起動のたびに新版の有無を確認する
      reg.update();

      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage('SKIP_WAITING');
          }
        });
      });
    }).catch(function (e) { console.warn('SW registration failed:', e); });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  });
})();
