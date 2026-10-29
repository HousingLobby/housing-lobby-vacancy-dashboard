/* SUUMO掲載物件レポート（閲覧数・問い合わせ）
   - 入居促進ページ：SUUMOの「掲載物件レポート」CSV（Shift_JIS）を読み、部屋ごとの数字だけをGASへ送る。同じ日付のレポートは取り込まない
   - 部屋ページ：その部屋の最新の数字を表示する */
(() => {
  'use strict';
  const key = (p, r) => {
    const n = v => String(v ?? '').normalize('NFKC').replace(/[\s・･]/g, '').toLowerCase();
    return n(p) + '|' + n(r).replace(/\(.*?\)/g, '').replace(/号室?$/, ''); // 号室の「(3DK)」「号」は除く
  };

  // ダブルクォート対応の簡単なCSV読み取り
  const parseCsv = text => {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c !== ''));
  };

  const readReport = async file => {
    const text = new TextDecoder('shift_jis').decode(await file.arrayBuffer());
    const [head, ...body] = parseCsv(text.replace(/^﻿/, ''));
    const col = name => head.indexOf(name);
    const need = {p: '物件名', r: '部屋番号', listed: '物件掲載', days: '掲載日数(日)(合計)', list: '合計一覧PV(合計)', listDay: '合計一覧PV(一日当たり)',
      detail: '合計詳細PV(合計)', detailDay: '合計詳細PV(一日当たり)', inq: '問い合わせ(合計)'};
    const idx = {};
    Object.keys(need).forEach(k => { idx[k] = col(need[k]); if (idx[k] < 0) throw new Error(`SUUMOの掲載物件レポートではないようです（「${need[k]}」の列がありません）`); });
    const m = file.name.match(/(\d{4})(\d{2})(\d{2})\d{6}\.csv$/);
    const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(new Date());
    const date = m ? `${m[1]}-${m[2]}-${m[3]}` : today;
    const num = v => { const x = Number(String(v ?? '').replace(/[,%]/g, '')); return Number.isFinite(x) ? x : null; };
    const rows = body.map(c => ({p: c[idx.p], r: c[idx.r], listed: c[idx.listed] === '○', days: num(c[idx.days]), list: num(c[idx.list]),
      listDay: num(c[idx.listDay]), detail: num(c[idx.detail]), detailDay: num(c[idx.detailDay]), inq: num(c[idx.inq])})).filter(r => r.p);
    return {date, rows};
  };

  const fmt = v => v == null ? '—' : new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 2}).format(v);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  window.Suumo = {
    key,
    // 部屋ページ用：その部屋の最新の数字のHTML
    roomHtml(store, room) {
      const s = store && store.rooms && store.rooms[key(room.p, room.r)];
      if (!s) return '<p class="footnote" style="margin:0">取り込んだSUUMOの掲載物件レポートに、この部屋はありません。</p>';
      return `<div class="two-metrics suumo-metrics">
        <div class="metric-line"><strong>${fmt(s.detail)}</strong><span>詳細ページの閲覧（1日 ${fmt(s.detailDay)}）</span></div>
        <div class="metric-line"><strong>${fmt(s.inq)}件</strong><span>問い合わせ</span></div>
        <div class="metric-line"><strong>${fmt(s.list)}</strong><span>一覧での表示（1日 ${fmt(s.listDay)}）</span></div>
      </div><p class="footnote" style="margin:8px 0 0">${esc(s.date.replace(/-/g, '/'))}のレポート・掲載${fmt(s.days)}日分（${s.listed ? '掲載中' : '掲載終了'}）</p>`;
    }
  };

  // 入居促進ページ：取り込み
  const input = document.getElementById('suumo-file');
  if (!input) return;
  const msg = document.getElementById('suumo-msg');
  const last = document.getElementById('suumo-last');
  const showLast = store => {
    const d = (store && store.dates) || [];
    last.textContent = d.length ? `取り込み済み：最新 ${d[d.length - 1].replace(/-/g, '/')}（${d.length}回分）` : 'まだ取り込んでいません';
  };
  const load = async () => { try { showLast((await window.Api.suumo()).suumo); } catch (e) { last.textContent = ''; } };
  if (window.Auth) window.Auth.ready.then(load); else load();
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    msg.textContent = '読み込んでいます…';
    try {
      const rep = await readReport(file);
      msg.textContent = `${rep.date.replace(/-/g, '/')}のレポート（${rep.rows.length}部屋）を送っています…`;
      const res = await window.Api.suumoImport(rep);
      const data = window.DASH && window.DASH.data;
      const matched = data ? data.vacancies.filter(v => res.suumo.rooms[key(v.p, v.r)] && res.suumo.rooms[key(v.p, v.r)].date === rep.date).length : null;
      msg.textContent = res.skipped
        ? `${rep.date.replace(/-/g, '/')}のレポートは取り込み済みのため、反映しませんでした。`
        : `${rep.date.replace(/-/g, '/')}のレポートを取り込みました（${res.updated}部屋${matched == null ? '' : `、うち【募集中】の空室 ${matched}部屋`}）。各部屋のページに表示されます。`;
      showLast(res.suumo);
    } catch (e) { msg.textContent = `取り込めませんでした：${e.message}`; }
    input.value = '';
  });
})();
