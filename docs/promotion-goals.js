(() => {
  'use strict';
  const metrics = [
    {key: 'response', label: '総反響数', unit: '人', note: '既存の反響人数基準'},
    {key: 'application', label: '申込数', unit: '件', note: '申込日ベース'},
    {key: 'contract', label: '成約数', unit: '件', note: '実績の集計は未連携'}
  ];
  const achievement = (actual, target) => Number.isFinite(actual) && Number.isFinite(target) && target > 0 ? actual / target * 100 : null;
  const parseTarget = value => {
    if (String(value).trim() === '') return null;
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0 || n > 1000000) throw new Error('目標は0〜1,000,000の整数で入力してください');
    return n;
  };
  window.PromotionGoalMath = {achievement, parseTarget};
  const el = id => document.getElementById(id);
  if (!el('goals-form')) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = n => n.toLocaleString('ja-JP');
  const labelMonth = m => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;
  const drafts = new Map();
  let month = '', record = null, actuals = {}, actualMeta = null, generation = 0, saving = false, retry = null;
  const message = (text, error = false) => { el('goals-message').textContent = text; el('goals-message').classList.toggle('is-error', error); };
  const inputs = () => metrics.map(m => el('goal-' + m.key));
  const editable = enabled => { inputs().forEach(i => { i.disabled = !enabled; }); el('goals-save').disabled = !enabled; };
  const stash = () => {
    if (!month || !record) return;
    const values = Object.fromEntries(metrics.map(m => [m.key, el('goal-' + m.key).value]));
    if (metrics.some(m => values[m.key] !== String(record.targets[m.key] ?? ''))) drafts.set(month, values);
    else drafts.delete(month);
  };
  const fill = () => {
    const values = drafts.get(month) || record?.targets || {};
    metrics.forEach(m => { el('goal-' + m.key).value = values[m.key] ?? ''; });
  };
  function draw() {
    el('goals-month').textContent = month ? labelMonth(month) : '';
    el('goals-editor-month').textContent = month ? `${labelMonth(month)}の目標を設定` : '対象月を選んでください';
    el('goals-cards').innerHTML = metrics.map(m => {
      const target = record?.targets[m.key], actual = actuals[m.key];
      const pct = achievement(actual, target);
      const status = !record ? '目標読込待ち' : target == null ? '目標未設定' : target === 0 ? '目標0・達成率対象外' : !Number.isFinite(actual) ? (m.key === 'contract' ? '実績未連携' : '実績読込待ち') : actual >= target ? '目標達成' : `あと${fmt(Math.max(0, target - actual))}${m.unit}`;
      return `<article class="goal-card${pct >= 100 && pct !== null ? ' is-achieved' : ''}"><div class="goal-card-top"><h3>${m.label}</h3><span>${esc(status)}</span></div><div class="goal-card-value"><strong>${pct === null ? '—' : pct.toFixed(1)}<small>${pct === null ? '' : '%'}</small></strong><span>達成率</span></div><div class="goal-track" role="img" aria-label="${esc(m.label + ' ' + (pct === null ? status : '達成率' + pct.toFixed(1) + '%'))}"><span style="width:${pct === null ? 0 : Math.min(100, Math.max(0, pct))}%"></span></div><div class="goal-card-bottom"><span>実績 <b>${Number.isFinite(actual) ? fmt(actual) + m.unit : '—'}</b></span><span>目標 <b>${target == null ? '—' : fmt(target) + m.unit}</b></span></div><p>${esc(m.note)}</p></article>`;
    }).join('');
    el('goals-updated').textContent = record?.updatedAt ? `目標更新 ${new Intl.DateTimeFormat('ja-JP', {timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short'}).format(new Date(record.updatedAt))} · ${record.updatedBy || '管理者'}${actualMeta?.stale ? ' ／ 実績は前回取得分です' : ''}` : (actualMeta?.stale ? '実績は前回取得分です。最新値ではありません。' : '目標は月ごとに保存され、他の端末にも共有されます。');
  }
  const validateRecord = (data, expectedMonth) => {
    if (!data || data.month !== expectedMonth || !Number.isInteger(data.revision) || !data.targets || metrics.some(m => data.targets[m.key] !== null && (!Number.isSafeInteger(data.targets[m.key]) || data.targets[m.key] < 0))) throw new Error('目標機能のGAS反映を確認してください');
    return data;
  };
  async function load(discard = false) {
    const requestedMonth = month, token = ++generation;
    if (discard) drafts.delete(month);
    editable(false); message('目標を読み込んでいます…');
    try {
      const data = validateRecord(await window.Api.promotionGoals(requestedMonth), requestedMonth);
      if (token !== generation || month !== requestedMonth) return;
      record = data; fill(); editable(true); message(drafts.has(month) ? '未保存の入力内容を復元しました。保存するまでは達成率に反映しません。' : '');
    } catch (err) {
      if (token !== generation || month !== requestedMonth) return;
      record = null; editable(false); message(`目標を取得できませんでした：${err.message}`, true);
    }
    draw();
  }
  window.PromotionGoals = {
    setMonth(next) {
      if (saving) return;
      stash(); const changed = month !== next;
      month = next; record = null;
      if (changed) { actuals = {}; actualMeta = null; el('goal-passcode').value = ''; }
      fill(); draw(); load();
    },
    setActuals(forMonth, values, meta) { if (forMonth !== month) return; actuals = values; actualMeta = meta; draw(); }
  };
  inputs().forEach(i => i.addEventListener('input', () => { stash(); message('未保存の変更があります。'); }));
  el('goals-reload').addEventListener('click', () => {
    if (saving || !month) return;
    if (drafts.has(month) && !window.confirm('入力内容を破棄して、保存済みの目標を読み込みますか？')) return;
    load(true);
  });
  el('goals-form').addEventListener('submit', async e => {
    e.preventDefault(); if (saving || !record) return;
    const forMonth = month;
    let targets;
    try { targets = Object.fromEntries(metrics.map(m => [m.key, parseTarget(el('goal-' + m.key).value)])); }
    catch (err) { message(err.message, true); return; }
    const signature = JSON.stringify([forMonth, record.revision, targets]);
    if (!retry || retry.signature !== signature) retry = {signature, id: window.Api.newId()};
    saving = true; editable(false); el('promo-month').disabled = true; el('goals-reload').disabled = true;
    const passcode = el('goal-passcode').value; el('goal-passcode').value = '';
    message(`${labelMonth(forMonth)}の目標を保存しています…`);
    try {
      record = validateRecord(await window.Api.setPromotionGoals({month: forMonth, targets, revision: record.revision, requestId: retry.id, passcode}), forMonth);
      drafts.delete(forMonth); retry = null; fill(); draw(); message(`${labelMonth(forMonth)}の目標を保存しました。`);
    } catch (err) { message(`保存できませんでした：${err.message}（入力内容は保持しています）`, true); }
    finally { saving = false; editable(Boolean(record)); el('promo-month').disabled = false; el('goals-reload').disabled = false; }
  });
  editable(false); draw();
})();
