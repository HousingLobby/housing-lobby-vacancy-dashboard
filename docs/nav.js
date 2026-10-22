(() => {
  'use strict';
  // ページの切り替えをプルダウン（メニュー）にまとめる。トップ（index.html）は既存のタブをメニューの中へ移し、
  // 月例巡回・反響対応などのページには同じメニューを上に追加する
  const PAGES = [['overview', '全体'], ['occupancy', '入居率・空室'], ['restoration', '原状回復完了'], ['patrol', '巡回'], ['promotion', '入居促進'], ['junkai', '月例巡回'], ['hankyo', '反響対応']];
  const hrefOf = k => k === 'junkai' ? 'junkai.html' : k === 'hankyo' ? 'hankyo.html' : `index.html#${k}`;
  const labelOf = k => (PAGES.find(p => p[0] === k) || PAGES[0])[1];
  function build() {
    const shell = document.querySelector('main.shell');
    if (!shell) return;
    const menu = document.createElement('details');
    menu.className = 'nav-menu';
    menu.innerHTML = '<summary><span class="nav-label">メニュー</span><span class="nav-current" id="nav-current"></span><span class="nav-caret" aria-hidden="true">▼</span></summary>';
    let nav = document.querySelector('nav.tabs');
    const page = document.body.dataset.page; // index 以外のページ
    if (nav && !page) {
      // トップ：既存のタブ（ボタン）をメニューに入れ、別ページへのリンクはそのまま残す
      nav.parentNode.insertBefore(menu, nav);
      menu.appendChild(nav);
      const update = () => { const k = location.hash.slice(1) || 'overview'; document.getElementById('nav-current').textContent = labelOf(PAGES.some(p => p[0] === k) ? k : 'overview'); };
      nav.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { menu.open = false; setTimeout(update, 0); }));
      window.addEventListener('hashchange', update);
      update();
    } else {
      nav = document.createElement('nav');
      nav.className = 'tabs'; nav.setAttribute('aria-label', '画面切替');
      nav.innerHTML = PAGES.map(([k, l]) => `<a class="tab tab-link${k === page ? ' active' : ''}" href="${hrefOf(k)}"${k === page ? ' aria-current="page"' : ''}>${l}</a>`).join('');
      menu.appendChild(nav);
      shell.insertBefore(menu, shell.firstChild);
      document.getElementById('nav-current').textContent = labelOf(page);
    }
    // メニューの外を押したら閉じる
    document.addEventListener('click', e => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
