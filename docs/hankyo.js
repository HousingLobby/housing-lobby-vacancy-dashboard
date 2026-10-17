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

  // 反響データ確認（JDSからの取り込み依頼）
  let pollTimer = null;
  function renderLast(l) {
    const fmt = iso => iso ? new Date(iso).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '未確認';
    $('check-last').innerHTML = `<span class="badge ${l.B ? 'good' : 'warn'}">長崎店：${fmt(l.B)}</span> <span class="badge ${l.A ? 'good' : 'warn'}">県央店（諫早）：${fmt(l.A)}</span>`;
  }
  function renderCheck(c) {
    const el = $('check-status'), btn = $('check-btn');
    if (!c) { el.textContent = ''; el.className = 'save-message'; btn.disabled = false; return; }
    const t = c.at ? new Date(c.at).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '';
    const busy = c.state === '依頼中' || c.state === '実行中';
    btn.disabled = busy;
    const text = {'依頼中': '依頼しました。Macで「反響データ確認」を実行すると取り込まれます', '実行中': 'JDSから取り込み中…', '完了': `${t} ${({A: '県央店（諫早）', B: '長崎店'})[c.store] || ''}を確認しました（新規${c.added || 0}件・更新${c.updated || 0}件）`, '失敗': `${t} 取り込めませんでした：${c.message || '原因不明'}`}[c.state] || '';
    el.textContent = text; el.className = 'save-message' + (c.state === '失敗' ? ' error' : '');
    clearTimeout(pollTimer);
    if (busy) pollTimer = setTimeout(pollCheck, 10000);
  }
  async function pollCheck() {
    try { const prev = $('check-status').textContent; const r = await Api.hankyoCheckStatus(); renderCheck(r.check); if (r.check && r.check.state === '完了') { list = null; await loadList(); } } catch (e) { pollTimer = setTimeout(pollCheck, 20000); }
  }

  async function loadList() {
    try {
      list = await Api.hankyoList();
      $('keep-note').textContent = `お客様の情報は受付日から${list.keepDays}日保存`;
      renderCounts(); renderList(); renderCheck(list.check); renderLast(list.lastChecked || {}); showError('');
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

  // 各PCのブラウザでJDSを読み取った結果を受け取り、登録する（JDSのページのブックマークから開かれる）
  let importing = false;
  async function runImport() {
    if (importing) return; importing = true;
    $('list-view').hidden = true; $('detail-view').hidden = true; $('import-view').hidden = false;
    const st = $('import-status'), say = (t, err) => { st.textContent = t; st.className = 'save-message' + (err ? ' error' : ''); };
    $('back-link').textContent = '← 反響対応の一覧に戻る'; $('back-link').href = '#';
    if (!window.opener) { say('JDSの画面のブックマークから開いてください（このタブを直接開いても取り込めません）', true); importing = false; return; }
    const got = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('JDSから応答がありません。JDSのタブでもう一度ブックマークを押してください')), 90000);
      window.addEventListener('message', e => { if (e.origin === 'https://jds.suumo.jp' && e.data && (e.data.type === 'hankyo-items' || e.data.type === 'hankyo-error')) { clearTimeout(t); resolve(e.data); } });
    });
    try { window.opener.postMessage({type: 'hankyo-ready'}, 'https://jds.suumo.jp'); } catch (e) {}
    try {
      const msg = await got;
      if (msg.type === 'hankyo-error') throw new Error(msg.message);
      say(`JDSから${msg.items.length}件を読み取りました。登録しています…`);
      const r = await Api.hankyoImport({items: msg.items, store: msg.store});
      const store = {A: '県央店（諫早）', B: '長崎店'}[msg.store] || '';
      say(`${store}：JDSの${msg.items.length}件のうち、新規${r.added}件を取り込みました（残り${Math.max(0, msg.items.length - r.added)}件は、すでに登録済みか、読み取れなかったためそのままです）。`);
      $('import-done').hidden = false; list = null;
    } catch (e) { say('取り込めませんでした：' + e.message, true); }
    importing = false;
  }

  async function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id === 'import') { runImport(); return; }
    $('import-view').hidden = true;
    $('list-view').hidden = Boolean(id); $('detail-view').hidden = !id;
    $('back-link').textContent = id ? '← 反響対応の一覧に戻る' : '← ダッシュボードに戻る';
    $('back-link').href = id ? '#' : 'index.html';
    showError('');
    if (!id) { if (!list) await loadList(); return; }
    if (!list) await loadList();
    try { renderDetail(await Api.hankyoGet(id)); } catch (e) { showError(e.message); }
  }

  async function save(patch, msg) {
    const say = (t, err) => { for (const id of ['d-message', 'd-top-message']) { $(id).textContent = t; $(id).className = 'save-message' + (err ? ' error' : ''); } };
    say('保存しています…');
    try { await Api.hankyoUpdate({id: current.id, ...patch}); Object.assign(current, patch.reply !== undefined ? {reply: patch.reply} : {}, patch.state ? {state: patch.state} : {}); say(msg); list = null; return true; }
    catch (e) { say('保存できませんでした：' + e.message, true); return false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('state-filter').addEventListener('change', () => list && renderList());
    $('search').addEventListener('input', () => list && renderList());
    $('d-subject-copy').addEventListener('click', e => copyText($('d-subject').textContent, e.currentTarget));
    $('check-btn').addEventListener('click', async () => { try { $('check-btn').disabled = true; const r = await Api.hankyoCheckRequest(); renderCheck(r.check); } catch (e) { $('check-btn').disabled = false; $('check-status').textContent = '依頼できませんでした：' + e.message; $('check-status').className = 'save-message error'; } });
    $('import-done').addEventListener('click', () => { location.hash = ''; });
    $('d-copy').addEventListener('click', e => copyText($('d-reply').value, e.currentTarget));
    $('d-save').addEventListener('click', () => save({reply: $('d-reply').value}, '手直しを保存しました'));
    $('d-toggle').addEventListener('click', async () => { const next = current.state === '返信済' ? '未返信' : '返信済'; if (await save({state: next}, `「${next}」にしました`)) renderDetail({...current, state: next}); });
    $('back-link').addEventListener('click', e => { if (location.hash) { e.preventDefault(); location.hash = ''; } });
    window.addEventListener('hashchange', route);
    (window.Auth ? window.Auth.ready : Promise.resolve()).then(route);
  });
})();
