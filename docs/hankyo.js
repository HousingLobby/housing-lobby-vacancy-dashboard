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


  // 月末集計（ボタン→Macのワーカーが集計→結果を表示）
  let meTimer = null;
  const pct = v => v == null ? '―' : (Math.round(v * 1000) / 10) + '%';
  const meFmt = iso => iso ? new Date(iso).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '';
  function initMonthSelect() {
    const now = new Date(Date.now() + 9 * 3600e3), opts = [];
    for (let i = 0; i < 4; i++) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); opts.push(d.toISOString().slice(0, 7)); }
    $('me-month').innerHTML = opts.map((ym, i) => `<option value="${ym}">${monthLabel(ym)}${i === 0 ? '（今月）' : i === 1 ? '（先月）' : ''}</option>`).join('');
    $('me-month').value = now.getUTCDate() <= 10 ? opts[1] : opts[0]; // 月初は先月分、それ以外は今月分
  }
  function missList(rows, cols) {
    if (!rows || !rows.length) return '<p class="save-message" style="margin:4px 0">漏れ候補はありません</p>';
    return `<div class="table-scroll"><table class="list-table"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(r[c[1]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function renderMeResult(r) {
    const box = $('me-result');
    if (!r) { box.hidden = true; return; }
    const kpi = (l, v, sm) => `<div class="hk-count"><span>${l}</span><strong>${v}</strong>${sm ? `<small>${sm}</small>` : ''}</div>`;
    const su = r.suumo || {}, dk = r.dohkou || {};
    const sMiss = (r.suumoMissing || []).length, dMiss = (r.dohkouMissing || []).length;
    box.innerHTML = `<h3 style="margin:18px 0 8px">${monthLabel(r.month)}の集計 <small style="font-weight:400;color:#697d8b">（${meFmt(r.at)} 時点）</small></h3>
      <div class="hk-counts">${kpi('反響（広義）', (r.total ?? '―') + '件', `反響${r.hankyo ?? 0}＋かってに内見${r.katteni ?? 0}`)}${kpi('内見率', pct(r.naikenRate), `内見${r.naiken ?? 0}件`)}${kpi('成約率', pct(r.seiyakuRate), `申込${r.moushikomi ?? 0}件`)}${kpi('内見からの成約率', pct(r.naikenSeiyakuRate))}${kpi('仲介同行（別軸）', (dk.n ?? 0) + '件', `申込${dk.moushikomi ?? 0}件`)}</div>
      <h4 style="margin:14px 0 6px">反響経由（広義）</h4><p style="margin:0">${(r.byKeiyu || []).map(x => `${esc(x[0])} ${x[1]}件`).join('・') || '―'}</p>
      <h4 style="margin:16px 0 6px">SUUMO登録漏れの確認 <span class="badge ${sMiss ? 'warn' : 'good'}">${sMiss ? `漏れ候補 ${sMiss}件` : '漏れなし'}</span></h4>
      <p class="footnote" style="margin:0 0 6px">JDS取り込み済み ${su.jds ?? '―'}件／Asana登録 ${su.asana ?? '―'}件</p>
      ${missList(r.suumoMissing, [['受付日', 'd'], ['お客様', 'n'], ['物件', 'p'], ['店舗', 's']])}${r.suumoMissingCut ? '<p class="footnote">※一部のみ表示</p>' : ''}
      <h4 style="margin:16px 0 6px">仲介同行の確認 <span class="badge ${dMiss ? 'warn' : 'good'}">${dMiss ? `未登録候補 ${dMiss}件` : '漏れなし'}</span></h4>
      <p class="footnote" style="margin:0 0 6px">Teams報告 ${r.dohkouTeams ?? '―'}件／Asana登録 ${r.dohkouAsana ?? '―'}件</p>
      ${missList(r.dohkouMissing, [['内見日', 'd'], ['業者', 'v'], ['物件・号室', 'p']])}${r.dohkouMissingCut ? '<p class="footnote">※一部のみ表示</p>' : ''}
      ${(r.notes || []).length ? `<ul class="footnote" style="margin:12px 0 0">${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`;
    box.hidden = false;
  }
  function renderMe(res) {
    const c = res.monthEnd, el = $('me-status'), btn = $('me-btn');
    const fmt = iso => iso ? new Date(iso).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '未確認';
    const l = res.lastChecked || {};
    $('me-last').innerHTML = `<span class="badge ${l.B ? 'good' : 'warn'}">JDS取り込み 長崎店：${fmt(l.B)}</span> <span class="badge ${l.A ? 'good' : 'warn'}">県央店（諫早）：${fmt(l.A)}</span>`;
    const busy = c && (c.state === '依頼中' || c.state === '実行中');
    btn.disabled = Boolean(busy);
    const t = c && c.at ? meFmt(c.at) : '';
    const text = !c ? '' : {'依頼中': `${monthLabel(c.month)}分を依頼しました。Macの処理が始まるのを待っています…`, '実行中': `${monthLabel(c.month)}分を集計中…（数分かかります）`, '完了': `${t} ${monthLabel(c.month)}分の集計が終わりました`, '失敗': `${t} 集計できませんでした：${c.message || '原因不明'}`}[c.state] || '';
    el.textContent = text; el.className = 'save-message' + (c && c.state === '失敗' ? ' error' : '');
    renderMeResult(busy ? null : res.result);
    clearTimeout(meTimer);
    if (busy) meTimer = setTimeout(pollMe, 10000);
  }
  async function pollMe() { try { renderMe(await Api.monthEndStatus()); } catch (e) { meTimer = setTimeout(pollMe, 20000); } }

  async function loadList() {
    try {
      list = await Api.hankyoList();
      $('keep-note').textContent = `お客様の情報は受付日から${list.keepDays}日保存`;
      renderCounts(); renderList(); renderCheck(list.check); renderLast(list.lastChecked || {}); showError(''); pollMe();
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
    fillTplForm(d); clearTimeout(lpTimer); lpFor = null; $('tpl-lp-state').textContent = '';
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

  // 返信文のテンプレート（/suumo スキルと同じ文面）。空室かどうかは担当者がリアプロBBで確認して選ぶ
  const SIGN = ['◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆', '〒850-0004', '長崎県長崎市下西山町1-5', '株式会社ハウジングロビー', 'TEL | 095-893-5056', 'FAX | 095-893-5057', 'https://www.h-lobby.jp/', '◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆＊◆'].join('\n');
  const LINE = 'https://line.me/R/ti/p/@291ytred';
  const splitRoom = prop => { const m = String(prop || '').match(/^(.*?)\s*([0-9０-９]{2,4})$/); return m ? {prop: m[1], room: m[2]} : {prop: String(prop || ''), room: ''}; };
  const mdOf = iso => { const [y, mo, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, mo - 1, d + 2)); return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`; };
  function makeReply(k) {
    const name = (current.name || 'お客様').replace(/様\s*$/, '') + '様';
    const prop = k.prop.trim(), room = k.room.trim(), roomTxt = room ? `${room}号室` : '';
    const head = `${name}\n\nはじめまして！株式会社ハウジングロビーです。\n\nこの度はSUUMOより\n【${prop}】${roomTxt}へお問い合わせありがとうございます！`;
    if (k.kind === 'no') {
      return `${head}\n\n誠に申し訳ございませんが、こちらの物件につきましては、\n他のお客様よりお申込が入ったため、ご紹介が出来かねる状況です。\n${k.other.trim() ? '\n' + k.other.trim() + '\n' : ''}\n今お探しの条件などをお知らせいただけますと、他の物件もご紹介可能です！\nお気軽にご相談ください。\n\n他の物件をご希望の場合は、以下URLの弊社公式LINEよりお問い合わせください。\n${LINE}\n\n是非よろしくお願いします！\n\n${SIGN}`;
    }
    const state = k.kind === 'soon' ? `こちらのお部屋は現在入居中のため、ご内見可能時期は${k.date ? mdOf(k.date) : '○/○'}以降となります。` : 'こちら現在空室となっております。';
    const lp = k.lp.trim() ? `\nお部屋の写真や周辺環境は、こちらのページでもご覧いただけます！\n${k.lp.trim()}\n` : '';
    return `${head}\n${state}\n物件の資料をお送りいたしますのでご確認くださいませ。\n${lp}\n★内見予約の受付は公式LINEにて行っております。（当社管理物件のみ）\n弊社ではお客様のみでお部屋を見ていただく“かってに内見（セルフ内見）”\nを行っております。\n\nかってに内見ご利用で【仲介手数料が50％off！】となっております。\n※3分程度の簡単なアンケートにご回答いただくことが条件です。\n\nかってに内見のご登録はコチラから！\n　　　　　↓ ↓ ↓\n${LINE}\n（利用時間：9:00〜18:00）\n\n是非よろしくお願いします！\n\n${SIGN}`;
  }
  function fillTplForm(d) {
    const sp = d.room ? {prop: d.property, room: d.room} : splitRoom(d.property);
    $('tpl-prop').value = sp.prop; $('tpl-room').value = sp.room; $('tpl-lp').value = d.lp || ''; $('tpl-other').value = ''; $('tpl-date').value = '';
    $('tpl-kind').value = /申込|募集終了|紹介不可/.test(d.status || '') ? 'no' : /解約予定/.test(d.status || '') ? 'soon' : 'vacant';
    syncTplKind();
  }
  // 物件LPの自動作成：空室一覧の部屋（Asanaタスク）を物件名＋号室で探し、LP作成の待ち行列に依頼する（作成はMacの処理）
  const nz = s => String(s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  let vacCache = null, lpTimer = null, lpFor = null;
  async function findRoomTask(prop, room) {
    if (!vacCache) vacCache = (await Api.snapshot()).vacancies || [];
    return vacCache.filter(v => nz(v.p) === nz(prop) && nz(v.r) === nz(room));
  }
  const lpSay = (t, err) => { $('tpl-lp-state').textContent = t; $('tpl-lp-state').className = 'save-message' + (err ? ' error' : ''); };
  async function ensureLp(k) {
    const hits = await findRoomTask(k.prop, k.room);
    if (hits.length !== 1) { lpSay(hits.length ? '同じ部屋が複数あり、LPを自動で依頼できません。部屋ページから依頼してください' : '空室一覧に該当の部屋が見つからないため、LPを自動で依頼できません（LPなしで作成しました）', true); return; }
    const task = hits[0].id; lpFor = {task, id: current.id};
    let st = await Api.lpStatus(task);
    if (st.state === 'none' || st.state === '失敗') st = await Api.lpRequest({task, passcode: Api.prefs.get().passcode || ''});
    watchLp(st, k);
  }
  function watchLp(st, k) {
    clearTimeout(lpTimer);
    if (!lpFor || lpFor.id !== current.id) return; // 別のお客様に移った
    if (st.state === '完了' && st.url) {
      $('tpl-lp').value = st.url;
      // 返信文が手直しされていなければ、URL入りで作り直す
      if ($('d-reply').value === makeReply({...k, lp: ''})) { $('d-reply').value = makeReply({...k, lp: st.url}); lpSay('物件LPができました。URLを返信文に入れました。内容を確認して「手直しを保存」を押してください'); }
      else lpSay('物件LPができました：' + st.url + '（返信文を手直し済みのため、URLは自動で入れていません）');
      return;
    }
    if (st.state === '失敗') { lpSay('LPを作成できませんでした：' + (st.message || '原因不明'), true); return; }
    lpSay(st.state === '作成中' ? '物件LPを作成しています…（数分〜十数分。このページを開いたままにすると、できたら自動でURLが入ります）' : '物件LPの作成を依頼しました。Macの処理が始まるのを待っています…');
    lpTimer = setTimeout(async () => { try { watchLp(await Api.lpStatus(lpFor.task), k); } catch (e) { lpTimer = setTimeout(() => watchLp(st, k), 30000); } }, 20000);
  }
  function syncTplKind() { const k = $('tpl-kind').value; $('tpl-date-wrap').hidden = k !== 'soon'; $('tpl-other-wrap').hidden = k !== 'no'; }

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
    initMonthSelect();
    $('me-btn').addEventListener('click', async () => { try { $('me-btn').disabled = true; const r = await Api.monthEndRequest($('me-month').value); renderMe({monthEnd: r.monthEnd, lastChecked: (list && list.lastChecked) || {}, result: null}); pollMe(); } catch (e) { $('me-btn').disabled = false; $('me-status').textContent = '依頼できませんでした：' + e.message; $('me-status').className = 'save-message error'; } });
    $('tpl-kind').addEventListener('change', syncTplKind);
    $('tpl-make').addEventListener('click', () => {
      const k = {kind: $('tpl-kind').value, prop: $('tpl-prop').value, room: $('tpl-room').value, date: $('tpl-date').value, lp: $('tpl-lp').value, other: $('tpl-other').value};
      if (!k.prop.trim()) { $('d-message').textContent = '物件名を入れてください'; $('d-message').className = 'save-message error'; return; }
      if (k.kind === 'soon' && !k.date) { $('d-message').textContent = '解約日を入れてください（内見可能日は、解約日の2日後で入ります）'; $('d-message').className = 'save-message error'; return; }
      $('d-reply').value = makeReply(k);
      lpSay('');
      if (k.kind !== 'no' && !k.lp.trim()) ensureLp(k).catch(e => lpSay('LPの依頼に失敗しました：' + e.message, true));
      $('d-message').textContent = '返信文を作りました。内容を確認して、「手直しを保存」を押してください'; $('d-message').className = 'save-message';
    });
    $('import-done').addEventListener('click', () => { location.hash = ''; });
    $('d-copy').addEventListener('click', e => copyText($('d-reply').value, e.currentTarget));
    $('d-save').addEventListener('click', () => save({reply: $('d-reply').value}, '手直しを保存しました'));
    $('d-toggle').addEventListener('click', async () => { const next = current.state === '返信済' ? '未返信' : '返信済'; if (await save({state: next}, `「${next}」にしました`)) renderDetail({...current, state: next}); });
    $('back-link').addEventListener('click', e => { if (location.hash) { e.preventDefault(); location.hash = ''; } });
    window.addEventListener('hashchange', route);
    (window.Auth ? window.Auth.ready : Promise.resolve()).then(route);
  });
})();
