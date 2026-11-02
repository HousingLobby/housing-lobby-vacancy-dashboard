(() => {
  'use strict';
  const achievement = (a, t) => Number.isFinite(a) && Number.isFinite(t) && t > 0 ? a / t * 100 : null;
  const parseTarget = v => {
    if (String(v).trim() === '') return null;
    const n = Number(v);
    if (!Number.isSafeInteger(n) || n < 0 || n > 1000000) throw new Error('目標は0〜1,000,000の整数で入力してください');
    return n;
  };
  window.PromotionGoalMath = {achievement, parseTarget};
  const $ = id => document.getElementById(id);
  if (!$('goals-form')) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const fmt = n => n.toLocaleString('ja-JP');
  const years = new Map(), drafts = new Map();
  let month = '', year = '', actual = null, meta = null, generation = 0, saving = false, retry = null;
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
    if (months(year).some(m => v[m] !== String(record().targets[m] ?? ''))) drafts.set(year, v);
    else drafts.delete(year);
  };
  function total() {
    let sum = 0, set = 0;
    try { fields().forEach(i => { const v = parseTarget(i.value); if (v !== null) { sum += v; set++; } }); }
    catch { $('goals-year-total').textContent = '入力値を確認してください'; return; }
    $('goals-year-total').textContent = `年間目標 ${fmt(sum)}件 ／ ${set}/12か月設定${drafts.has(year) ? '（未保存）' : ''}`;
  }
  function fill() {
    const v = drafts.get(year) || record()?.targets || {};
    $('goals-annual-inputs').innerHTML = months(year).map((m, i) => `<label for="goal-${m}" class="${m === month ? 'is-current' : ''}"><span>${i + 1}月${m === month ? '<small>表示中</small>' : ''}</span><span class="goals-input-wrap"><input id="goal-${m}" name="${m}" type="number" min="0" max="1000000" step="1" inputmode="numeric" placeholder="未設定" value="${esc(v[m] ?? '')}"><span>件</span></span></label>`).join('');
    total(); controls();
  }
  function draw() {
    const r = years.get(month.slice(0, 4)), target = r?.targets[month], pct = achievement(actual, target);
    const status = !r ? '目標読込待ち' : target == null ? '目標未設定' : target === 0 ? '目標0・達成率対象外' : !Number.isFinite(actual) ? '実績読込待ち' : actual >= target ? '目標達成' : `あと${fmt(target - actual)}件`;
    $('goals-month').textContent = month ? `${month.slice(0, 4)}年${Number(month.slice(5))}月` : '';
    $('goals-cards').innerHTML = `<article class="goal-card${pct !== null && pct >= 100 ? ' is-achieved' : ''}"><div class="goal-card-top"><h3>申込数</h3><span>${esc(status)}</span></div><div class="goal-card-value"><strong>${pct === null ? '—' : pct.toFixed(1)}<small>${pct === null ? '' : '%'}</small></strong><span>達成率</span></div><div class="goal-track" role="img" aria-label="${esc(pct === null ? status : '達成率' + pct.toFixed(1) + '%')}"><span style="width:${pct === null ? 0 : Math.min(100, Math.max(0, pct))}%"></span></div><div class="goal-card-bottom"><span>実績 <b>${Number.isFinite(actual) ? fmt(actual) + '件' : '—'}</b></span><span>目標 <b>${target == null ? '—' : fmt(target) + '件'}</b></span></div><p>申込日ベース · 申込数と成約数を同じ目標として管理</p></article>`;
    $('goals-updated').textContent = (r?.updatedAt ? `目標更新 ${r.updatedAt.slice(0, 10)} · ${r.updatedBy || '社内利用者'}` : '年間一覧で入力した目標は、保存後に全員へ共有されます。') + (meta?.stale ? ' ／ 実績は前回取得分です。' : '');
  }
  const validate = (r, y) => {
    if (!r || r.year !== y || !Number.isInteger(r.revision) || !r.targets || months(y).some(m => r.targets[m] !== null && (!Number.isSafeInteger(r.targets[m]) || r.targets[m] < 0 || r.targets[m] > 1000000))) throw new Error('年間目標機能のGAS反映を確認してください');
    return r;
  };
  async function load(y, discard = false) {
    if (saving) return;
    stash(); year = y; $('goals-year').value = y; retry = null;
    if (discard) drafts.delete(y);
    const ticket = ++generation;
    years.delete(y); fill(); draw(); message(`${y}年の目標を読み込んでいます…`);
    try {
      const r = validate(await window.Api.annualPromotionGoals(y), y);
      if (ticket !== generation) return;
      years.set(y, r); fill(); draw(); message(drafts.has(y) ? '未保存の入力内容を復元しました。保存するまでは達成率に反映しません。' : '');
    } catch (e) { if (ticket === generation) { fill(); draw(); message(`目標を取得できませんでした：${e.message}`, true); } }
  }
  window.PromotionGoals = {
    setMonth(next) {
      if (saving) return;
      stash(); const different = next !== month; month = next;
      if (different) { actual = null; meta = null; }
      const y = month.slice(0, 4);
      const options = Array.from({length: 7}, (_, i) => String(Number(y) - 3 + i));
      if (year && !options.includes(year)) options.push(year);
      $('goals-year').innerHTML = options.sort().map(n => `<option value="${n}">${n}年</option>`).join('');
      $('goals-year').value = year || y;
      if (!year || year !== y) load(y);
      else { fill(); draw(); }
    },
    setActuals(forMonth, values, source) { if (month === forMonth) { actual = values.application; meta = source; draw(); } }
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
    try { targets = Object.fromEntries(fields().map(i => [i.name, parseTarget(i.value)])); }
    catch (err) { message(err.message, true); return; }
    const body = {year, targets, revision: record().revision}, signature = JSON.stringify(body);
    if (!retry || retry.signature !== signature) retry = {signature, id: window.Api.newId()};
    saving = true; controls(); message(`${year}年の12か月分を保存しています…`);
    try {
      const r = validate(await window.Api.setAnnualPromotionGoals({...body, requestId: retry.id}), year);
      years.set(year, r); drafts.delete(year); retry = null; fill(); draw(); message(`${year}年の12か月分の目標を保存しました。`);
    } catch (err) { message(`保存できませんでした：${err.message}（入力内容は保持しています）`, true); }
    finally { saving = false; controls(); }
  });
  window.addEventListener('beforeunload', e => { if (drafts.size) { e.preventDefault(); e.returnValue = ''; } });
  controls(); draw();
})();
