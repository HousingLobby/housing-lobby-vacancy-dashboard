(() => {
  'use strict';
  // 入居促進：月ごとの申込・反響の集計（GASの action=promotion）。個人名は扱わない
  const el = id => document.getElementById(id);
  const CFG_PROJECT = '1201255767385595'; // 【空室一覧】
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = n => Number(n || 0).toLocaleString('ja-JP');
  const jst = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const monthLabel = m => `${Number(m.slice(0,4))}年${Number(m.slice(5))}月`;
  const months = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(Number(jst.slice(0,4)), Number(jst.slice(5,7)) - 1 - i, 1));
    months.push(d.toISOString().slice(0,7));
  }
  const select = el('promo-month');
  select.innerHTML = months.map((m, i) => `<option value="${m}">${monthLabel(m)}${i === 0 ? '（当月・途中経過）' : ''}</option>`).join('');
  let started = false;

  const waitDash = () => new Promise(resolve => { const t = () => window.DASH ? resolve(window.DASH) : setTimeout(t, 100); t(); });
  const sortEntries = obj => Object.entries(obj || {}).sort((a, b) => (b[1].people ?? b[1]) - (a[1].people ?? a[1]) || a[0].localeCompare(b[0], 'ja'));
  // 見出しだけを並べ、クリックで詳細（表）を開く。見出しの右に上位2つを要約表示
  const fold = (title, preview, body) => `<details class="promo-fold"><summary><span class="promo-title">${esc(title)}</span><span class="promo-preview">${preview}</span></summary><div class="promo-body">${body}</div></details>`;
  // 「未設定」に該当するタスク（申込）を、クリックで開いて確認できるようにする
  const unsetBox = list => list && list.length ? `<details class="unset-box"><summary>「未設定」のタスクを見る（${list.length}件）</summary><ul>${list.map(x => `<li><a href="https://app.asana.com/0/${CFG_PROJECT}/${encodeURIComponent(x.gid)}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a></li>`).join('')}</ul><p class="muted">Asanaで項目を入力するか、不要なタスク（仮の作成など）はステータスを「除外」にすると、集計から外れます。</p></details>` : '';
  // 割合は円グラフ（ドーナツ）で表す。上位7つに色を付け、残りは灰色（「その他」）
  const COLORS = ['#1b5d85', '#e0a22b', '#2f9e74', '#c4553a', '#7a5fb0', '#3aa3c4', '#b0723a'];
  const colorOf = i => i < COLORS.length ? COLORS[i] : '#b8c4cc';
  const swatch = i => `<span class="pie-sw" style="background:${colorOf(i)}"></span>`;
  const pie = (vals, total, unit) => {
    if (!total) return '';
    let acc = 0;
    const segs = vals.map((v, i) => {
      const pct = v / total * 100; if (pct <= 0) return '';
      const seg = `<circle r="15.915" cx="21" cy="21" fill="none" stroke="${colorOf(i)}" stroke-width="7" stroke-dasharray="${pct.toFixed(3)} ${(100 - pct).toFixed(3)}" stroke-dashoffset="${(25 - acc).toFixed(3)}"></circle>`;
      acc += pct; return seg;
    }).join('');
    return `<svg class="pie" viewBox="0 0 42 42" role="img" aria-label="割合の円グラフ"><circle r="15.915" cx="21" cy="21" fill="none" stroke="#eef3f6" stroke-width="7"></circle>${segs}<text x="21" y="20.5" text-anchor="middle" class="pie-num">${fmt(total)}</text><text x="21" y="26" text-anchor="middle" class="pie-unit">${unit}</text></svg>`;
  };
  const table1 = (title, obj, unit = '件', unset = null) => {
    const rows = sortEntries(obj);
    if (!rows.length) return '';
    const total = rows.reduce((n, [, v]) => n + v, 0);
    const preview = rows.slice(0, 2).map(([k, v]) => `${esc(k)} ${fmt(v)}${unit}`).join('・') + (rows.length > 2 ? ` ほか${rows.length - 2}` : '');
    return fold(title, preview, `<div class="promo-chart">${pie(rows.map(([, v]) => v), total, unit)}<table class="mini-table"><tbody>${rows.map(([k, v], i) => `<tr><td>${swatch(i)}${esc(k)}</td><td class="num">${fmt(v)}${unit}</td><td class="num muted">${total ? Math.round(v / total * 100) : 0}%</td></tr>`).join('')}</tbody></table></div>` + (obj['未設定'] ? (unset ? unsetBox(unset) : '<p class="muted unset-note">「最新に更新」を押すと、未設定のタスク名を確認できます</p>') : ''));
  };
  const table2 = (title, obj) => {
    const rows = sortEntries(obj);
    if (!rows.length) return '';
    const total = rows.reduce((n, [, v]) => n + v.people, 0);
    const preview = rows.slice(0, 2).map(([k, v]) => `${esc(k)} ${fmt(v.people)}人`).join('・') + (rows.length > 2 ? ` ほか${rows.length - 2}` : '');
    return fold(title, preview, `<div class="promo-chart">${pie(rows.map(([, v]) => v.people), total, '人')}<table class="mini-table"><thead><tr><th></th><th class="num">人数</th><th class="num">物件ごと</th><th class="num">割合</th></tr></thead><tbody>${rows.map(([k, v], i) => `<tr><td>${swatch(i)}${esc(k)}</td><td class="num">${fmt(v.people)}</td><td class="num">${fmt(v.properties)}</td><td class="num muted">${total ? Math.round(v.people / total * 100) : 0}%</td></tr>`).join('')}</tbody></table></div>`);
  };

  const render = async (month, refresh) => {
    const dash = await waitDash();
    el('promo-notice').textContent = `${monthLabel(month)}の申込・反響をAsanaから集計しています…（数十秒かかることがあります）`;
    el('promo-kpis').innerHTML = ''; el('promo-apps').innerHTML = ''; el('promo-resp').innerHTML = ''; el('promo-zero').innerHTML = '';
    let d;
    try { d = await window.Api.promotion(month, refresh); }
    catch (err) { el('promo-notice').textContent = `集計できませんでした：${err.message}`; return; }
    if (select.value !== month) return; // 途中で月を切り替えた
    const a = d.application, r = d.response;
    const applied = r.byResult?.['申込']?.people || 0;
    el('promo-asof').textContent = `集計 ${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(d.asOf))}`;
    el('promo-notice').textContent = `${monthLabel(month)}（${d.range.start}〜${d.range.end}）の集計です。${month === months[0] ? '当月は途中経過で、登録が進むと件数が変わります。' : ''}${r.excluded ? `登録エラーとみられる空タスク${r.excluded}件を除外しました。` : ''}`;
    el('promo-kpis').innerHTML = [
      ['申込数', `${fmt(a.total)}件`, '【空室一覧】申込日ベース', 'featured'],
      ['反響（人数）', `${fmt(r.total.people)}人`, `物件ごと ${fmt(r.total.properties)}件`, ''],
      ['反響→申込', r.total.people ? `${(applied / r.total.people * 100).toFixed(1)}%` : '—', `内見結果「申込」${fmt(applied)}人`, ''],
      ['仲介同行', `${fmt(r.brokerVisits)}件`, '反響とは別集計', '']
    ].map(([label, value, note, tone]) => `<div class="kpi ${tone}"><div class="label">${label}</div><strong>${value}</strong><small>${note}</small></div>`).join('');
    el('promo-apps').innerHTML = a.total ? [
      table1('地区', a.byArea, '件', a.unset?.byArea), table1('管理種別', a.byKind, '件', a.unset?.byKind), table1('申込経路', a.byRoute, '件', a.unset?.byRoute), table1('仲介業者', a.byBroker, '件', a.unset?.byBroker),
      table1('契約種別', a.byContract, '件', a.unset?.byContract), table1('かってに内見', a.bySelfViewing, '件', a.unset?.bySelfViewing), table1('現在のステータス', a.byStatus, '件', a.unset?.byStatus)
    ].join('') : '<p class="empty">この月の申込はありません</p>';
    el('promo-resp').innerHTML = r.total.people ? [
      table2('反響経路（ポータル＝SUUMO・アットホーム）', r.byGroup), table2('反響経由（詳細）', r.bySource), table2('種別', r.byType),
      table2('内見結果', r.byResult), table2('担当店舗', r.byStore), table2('地区', r.byArea)
    ].join('') : '<p class="empty">この月の反響はありません</p>';
    // 対象月に反響がない空室（物件名で照合）
    const key = s => String(s || '').normalize('NFKC').replace(/\s+/g, '').replace(/[0-9０-９]+号?室?$/, ''); // GAS側と同じ正規化
    const hit = new Set(Object.keys(r.byProperty || {}));
    const zero = dash.data.vacancies.filter(v => v.s === '空室中' && v.p && !hit.has(key(v.p)))
      .sort((x, y) => (dash.vacancyDays(y) ?? -1e9) - (dash.vacancyDays(x) ?? -1e9));
    window.PROMO_CURRENT = {month, d, zero: zero.map(v => ({name: `${v.p} ${v.r || ''}`.trim(), days: dash.vacancyDays(v), area: v.a || '', kind: v.c || ''}))};
    el('promo-zero-count').textContent = `${fmt(zero.length)}件`;
    el('promo-zero').innerHTML = zero.length ? zero.slice(0, 50).map(v => {
      const days = dash.vacancyDays(v);
      return `<tr><td><a class="room-link" href="${dash.roomUrl(v.id)}">${esc(v.p)} ${esc(v.r || '')}</a></td><td class="num">${days === null ? '—' : days < 0 ? '退去前' : `${days}日`}</td><td>${esc(v.a || '地区なし')}</td><td>${esc(v.c || '空欄')}</td></tr>`;
    }).join('') + (zero.length > 50 ? `<tr><td colspan="4" class="empty">ほか${zero.length - 50}件</td></tr>` : '') : '<tr><td colspan="4" class="empty">すべての空室に反響があります</td></tr>';
  };
  select.addEventListener('change', () => render(select.value, false));
  el('promo-refresh').addEventListener('click', () => render(select.value, true));
  window.addEventListener('promotion:show', () => { if (!started) { started = true; render(select.value, false); } });
})();
