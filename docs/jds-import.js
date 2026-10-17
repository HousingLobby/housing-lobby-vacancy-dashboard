(() => {
  'use strict';
  // JDS（jds.suumo.jp）のページ上で動く読み取りプログラム。ブックマークから呼ばれる。
  // JDSにログイン済みのブラウザで、反響の一覧と詳細を読み取り、ダッシュボードの画面（hankyo.html#import）へ渡す。
  // 渡す先はダッシュボードの画面だけ（postMessage・送信先を固定）。社内ログインはダッシュボード側で行われる。
  const DASH = 'https://housinglobby.github.io';
  const DASH_URL = DASH + '/housing-lobby-vacancy-dashboard/hankyo.html#import';
  if (location.host !== 'jds.suumo.jp') { alert('JDS（jds.suumo.jp）のページを開いてから、もう一度押してください。'); return; }
  if (window.__hankyoImportRunning) return;
  window.__hankyoImportRunning = true;

  let w = null, ready = false, payload = null;
  const send = () => { if (w && ready && payload) { w.postMessage(payload, DASH); window.__hankyoImportRunning = false; } };
  window.addEventListener('message', e => { if (e.origin === DASH && e.data && e.data.type === 'hankyo-ready') { ready = true; send(); } });
  // ボタンを押した直後に窓を開く（読み取りのあとだと、ブラウザにポップアップとして止められる）
  w = window.open(DASH_URL, '_blank');
  if (!w) { alert('ポップアップがブロックされました。ブラウザの設定でJDSのポップアップを許可して、もう一度押してください。'); window.__hankyoImportRunning = false; return; }

  const gp = async (u, opt) => { const r = await fetch(u, {credentials: 'same-origin', ...opt}); return new DOMParser().parseFromString(await r.text(), 'text/html'); };
  (async () => {
    try {
      const top = await gp('/jds/CJ002TP001/');
      const shop = (top.body.innerText.match(/ハウジングロビー[^\n]*/) || [''])[0];
      if (!shop) throw new Error('JDSにログインしていないようです。ログインしてからもう一度押してください');
      const store = /諫早/.test(shop) ? 'A' : /長崎/.test(shop) ? 'B' : '';
      if (!store) throw new Error('店舗を判定できませんでした（' + shop + '）');
      // 検索：ステータスは未閲覧・閲覧済みの両方、期間・キーワードなし（JDSは40日で自動削除）
      const sf = (await gp('/jds/CJ003LI001/')).forms[0];
      const fd = new URLSearchParams();
      [...sf.elements].forEach(e => { if (!e.name) return; if (e.type === 'checkbox' || e.type === 'radio') { if (['hStsSE', 'ryoiki', 'show'].includes(e.name)) fd.append(e.name, e.value); return; } fd.append(e.name, e.value); });
      fd.set('kensakuFlg', '1');
      const list = await gp('/jds/CJ003LI001/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: fd.toString()});
      const token = list.querySelector('input[name=JJT_]');
      const seqs = [...new Set([...list.querySelectorAll('a[onclick*=hankyoLink]')].map(a => (a.getAttribute('onclick').match(/hankyoLink\('(\d+)'\)/) || [])[1]).filter(Boolean))];
      if (!seqs.length) { payload = {type: 'hankyo-items', store, items: [], shop}; send(); return; }
      if (!token) throw new Error('JDSの画面の形式が変わったようです（読み取れませんでした）');
      const det = async s => {
        const p = new URLSearchParams(); p.set('JJT_', token.value); p.set('hSeq', s);
        const d = await gp('/jds/CJ003DE002/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: p.toString()});
        const t = d.body.innerText, g = re => ((t.match(re) || [])[1] || '').trim();
        const m = t.match(/お問合せ日時\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        const date = m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
        return {id: store + '-' + g(/連番\s*(\d+)/), date, name: g(/名前（漢字）\s*([^\n]+)/), email: g(/メールアドレス\s*([^\s]+@[^\s]+)/), tel: g(/ＴＥＬ\s*([\d\-]+)/),
          property: g(/物件名\s*([^\n]+)/), message: [g(/お問合せ内容\s*([^\n]+)/), g(/お問合せ内容コメント\s*([^\n]+)/)].filter(Boolean).join('\n'), comment: (d.querySelector('textarea[name=hCmt]') || {}).value || ''};
      };
      const items = [];
      for (let i = 0; i < seqs.length; i += 6) items.push(...await Promise.all(seqs.slice(i, i + 6).map(det))); // 6件ずつ（JDSに負荷をかけない）
      payload = {type: 'hankyo-items', store, items, shop};
      send();
    } catch (err) {
      payload = {type: 'hankyo-error', message: String(err.message || err)};
      send();
      window.__hankyoImportRunning = false;
    }
  })();
})();
