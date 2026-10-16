(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STORE = {A: '諫早店', B: '長崎店'};
  let list = null, current = null;

  const showError = msg => { const e = $('error'); e.textContent = msg; e.hidden = !msg; };
  const copyText = async (text, btn) => {
    try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
    const old = btn.textContent; btn.textContent = 'コピーしました'; setTimeout(() => { btn.textContent = old; }, 1500);
  };
  const monthLabel = ym => `${ym.slice(0, 4)}年${Number(ym.slice(5))}月`;

  function renderCounts() {
    const c = list.counts || {}, months = Object.keys(c).sort().reverse().slice(0, 6);
    const nowYm = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
    if (!months.includes(nowYm)) months.unshift(nowYm);
    $('counts').innerHTML = months.slice(0, 6).map(ym => {
      const x = c[ym] || {t: 0, A: 0, B: 0};
      return `<div class="hk-count ${ym === nowYm ? 'now' : ''}"><span>${monthLabel(ym)}${ym === nowYm ? '（今月）' : ''}</span><strong>${x.t}件</strong><small>諫早店 ${x.A || 0}・長崎店 ${x.B || 0}</small></div>`;
    }).join('');
  }

  function renderList() {
    const st = $('state-filter').value, q = $('search').value.trim().toLowerCase();
    const rows = list.items.filter(r => (st === 'all' || r.state === st) && (!q || `${r.name} ${r.property} ${r.room}`.toLowerCase().includes(q)));
    $('list-count').textContent = `${rows.length}件（保存中 ${list.items.length}件）`;
    $('list-body').innerHTML = rows.length ? rows.map(r => `<tr class="hk-row"><td>${esc(r.date)}</td><td><a href="#${encodeURIComponent(r.id)}">${esc(r.name || '（名前なし）')}</a></td><td>${esc(r.property)} ${esc(r.room)}</td><td>${esc(STORE[r.store] || r.store)}</td><td>${r.hasReply ? '<span class="badge good">あり</span>' : '<span class="badge muted">なし</span>'}</td><td><span class="badge ${r.state === '返信済' ? 'good' : 'warn'}">${esc(r.state)}</span></td></tr>`).join('') : '<tr><td colspan="6" class="empty">該当する反響はありません</td></tr>';
    document.querySelectorAll('.hk-row').forEach(tr => tr.addEventListener('click', e => { if (e.target.tagName !== 'A') location.hash = tr.querySelector('a').getAttribute('href'); }));
  }

  async function loadList() {
    try {
      list = await Api.hankyoList();
      $('keep-note').textContent = `お客様の情報は受付日から${list.keepDays}日保存`;
      renderCounts(); renderList(); showError('');
    } catch (e) { showError('反響の一覧を取得できませんでした：' + e.message); }
  }

  function renderDetail(d) {
    current = d;
    $('d-title').textContent = d.name || '（名前なし）';
    $('d-sub').textContent = `${d.date} 受付｜${STORE[d.store] || d.store || ''}`;
    $('d-state').innerHTML = `<span class="badge ${d.state === '返信済' ? 'good' : 'warn'}">${esc(d.state)}</span>`;
    $('d-toggle').textContent = d.state === '返信済' ? '未返信に戻す' : '返信済にする';
    const row = (k, v, copy) => v ? `<dt>${k}</dt><dd>${esc(v)}${copy ? `<button type="button" class="copy-mini" data-copy="${esc(v)}">コピー</button>` : ''}</dd>` : '';
    $('d-dl').innerHTML = row('お問い合わせ物件', `${d.property} ${d.room}`.trim()) + row('現況', d.status) + (d.lp ? `<dt>LP</dt><dd><a href="${esc(d.lp)}" target="_blank" rel="noopener noreferrer">${esc(d.lp)}</a><button type="button" class="copy-mini" data-copy="${esc(d.lp)}">コピー</button></dd>` : '') + row('メール', d.email, true) + row('電話', d.tel, true);
    $('d-dl').querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copyText(b.dataset.copy, b)));
    $('d-subject').textContent = d.subject || '（件名の記録なし）';
    $('d-subject-copy').hidden = !d.subject;
    $('d-msg').textContent = d.message || '（内容の記録なし）';
    $('d-reply').value = d.reply || '';
    $('d-message').textContent = '';
    $('d-expire').textContent = `この記録は ${d.expire} に自動削除されます（受付日から${list ? list.keepDays : 40}日）。`;
  }

  async function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    $('list-view').hidden = Boolean(id); $('detail-view').hidden = !id;
    $('back-link').textContent = id ? '← 反響対応の一覧に戻る' : '← ダッシュボードに戻る';
    $('back-link').href = id ? '#' : 'index.html';
    showError('');
    if (!id) { if (!list) await loadList(); return; }
    if (!list) await loadList();
    try { renderDetail(await Api.hankyoGet(id)); } catch (e) { showError(e.message); }
  }

  async function save(patch, msg) {
    try { await Api.hankyoUpdate({id: current.id, ...patch}); Object.assign(current, patch.reply !== undefined ? {reply: patch.reply} : {}, patch.state ? {state: patch.state} : {}); $('d-message').textContent = msg; $('d-message').className = 'save-message'; list = null; return true; }
    catch (e) { $('d-message').textContent = '保存できませんでした：' + e.message; $('d-message').className = 'save-message error'; return false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('state-filter').addEventListener('change', () => list && renderList());
    $('search').addEventListener('input', () => list && renderList());
    $('d-subject-copy').addEventListener('click', e => copyText($('d-subject').textContent, e.currentTarget));
    $('d-copy').addEventListener('click', e => copyText($('d-reply').value, e.currentTarget));
    $('d-save').addEventListener('click', () => save({reply: $('d-reply').value}, '手直しを保存しました'));
    $('d-toggle').addEventListener('click', async () => { const next = current.state === '返信済' ? '未返信' : '返信済'; if (await save({state: next}, `「${next}」にしました`)) renderDetail({...current, state: next}); });
    $('back-link').addEventListener('click', e => { if (location.hash) { e.preventDefault(); location.hash = ''; } });
    window.addEventListener('hashchange', route);
    (window.Auth ? window.Auth.ready : Promise.resolve()).then(route);
  });
})();
