(() => {
  'use strict';
  // 月末集計（ボタン→Macのワーカーが集計→結果を表示）。反響対応・入居促進の両ページで共用する
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthLabel = ym => `${ym.slice(0, 4)}年${Number(ym.slice(5))}月`;
  const pct = v => v == null ? '―' : (Math.round(v * 1000) / 10) + '%';
  const fmt = iso => iso ? new Date(iso).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '未確認';

  function missList(rows, cols) {
    if (!rows || !rows.length) return '<p class="save-message" style="margin:4px 0">漏れ候補はありません</p>';
    return `<div class="table-scroll"><table class="list-table"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${esc(r[c[1]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderResult(box, r) {
    if (!r) { box.hidden = true; return; }
    const kpi = (l, v, sm) => `<div class="hk-count"><span>${l}</span><strong>${v}</strong>${sm ? `<small>${sm}</small>` : ''}</div>`;
    const su = r.suumo || {}, dk = r.dohkou || {};
    const sMiss = (r.suumoMissing || []).length, dMiss = (r.dohkouMissing || []).length;
    box.innerHTML = `<h3 style="margin:18px 0 8px">${monthLabel(r.month)}の集計 <small style="font-weight:400;color:#697d8b">（${fmt(r.at)} 時点）</small></h3>
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

  // opts: {button, status, result, last, month: () => 'YYYY-MM'}
  function init(opts) {
    let timer = null, lastChecked = {};
    function render(res) {
      const c = res.monthEnd, busy = c && (c.state === '依頼中' || c.state === '実行中');
      lastChecked = res.lastChecked || lastChecked;
      if (opts.last) opts.last.innerHTML = `<span class="badge ${lastChecked.B ? 'good' : 'warn'}">JDS取り込み 長崎店：${fmt(lastChecked.B)}</span> <span class="badge ${lastChecked.A ? 'good' : 'warn'}">県央店（諫早）：${fmt(lastChecked.A)}</span>`;
      opts.button.disabled = Boolean(busy);
      const t = c && c.at ? fmt(c.at) : '';
      const text = !c ? '' : {'依頼中': `${monthLabel(c.month)}分を依頼しました。Macの処理が始まるのを待っています…`, '実行中': `${monthLabel(c.month)}分を集計中…（数分かかります）`, '完了': `${t} ${monthLabel(c.month)}分の集計が終わりました`, '失敗': `${t} 集計できませんでした：${c.message || '原因不明'}`}[c.state] || '';
      opts.status.textContent = text; opts.status.className = 'save-message' + (c && c.state === '失敗' ? ' error' : '');
      renderResult(opts.result, busy ? null : res.result);
      clearTimeout(timer);
      if (busy) timer = setTimeout(refresh, 10000);
    }
    async function refresh() { try { render(await Api.monthEndStatus()); } catch (e) { timer = setTimeout(refresh, 20000); } }
    opts.button.addEventListener('click', async () => {
      try {
        opts.button.disabled = true;
        const r = await Api.monthEndRequest(opts.month());
        render({monthEnd: r.monthEnd, lastChecked: lastChecked, result: null});
        refresh();
      } catch (e) { opts.button.disabled = false; opts.status.textContent = '依頼できませんでした：' + e.message; opts.status.className = 'save-message error'; }
    });
    return {refresh};
  }

  window.MonthEnd = {init};
})();
