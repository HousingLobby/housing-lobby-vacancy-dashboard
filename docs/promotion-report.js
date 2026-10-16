(() => {
  'use strict';
  // 入居促進：月次レポート（画面で開いてPDF保存）とCSV。会議資料用。対象月と前月を比べ、所見（自動）を付ける
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthLabel = m => `${Number(m.slice(0, 4))}年${Number(m.slice(5))}月`;
  const prevOf = m => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)) - 2, 1)).toISOString().slice(0, 7);
  const pct = (n, d) => d ? Math.round(n / d * 1000) / 10 : 0;
  const sgn = n => n > 0 ? `+${n}` : n < 0 ? `${n}` : '±0';
  const say = t => { el('promo-export-msg').textContent = t; };

  const APP_TABLES = [['地区', 'byArea'], ['管理種別', 'byKind'], ['申込経路', 'byRoute'], ['仲介業者', 'byBroker'], ['契約種別', 'byContract'], ['かってに内見', 'bySelfViewing'], ['現在のステータス', 'byStatus']];
  const RESP_TABLES = [['反響経路（ポータル）', 'byGroup'], ['反響経由（詳細）', 'bySource'], ['種別', 'byType'], ['内見結果', 'byResult'], ['担当店舗', 'byStore'], ['地区', 'byArea']];

  // 集計を {表の名前: [{k, n(件数・人数), props, ratio, prev}]} に整える
  function tables(d, prev) {
    const out = {app: [], resp: []};
    const total = d.application.total, ptotal = prev ? prev.application.total : 0;
    for (const [name, key] of APP_TABLES) {
      const cur = d.application[key] || {}, pv = prev ? (prev.application[key] || {}) : {};
      const keys = [...new Set([...Object.keys(cur), ...Object.keys(pv)])].sort((a, b) => (cur[b] || 0) - (cur[a] || 0) || a.localeCompare(b, 'ja'));
      if (!keys.length) continue;
      out.app.push({name, rows: keys.map(k => ({k, n: cur[k] || 0, ratio: pct(cur[k] || 0, total), prev: prev ? (pv[k] || 0) : null}))});
    }
    const rtotal = d.response.total.people;
    for (const [name, key] of RESP_TABLES) {
      const cur = d.response[key] || {}, pv = prev ? (prev.response[key] || {}) : {};
      const keys = [...new Set([...Object.keys(cur), ...Object.keys(pv)])].sort((a, b) => ((cur[b] || {}).people || 0) - ((cur[a] || {}).people || 0) || a.localeCompare(b, 'ja'));
      if (!keys.length) continue;
      out.resp.push({name, rows: keys.map(k => ({k, n: (cur[k] || {}).people || 0, props: (cur[k] || {}).properties || 0, ratio: pct((cur[k] || {}).people || 0, rtotal), prev: prev ? ((pv[k] || {}).people || 0) : null}))});
    }
    return out;
  }

  // 自動の所見（会議で確認・修正する前提）
  function review(month, d, prev, zero) {
    const lines = [], todo = [];
    const a = d.application.total, r = d.response.total.people, applied = (d.response.byResult?.['申込'] || {}).people || 0;
    const rate = pct(applied, r);
    if (prev) {
      const pa = prev.application.total, pr = prev.response.total.people, prate = pct((prev.response.byResult?.['申込'] || {}).people || 0, pr);
      lines.push(`申込は${a}件で、前月（${pa}件）から${sgn(a - pa)}件。`);
      lines.push(`反響は${r}人で、前月（${pr}人）から${sgn(r - pr)}人。`);
      lines.push(`反響から申込につながった割合は${rate}%（前月${prate}%）。`);
      if (a < pa) todo.push('申込が前月より減っています。減った地区・管理種別を、下の内訳の「前月」列で確認する。');
      if (r < pr) todo.push('反響が前月より減っています。掲載内容（写真・賃料・コメント）と、反響の多かった経路を確認する。');
    } else {
      lines.push(`申込は${a}件、反響は${r}人、反響から申込につながった割合は${rate}%。`);
    }
    const top = (obj) => Object.entries(obj || {}).sort((x, y) => (y[1].people ?? y[1]) - (x[1].people ?? x[1]))[0];
    const tg = top(d.response.byGroup); if (tg && r) lines.push(`反響の経路は「${tg[0]}」が最多（${tg[1].people}人・${pct(tg[1].people, r)}%）。`);
    const ta = top(d.response.byArea); if (ta && r) lines.push(`反響の地区は「${ta[0]}」が最多（${ta[1].people}人）。`);
    const ap = top(d.application.byArea); if (ap && a) lines.push(`申込の地区は「${ap[0]}」が最多（${ap[1]}件）。`);
    const only = (d.response.byResult?.['問い合わせのみ'] || {}).people || 0;
    if (r && pct(only, r) >= 60) { lines.push(`内見結果は「問い合わせのみ」が${pct(only, r)}%で、内見につながっていない反響が多い状況。`); todo.push('反響後の追客（返信の速さ・かってに内見の案内）を強化する。'); }
    if (zero.length) {
      const longest = zero.filter(z => z.days != null && z.days >= 0).slice(0, 3).map(z => `${z.name}（${z.days}日）`).join('、');
      lines.push(`今月、反響がなかった空室は${zero.length}件${longest ? `。空室期間が長い順に ${longest}` : ''}。`);
      todo.push('反響がなかった空室は、掲載写真・賃料・条件を見直す。空室期間が長い物件は、オーナー様へ相談する（反響レポート）。');
    }
    if (!todo.length) todo.push('大きな課題は見当たりません。現状の取り組みを継続する。');
    return {lines, todo};
  }

  const trow = (r, cols) => `<tr><td>${esc(r.k)}</td><td class="n">${r.n}</td>${cols.props ? `<td class="n">${r.props}</td>` : ''}<td class="n">${r.ratio}%</td>${cols.prev ? `<td class="n">${r.prev}</td><td class="n">${sgn(r.n - r.prev)}</td>` : ''}</tr>`;
  const table = (t, unit, cols) => `<h3>${esc(t.name)}</h3><table><thead><tr><th></th><th class="n">${unit}</th>${cols.props ? '<th class="n">物件ごと</th>' : ''}<th class="n">割合</th>${cols.prev ? '<th class="n">前月</th><th class="n">前月差</th>' : ''}</tr></thead><tbody>${t.rows.map(r => trow(r, cols)).join('')}</tbody></table>`;

  function reportHtml(month, d, prev, zero) {
    const hasPrev = Boolean(prev);
    const a = d.application.total, r = d.response.total, applied = (d.response.byResult?.['申込'] || {}).people || 0;
    const T = tables(d, prev), rv = review(month, d, prev, zero);
    const kpi = (label, v, sub) => `<div class="kpi"><span>${label}</span><strong>${v}</strong><small>${sub}</small></div>`;
    const dayStr = v => v == null ? '—' : v < 0 ? '退去前' : `${v}日`;
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>入居促進_月次レポート_${month}</title><style>
@page{size:A4;margin:12mm}
body{font-family:-apple-system,"Hiragino Sans","Yu Gothic",sans-serif;color:#13262d;font-size:10.5pt;line-height:1.55;margin:0 auto;max-width:190mm;padding:6mm}
h1{font-size:19pt;margin:0 0 1mm}h2{font-size:12.5pt;border-left:1.8mm solid #0e6f73;padding-left:2.4mm;margin:6mm 0 2mm}h3{font-size:10.5pt;margin:3mm 0 1mm}
.sub{color:#4b6068;font-size:9pt}.bar{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.6mm solid #0e6f73;padding-bottom:2mm;margin-bottom:3mm}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.kpi{border:.3mm solid #c9d9de;border-radius:2.5mm;padding:2.4mm 3mm}.kpi:first-child{background:#163d5a;color:#fff}.kpi span{font-size:8.6pt;opacity:.85}.kpi strong{display:block;font-size:17pt;line-height:1.2}.kpi small{font-size:8pt;opacity:.8}
table{width:100%;border-collapse:collapse;font-size:9.4pt;margin-bottom:1mm}th,td{border-bottom:.25mm solid #dbe6ea;padding:1mm 1.6mm;text-align:left}th{background:#f1f5f7;font-size:8.6pt}.n{text-align:right;font-variant-numeric:tabular-nums}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.box{border:.3mm solid #c9d9de;border-radius:2.5mm;padding:2.4mm 3.4mm}.rev li{margin-bottom:1mm}.todo{background:#fcecd3;border:.3mm solid #b86d05;border-radius:2.5mm;padding:2.4mm 3.4mm}.memo{border:.3mm dashed #9bb1b8;border-radius:2.5mm;min-height:24mm;padding:2mm 3mm;color:#9bb1b8;font-size:9pt}
.tools{position:sticky;top:0;background:#fff;padding:2mm 0;margin-bottom:2mm}.tools button{font-size:11pt;padding:2mm 6mm;border-radius:2mm;border:0;background:#1b5d85;color:#fff;font-weight:700;cursor:pointer}
@media print{.tools{display:none}.pb{page-break-before:always}}
</style></head><body>
<div class="tools"><button onclick="window.print()">PDFで保存（印刷）</button> <span class="sub">印刷画面で「PDFに保存」を選んでください</span></div>
<div class="bar"><div><h1>入居促進 月次レポート</h1><div class="sub">${monthLabel(month)}（${esc(d.range.start)}〜${esc(d.range.end)}）　${hasPrev ? `前月（${monthLabel(prevOf(month))}）と比較` : ''}　作成 ${new Date().toLocaleDateString('ja-JP')}</div></div><div class="sub">株式会社ハウジングロビー 社内用</div></div>
<h2>1. 今月のまとめ</h2>
<div class="kpis">${kpi('申込数', `${a}件`, hasPrev ? `前月 ${prev.application.total}件（${sgn(a - prev.application.total)}）` : '申込日ベース')}${kpi('反響（人数）', `${r.people}人`, hasPrev ? `前月 ${prev.response.total.people}人（${sgn(r.people - prev.response.total.people)}）` : `物件ごと ${r.properties}件`)}${kpi('反響→申込', r.people ? `${pct(applied, r.people)}%` : '—', `内見結果「申込」${applied}人`)}${kpi('仲介同行', `${d.response.brokerVisits}件`, '反響とは別集計')}</div>
<h2>2. レビュー（自動作成。会議で確認・修正してください）</h2>
<div class="cols"><div class="box"><b>数字から見えること</b><ul class="rev">${rv.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div><div class="todo"><b>次月の確認・対応</b><ul class="rev">${rv.todo.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div></div>
<h3>追記メモ（会議で決めたこと）</h3><div class="memo">　</div>
<h2 class="pb">3. 申込の内訳（【空室一覧】申込日が対象月）</h2>
${T.app.length ? T.app.map(t => table(t, '件数', {prev: hasPrev})).join('') : '<p>この月の申込はありません</p>'}
<h2 class="pb">4. 反響の内訳（【セルフ内見予約表】人数／物件ごと）</h2>
${T.resp.length ? T.resp.map(t => table(t, '人数', {props: true, prev: hasPrev})).join('') : '<p>この月の反響はありません</p>'}
<h2>5. 対象月に反響がない空室（${zero.length}件・空室期間が長い順）</h2>
<table><thead><tr><th>物件・号室</th><th class="n">空室期間</th><th>地区</th><th>管理種別</th></tr></thead><tbody>${zero.length ? zero.slice(0, 40).map(z => `<tr><td>${esc(z.name)}</td><td class="n">${dayStr(z.days)}</td><td>${esc(z.area || '地区なし')}</td><td>${esc(z.kind || '空欄')}</td></tr>`).join('') + (zero.length > 40 ? `<tr><td colspan="4">ほか${zero.length - 40}件</td></tr>` : '') : '<tr><td colspan="4">すべての空室に反響があります</td></tr>'}</tbody></table>
<p class="sub">申込：【空室一覧】の親タスクのうち「申込日」が対象月のもの（テンプレ・除外は除く）。反響：【セルフ内見予約表】で期日が対象月の「反響」「かってに内見」（同じ人は1人、同一物件の複数号室は1件）。${month === new Date().toISOString().slice(0, 7) ? '当月は途中経過です。' : ''}</p>
</body></html>`;
  }

  function csvText(month, d, prev, zero) {
    const rows = [['対象月', '区分', '分類', '項目', '件数・人数', '物件ごと', '割合(%)', '前月', '前月差']];
    const add = (cat, cls, item, n, props, ratio, pv) => rows.push([month, cat, cls, item, n, props ?? '', ratio ?? '', pv ?? '', pv == null ? '' : Math.round((n - pv) * 10) / 10]);
    const hasPrev = Boolean(prev);
    add('サマリー', '', '申込数（件）', d.application.total, '', '', hasPrev ? prev.application.total : null);
    add('サマリー', '', '反響（人数）', d.response.total.people, d.response.total.properties, '', hasPrev ? prev.response.total.people : null);
    const applied = (d.response.byResult?.['申込'] || {}).people || 0;
    add('サマリー', '', '反響→申込（%）', pct(applied, d.response.total.people), '', '', hasPrev ? pct((prev.response.byResult?.['申込'] || {}).people || 0, prev.response.total.people) : null);
    add('サマリー', '', '仲介同行（件）', d.response.brokerVisits, '', '', hasPrev ? prev.response.brokerVisits : null);
    const T = tables(d, prev);
    T.app.forEach(t => t.rows.forEach(r => add('申込', t.name, r.k, r.n, '', r.ratio, r.prev)));
    T.resp.forEach(t => t.rows.forEach(r => add('反響', t.name, r.k, r.n, r.props, r.ratio, r.prev)));
    zero.forEach(z => rows.push([month, '反響ゼロの空室', z.area || '地区なし', z.name, z.days == null ? '' : z.days < 0 ? '退去前' : z.days, '', '', '', '']));
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    return '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
  }

  async function gather() {
    const cur = window.PROMO_CURRENT;
    const month = el('promo-month').value;
    if (!cur || cur.month !== month) throw new Error('集計の表示が終わってから押してください');
    say('前月のデータを取得しています…');
    let prev = null;
    try { prev = await window.Api.promotion(prevOf(month), false); } catch (e) { say('前月の取得に失敗したため、前月比なしで作成します'); }
    return {month, d: cur.d, prev, zero: cur.zero};
  }

  el('promo-report').addEventListener('click', async () => {
    try {
      const {month, d, prev, zero} = await gather();
      const w = window.open('', '_blank');
      if (!w) throw new Error('ポップアップがブロックされました。許可してもう一度押してください');
      w.document.open(); w.document.write(reportHtml(month, d, prev, zero)); w.document.close();
      say('レポートを別のタブで開きました。「PDFで保存（印刷）」を押してください');
    } catch (e) { say(e.message); }
  });
  el('promo-csv').addEventListener('click', async () => {
    try {
      const {month, d, prev, zero} = await gather();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csvText(month, d, prev, zero)], {type: 'text/csv;charset=utf-8'}));
      a.download = `入居促進_月次_${month}.csv`;
      document.body.append(a); a.click(); a.remove();
      say(`CSV（${month}）をダウンロードしました。Excelで開けます`);
    } catch (e) { say(e.message); }
  });
})();
