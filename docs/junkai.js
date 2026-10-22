(() => {
  'use strict';
  // 月例巡回の班分け：巡回日ごとに、班（名前・担当者・エリア・物件数）を決め、空室中＋退去予定の物件を振り分けて共有する。
  // 保存先はGAS（Asanaには書かない）。巡回の記録は各部屋のページから従来どおり行い、巡回日以降の記録があれば「済」と表示する
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const AREAS = ['長崎中央', '長崎北', '諫早', '大村'];
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const dayNum = s => Date.parse(s + 'T00:00:00Z');
  const keyOf = (p, a) => String(p || '').normalize('NFKC').replace(/[\s・･.．\-‐‑–—－_（）()]+/g, '').toLowerCase() + '|' + (a || '');
  let data = null, buildings = {}, groups = [], plan = null;
  const NONE = 'ー';
  // 班の担当エリア（最大2つ。「ー」はなし）
  const areasOf = g => [...new Set([g.area, g.area2].filter(a => a && a !== NONE))];

  // 空室中・退去予定の部屋を、建物（物件名＋地区）ごとにまとめる
  function buildIndex() {
    buildings = {};
    const idx = data.patrolIndex || {};
    for (const v of data.vacancies) {
      if (!v.p || !AREAS.includes(v.a)) continue;
      if (v.s !== '空室中' && v.s !== '入居中（退去予定）') continue;
      const key = keyOf(v.p, v.a);
      const b = buildings[key] || (buildings[key] = {key, p: v.p, a: v.a, rooms: [], lastPatrol: null, maxDays: null});
      const last = idx[v.id] && idx[v.id].date;
      const days = v.v ? Math.floor((dayNum(today) - dayNum(v.v)) / 86400000) : null;
      b.rooms.push({id: v.id, r: v.r || '', soon: v.s !== '空室中', last, days});
      if (days != null && (b.maxDays == null || days > b.maxDays)) b.maxDays = days;
    }
    for (const b of Object.values(buildings)) {
      // 前回巡回＝建物内でいちばん古い巡回日。未巡回の部屋が1つでもあれば「未巡回あり」（null）
      b.lastPatrol = b.rooms.every(r => r.last) ? b.rooms.map(r => r.last).sort()[0] : null;
    }
    for (const b of Object.values(buildings)) b.rooms.sort((x, y) => String(x.r).localeCompare(String(y.r), 'ja', {numeric: true}));
  }
  // 優先度：未巡回 → 巡回から日が経っている順 → 空室期間が長い順
  const priority = b => (b.lastPatrol ? dayNum(today) - dayNum(b.lastPatrol) : 1e13) + (b.maxDays || 0);

  // ---------- 班の入力欄 ----------
  function groupRow(g, i) {
    return `<div class="jk-g" data-i="${i}">
      <label>班の名前<input data-f="name" value="${esc(g.name)}" placeholder="例：A班"></label>
      <label>担当者（任意）<input data-f="member" value="${esc(g.member)}" placeholder="例：細田・本多"></label>
      <label>エリア1<select data-f="area">${[NONE, ...AREAS].map(a => `<option${a === (g.area || NONE) ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
      <label>エリア2<select data-f="area2">${[NONE, ...AREAS].map(a => `<option${a === (g.area2 || NONE) ? ' selected' : ''}>${a}</option>`).join('')}</select></label>
      <label>物件数<input data-f="count" type="number" min="1" max="20" value="${g.count || 7}"></label>
      <button type="button" class="x" data-del="${i}">削除</button></div>`;
  }
  function renderGroupInputs() {
    $('jk-groups').innerHTML = groups.map(groupRow).join('');
    $('jk-groups').querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('input', e => {
      const i = Number(e.target.closest('.jk-g').dataset.i), f = e.target.dataset.f;
      groups[i][f] = f === 'count' ? Math.max(1, Math.min(20, Number(e.target.value) || 7)) : e.target.value;
      if (f !== 'count' && plan) renderCards(); // 班名・担当・エリアの変更を表示に反映
    }));
    $('jk-groups').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { groups.splice(Number(b.dataset.del), 1); renderGroupInputs(); if (plan) renderCards(); }));
  }

  // ---------- 振り分け ----------
  function makePlan() {
    groups.forEach(g => { g.props = []; });
    // 優先度の高い建物から順に、そのエリアを担当する班のうち、まだ枠が空いていて割り当てが少ない班へ入れる
    const cand = Object.values(buildings).sort((x, y) => priority(y) - priority(x));
    for (const b of cand) {
      const open = groups.filter(g => areasOf(g).includes(b.a) && g.props.length < (g.count || 7));
      if (!open.length) continue;
      open.sort((x, y) => x.props.length / (x.count || 7) - y.props.length / (y.count || 7));
      open[0].props.push(b.key);
    }
    plan = {date: $('jk-date').value};
    renderCards();
    say('振り分け案を作りました。物件の入れ替え・削除をしてから「保存して全員に共有」を押してください');
  }

  // ---------- 班ごとの表 ----------
  const routeUrl = addrs => {
    if (!addrs.length) return '';
    const u = new URL('https://www.google.com/maps/dir/');
    const params = {api: '1', destination: addrs[addrs.length - 1], travelmode: 'driving'};
    if (addrs.length > 1) params.waypoints = addrs.slice(0, -1).join('|');
    u.search = new URLSearchParams(params).toString();
    return u.href;
  };
  const addressOf = b => (data.addresses && data.addresses.properties && data.addresses.properties[b.key] || {}).address || '';
  function renderCards() {
    const date = $('jk-date').value || today;
    const assigned = new Set(groups.flatMap(g => g.props || []));
    $('jk-cards').innerHTML = groups.map((g, gi) => {
      const list = (g.props || []).map(k => buildings[k] || {key: k, p: k.split('|')[0], a: k.split('|')[1], rooms: [], missing: true});
      const rooms = list.flatMap(b => b.rooms);
      const done = rooms.filter(r => r.last && r.last >= date).length;
      const addrs = list.map(addressOf).filter(Boolean);
      const spare = Object.values(buildings).filter(b => areasOf(g).includes(b.a) && !assigned.has(b.key)).sort((x, y) => priority(y) - priority(x));
      return `<div class="jk-card">
        <div><h2>${esc(g.name || '班')}　<span style="font-size:.85rem;color:#617688">${esc(areasOf(g).join('・') || 'エリアなし')}</span></h2><div class="sub">${esc(g.member || '担当者未設定')}　｜　${list.length}物件・${rooms.length}部屋　｜　巡回済み ${done}/${rooms.length}</div></div>
        <div class="jk-progress"><i style="width:${rooms.length ? Math.round(done / rooms.length * 100) : 0}%"></i></div>
        ${addrs.length ? `<a class="secondary-button no-print" style="text-align:center;text-decoration:none" href="${esc(routeUrl(addrs))}" target="_blank" rel="noopener noreferrer">この班のルートをGoogleマップで開く（${addrs.length}か所）</a>` : ''}
        ${list.map((b, bi) => `<div class="jk-prop"><div class="top"><b>${bi + 1}. ${esc(b.p)}</b><button type="button" class="x no-print" data-g="${gi}" data-rm="${esc(b.key)}">外す</button></div>
          <div class="meta">${b.missing ? '※現在の空室一覧にありません（入居済みなど）' : `${esc(addressOf(b) || '住所未登録')}　｜　前回巡回 ${b.lastPatrol ? esc(b.lastPatrol) : '未巡回あり'}${b.maxDays != null ? `　｜　空室 最長${b.maxDays}日` : ''}`}</div>
          <div class="jk-rooms">${b.rooms.map(r => `<a class="${r.last && r.last >= date ? 'done' : ''} ${r.soon ? 'soon' : ''}" href="room.html?id=${encodeURIComponent(r.id)}" title="${r.soon ? '退去予定' : '空室中'}">${esc(r.r || '号室なし')}${r.soon ? '（退去予定）' : ''}${r.last && r.last >= date ? ' ✓' : ''}</a>`).join('')}</div></div>`).join('')}
        <div class="jk-add no-print"><select data-addsel="${gi}"><option value="">＋ 物件を追加（${esc(areasOf(g).join('・') || 'エリア未設定')}の未割り当て ${spare.length}件）</option>${spare.map(b => `<option value="${esc(b.key)}">${esc(b.p)}（${b.rooms.length}部屋・${b.lastPatrol ? '前回' + b.lastPatrol : '未巡回あり'}）</option>`).join('')}</select></div>
      </div>`;
    }).join('') || '<p class="empty">班を追加してください</p>';
    $('jk-cards').querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { const g = groups[Number(b.dataset.g)]; g.props = g.props.filter(k => k !== b.dataset.rm); renderCards(); }));
    $('jk-cards').querySelectorAll('[data-addsel]').forEach(s => s.addEventListener('change', () => { if (!s.value) return; groups[Number(s.dataset.addsel)].props.push(s.value); renderCards(); }));
    $('jk-save').hidden = !groups.length; $('jk-print').hidden = !groups.length;
  }

  // ---------- 保存・読み込み ----------
  const say = (t, err) => { $('jk-msg').textContent = t; $('jk-msg').className = 'save-message' + (err ? ' error' : ''); };
  async function save() {
    const date = $('jk-date').value;
    if (!date) { say('巡回日を入れてください', true); return; }
    $('jk-save').disabled = true; say('保存しています…');
    try {
      const body = {date, groups: groups.map(g => ({name: g.name, member: g.member, area: areasOf(g).join('・'), props: (g.props || []).map(k => { const b = buildings[k] || {p: k.split('|')[0], a: k.split('|')[1], rooms: []}; return {key: k, p: b.p, a: b.a, rooms: b.rooms.map(r => r.id)}; })}))};
      const r = await Api.savePatrolPlan(body);
      plan = r.plan; showSaved(); $('setup').open = false; summarizeSetup(); say('保存しました。このページを開けば、全員が同じ班分けを見られます');
      loadPast(date);
    } catch (e) { say('保存できませんでした：' + e.message, true); }
    $('jk-save').disabled = false;
  }
  function showSaved() { $('saved-note').textContent = plan && plan.savedAt ? `保存済み：${plan.date}の班分け（${new Date(plan.savedAt).toLocaleString('ja-JP')}${plan.by ? '・' + plan.by : ''}）` : ''; }
  function applyPlan(p) {
    plan = p; $('jk-date').value = p.date;
    groups = p.groups.map(g => ({name: g.name, member: g.member, area: (g.area || '').split('・')[0] || NONE, area2: (g.area || '').split('・')[1] || NONE, count: Math.max(7, g.props.length), props: g.props.map(x => x.key)}));
    // 保存後に空室一覧から外れた建物も、名前だけは表示できるようにする
    p.groups.forEach(g => g.props.forEach(x => { if (!buildings[x.key]) buildings[x.key] = {key: x.key, p: x.p, a: x.a, rooms: [], missing: true}; }));
    renderGroupInputs(); renderCards(); showSaved();
    // 保存済みの班分けを開いたときは、入力欄をたたんで班ごとの表を見やすくする
    $('setup').open = false; summarizeSetup();
  }
  function summarizeSetup() { $('setup-sum').textContent = `${$('jk-date').value || ''}　${groups.map(g => `${g.name}（${areasOf(g).join('・') || 'エリアなし'}）`).join('、')}　— 押すと開きます`; }
  async function loadPast(selected) {
    try {
      const r = await Api.getPatrolPlan();
      $('jk-past').innerHTML = '<option value="">（新規）</option>' + (r.dates || []).map(d => `<option${d === selected ? ' selected' : ''}>${d}</option>`).join('');
      return r;
    } catch (e) { return null; }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (window.Auth) await window.Auth.ready;
      data = await Api.snapshot();
      if (!data.live && !data.vacancies.length) throw new Error(data.error || '空室データを取得できません');
      buildIndex();
      $('notice').textContent = `空室中・退去予定：${Object.keys(buildings).length}物件（${Object.values(buildings).reduce((n, b) => n + b.rooms.length, 0)}部屋）。巡回の記録は、各部屋のボタンから従来どおり行います（巡回日以降に記録した部屋に ✓ が付きます）。`;
      $('notice').className = 'notice subtle';
      const r = await loadPast();
      if (r && r.plan && r.plan.date >= today) applyPlan(r.plan); // これからの巡回日の班分けがあれば表示
      else { $('jk-date').value = today; groups = [{name: 'A班', member: '', area: '長崎中央', area2: NONE, count: 7}, {name: 'B班', member: '', area: '長崎北', area2: NONE, count: 7}, {name: 'C班', member: '', area: '諫早', area2: '大村', count: 7}]; renderGroupInputs(); }
    } catch (e) { $('notice').textContent = '読み込めませんでした：' + e.message; }
    $('jk-addg').addEventListener('click', () => { groups.push({name: `${String.fromCharCode(65 + groups.length)}班`, member: '', area: '長崎中央', area2: NONE, count: 7, props: []}); renderGroupInputs(); if (plan) renderCards(); });
    $('jk-make').addEventListener('click', () => { if (!groups.length) { say('班を追加してください', true); return; } makePlan(); });
    $('jk-save').addEventListener('click', save);
    $('jk-print').addEventListener('click', () => window.print());
    $('jk-date').addEventListener('change', () => { if (plan) renderCards(); });
    $('jk-past').addEventListener('change', async () => {
      const d = $('jk-past').value;
      if (!d) { plan = null; groups.forEach(g => { g.props = []; }); $('jk-cards').innerHTML = ''; $('saved-note').textContent = ''; return; }
      try { const r = await Api.getPatrolPlan(d); if (r.plan) applyPlan(r.plan); } catch (e) { say('読み込めませんでした：' + e.message, true); }
    });
  });
})();
