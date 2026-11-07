(() => {
  'use strict';
  const achievement = (a, t) => Number.isFinite(a) && Number.isFinite(t) && t > 0 ? a / t * 100 : null;
  const parseTarget = v => {
    if (String(v).trim() === '') return null;
    const n = Number(v);
    if (!Number.isSafeInteger(n) || n < 0 || n > 1000000) throw new Error('目標は0〜1,000,000の整数で入力してください');
    return n;
  };
  const splitApplications = a => {
    if (!a || !Number.isSafeInteger(a.total) || a.total < 0 || !a.byKind) return {sub: null, general: null, other: null};
    const entries = Object.entries(a.byKind);
    if (entries.some(([,n]) => !Number.isSafeInteger(n) || n < 0) || entries.reduce((s,[,n]) => s+n,0) !== a.total) return {sub: null, general: null, other: null};
    const sub = a.byKind['サブ'] || 0;
    const general = (a.byKind['一般管理'] || 0) + (a.byKind['セキスイ物件'] || 0);
    return {sub, general, other: a.total - sub - general};
  };
  const combinedTarget = (values, legacy) => {
    if (Number.isFinite(values?.sub) && Number.isFinite(values?.general)) return {value: values.sub + values.general, legacy: false};
    if (values?.sub == null && values?.general == null && Number.isFinite(legacy)) return {value: legacy, legacy: true};
    return {value: null, legacy: false};
  };
  window.PromotionGoalMath = {achievement, parseTarget, splitApplications, combinedTarget};
  const $ = id => document.getElementById(id);
  if (!$('goals-form')) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = n => n.toLocaleString('ja-JP');
  const years = new Map(), drafts = new Map();
  let month = '', year = '', actual = {}, meta = null, generation = 0, saving = false, retry = null;
  const groups = [['sub', 'サブ'], ['general', '一般']];
  const flatten = targets => Object.fromEntries(Object.entries(targets || {}).flatMap(([m,v]) => groups.map(([k]) => [`${m}:${k}`, String(v?.[k] ?? '')])));
  const months = y => Array.from({length: 12}, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
  const fields = () => Array.from($('goals-annual-inputs').querySelectorAll('input'));
  const record = () => years.get(year);
  const message = (s, error = false) => { $('goals-message').textContent = s; $('goals-message').classList.toggle('is-error', error); };
  const controls = () => {
    fields().forEach(i => i.disabled = saving || !record());
    $('goals-save').disabled = saving || !record();
    $('goals-year').disabled = saving; $('goals-reload').disabled = saving; $('promo-month').disabled = saving;
  };
  const stash = () => {
    if (!year || !record()) return;
    const v = Object.fromEntries(fields().map(i => [i.name, i.value]));
    if (Object.entries(flatten(record().targets)).some(([k,s]) => v[k] !== s)) drafts.set(year, v);
    else drafts.delete(year);
  };
  function total() {
    const sums = {sub:0, general:0}; let set = 0;
    try { fields().forEach(i => { const v = parseTarget(i.value); if (v !== null) { sums[i.dataset.group] += v; set++; } }); }
    catch { $('goals-year-total').textContent = '入力値を確認してください'; return; }
    $('goals-year-total').textContent = `年間 サブ ${fmt(sums.sub)}件 ／ 一般 ${fmt(sums.general)}件 · ${set}/24枠設定${drafts.has(year) ? '（未保存）' : ''}`;
  }
  function fill() {
    const v = drafts.get(year) || flatten(record()?.targets);
    $('goals-annual-inputs').innerHTML = months(year).map((m, i) => `<fieldset class="goals-month-input ${m === month ? 'is-current' : ''}"><legend>${i + 1}月${m === month ? ' · 表示中' : ''}</legend>${groups.map(([k,label]) => `<label for="goal-${m}-${k}"><span>${label}</span><span class="goals-input-wrap"><input id="goal-${m}-${k}" name="${m}:${k}" data-group="${k}" type="number" min="0" max="1000000" step="1" inputmode="numeric" placeholder="未設定" value="${esc(v[`${m}:${k}`] ?? '')}"><span>件</span></span></label>`).join('')}${record()?.legacyTotals?.[m] != null ? `<small class="legacy-total">旧合計目標 ${fmt(record().legacyTotals[m])}件（自動配分しません）</small>` : ''}</fieldset>`).join('');
    total(); controls();
  }
  function draw() {
    const r = years.get(month.slice(0, 4));
    $('goals-month').textContent = month ? `${month.slice(0, 4)}年${Number(month.slice(5))}月` : '';
    const renderCard = (label, value, target, summary = false) => {
    const pct = achievement(value, target);
    const actualCount = value;
    const status = !r ? '目標読込待ち' : target == null ? '目標未設定' : target === 0 ? '目標0・達成率対象外' : !Number.isFinite(actualCount) ? '実績読込待ち' : actualCount >= target ? '目標達成' : `あと${fmt(target - actualCount)}件`;
    $('goals-month').textContent = month ? `${month.slice(0, 4)}年${Number(month.slice(5))}月` : '';
    const remaining = Number.isFinite(actualCount) && Number.isFinite(target) && target > 0 ? Math.max(0, target - actualCount) : null;
    const achieved = pct !== null && pct >= 100;
    return `<article class="goal-card${summary ? ' goal-summary' : ''}${achieved ? ' is-achieved' : ''}">
      <div class="goal-card-top"><h3>${label}</h3><span class="goal-status">${esc(achieved ? '✓ 目標達成' : status)}</span></div>
      <dl class="goal-metrics">
        <div class="goal-metric goal-actual"><dt>申込実績</dt><dd>${Number.isFinite(actualCount) ? fmt(actualCount) : '—'}<small>件</small></dd></div>
        <div class="goal-metric"><dt>月の目標</dt><dd>${target == null ? '—' : fmt(target)}<small>件</small></dd></div>
        <div class="goal-metric goal-achievement"><dt>達成率</dt><dd>${pct === null ? '—' : pct.toFixed(1)}${pct === null ? '' : '<small>%</small>'}</dd></div>
      </dl>
      <div class="goal-track" role="img" aria-label="${esc(pct === null ? status : '達成率' + pct.toFixed(1) + '%')}"><span style="width:${pct === null ? 0 : Math.min(100, Math.max(0, pct))}%"></span></div>
      <div class="goal-progress-caption"><span>${achieved ? actualCount === target ? '目標を達成しました' : `目標を${fmt(actualCount - target)}件上回っています` : remaining === null ? esc(status) : `目標まであと <strong>${fmt(remaining)}<small>件</small></strong>`}</span><span>実績 ÷ 目標 × 100</span></div>
    </article>`;
    };
    const combined = combinedTarget(r?.targets[month], r?.legacyTotals?.[month]);
    const note = combined.legacy ? '合計目標は以前登録した値です。サブ・一般の両方を設定すると、その合計に切り替わります。' : '合計目標＝サブ＋一般。両方の目標を設定すると、合計の達成率を表示します。';
    $('goals-cards').innerHTML = renderCard('全体の申込進捗', actual.total, combined.value, true)
      + `<p class="goals-total-note">${esc(note)}</p><section class="goals-breakdown" aria-label="サブ・一般の内訳"><div class="goals-breakdown-heading"><h3>サブ・一般の内訳</h3><span>一般＝一般管理＋セキスイ物件</span></div><div class="goals-breakdown-grid">`
      + groups.map(([key,label]) => renderCard(label, actual[key], r?.targets[month]?.[key])).join('')
      + `</div>${actual.other ? `<p class="goals-total-note">その他・未設定 ${fmt(actual.other)}件は合計に含み、サブ・一般には含めていません。</p>` : ''}</section>`;
    $('goals-updated').textContent = (r?.updatedAt ? `目標更新 ${r.updatedAt.slice(0, 10)} · ${r.updatedBy || '社内利用者'}` : '年間一覧で入力した目標は、保存後に全員へ共有されます。') + (meta?.stale ? ' ／ 実績は前回取得分です。' : '');
  }
  const validate = (r, y) => {
    if (!r || r.schema !== 2 || r.year !== y || !Number.isInteger(r.revision) || !r.targets || months(y).some(m => groups.some(([k]) => r.targets[m]?.[k] !== null && (!Number.isSafeInteger(r.targets[m]?.[k]) || r.targets[m][k] < 0 || r.targets[m][k] > 1000000)))) throw new Error('サブ・一般別の目標機能のGAS反映を確認してください');
    return r;
  };
  async function load(y, discard = false) {
    if (saving) return;
    stash(); year = y; $('goals-year').value = y; retry = null;
    if (discard) drafts.delete(y);
    const ticket = ++generation;
    years.delete(y); fill(); draw(); message(`${y}年の目標を読み込んでいます…`);
    try {
      const r = validate(await window.Api.splitAnnualPromotionGoals(y), y);
      if (ticket !== generation) return;
      years.set(y, r); fill(); draw(); message(drafts.has(y) ? '未保存の入力内容を復元しました。保存するまでは達成率に反映しません。' : '');
    } catch (e) {
      if (ticket !== generation) return;
      if (e.message === '不明な操作です') e.message = 'サブ・一般別目標のGASを本番反映してから再読み込みしてください（旧合計目標は保持しています）';
      if (ticket === generation) { fill(); draw(); message(`目標を取得できませんでした：${e.message}`, true); }
    }
  }
  window.PromotionGoals = {
    setMonth(next) {
      if (saving) return;
      stash(); const different = next !== month; month = next;
      if (different) { actual = {}; meta = null; }
      const y = month.slice(0, 4);
      const options = Array.from({length: 7}, (_, i) => String(Number(y) - 3 + i));
      if (year && !options.includes(year)) options.push(year);
      $('goals-year').innerHTML = options.sort().map(n => `<option value="${n}">${n}年</option>`).join('');
      $('goals-year').value = year || y;
      if (!year || year !== y || !years.has(y)) load(y);
      else { fill(); draw(); }
    },
    setActuals(forMonth, values, source) { if (month === forMonth) { actual = values; meta = source; draw(); } }
  };
  $('goals-annual-inputs').addEventListener('input', () => { stash(); total(); message('未保存の変更があります。12か月分をまとめて保存してください。'); });
  $('goals-year').addEventListener('change', () => load($('goals-year').value));
  $('goals-reload').addEventListener('click', () => {
    if (!year || saving) return;
    if (drafts.has(year) && !window.confirm('この年の未保存の入力を破棄して再読込しますか？')) return;
    load(year, true);
  });
  $('goals-form').addEventListener('submit', async e => {
    e.preventDefault(); if (saving || !record()) return;
    let targets;
    try { targets = Object.fromEntries(months(year).map(m => [m, {}])); fields().forEach(i => { const [m,k] = i.name.split(':'); targets[m][k] = parseTarget(i.value); }); }
    catch (err) { message(err.message, true); return; }
    const body = {year, targets, revision: record().revision}, signature = JSON.stringify(body);
    if (!retry || retry.signature !== signature) retry = {signature, id: window.Api.newId()};
    saving = true; controls(); message(`${year}年の12か月分を保存しています…`);
    try {
      const r = validate(await window.Api.setSplitAnnualPromotionGoals({...body, requestId: retry.id}), year);
      years.set(year, r); drafts.delete(year); retry = null; fill(); draw(); message(`${year}年の12か月分の目標を保存しました。`);
    } catch (err) { message(`保存できませんでした：${err.message}（入力内容は保持しています）`, true); }
    finally { saving = false; controls(); }
  });
  window.addEventListener('beforeunload', e => { if (drafts.size) { e.preventDefault(); e.returnValue = ''; } });
  controls(); draw();
})();
