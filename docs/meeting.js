(() => {
  'use strict';
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const count = n => finite(n) ? n.toLocaleString('ja-JP') : '未取得';
  const percent = n => finite(n) ? (n * 100).toFixed(1) + '%' : '未取得';
  const change = (a, b) => finite(a) && finite(b) ? (a - b > 0 ? '+' : '') + (a - b).toLocaleString('ja-JP') : '—';
  const rate = sv => finite(sv?.applied) && sv.total?.people > 0 ? sv.applied / sv.total.people : null;
  const textPages = value => {
    const lines = String(value || '未入力').replace(/\r/g, '').split('\n'), pages = []; let page = [], size = 0;
    for (const line of lines) {
      const chars = Array.from(line), pieces = [];
      for (let i = 0; i < chars.length; i += 36) pieces.push(chars.slice(i, i + 36).join(''));
      for (const piece of pieces.length ? pieces : ['']) {
        if (size >= 10) { pages.push(page.join('\n')); page = []; size = 0; }
        page.push(piece); size++;
      }
    }
    if (page.length) pages.push(page.join('\n'));
    return pages;
  };
  function model(data, draft) {
    const a = data.current?.application, r = data.current?.response, pa = data.prior?.application, pr = data.prior?.response;
    const currentRates = data.rates?.[data.month]?.rows || [], oldRates = data.rates?.[data.previous]?.rows || [];
    const total = currentRates.find(x => x.name === '全体');
    const slides = [];
    const addTable = (title, headers, rows, note) => {
      const list = rows.length ? rows : [['データ未取得', ...headers.slice(1).map(() => '—')]];
      for (let i = 0; i < list.length; i += 6) slides.push({title: title + (i ? '（続き）' : ''), headers, rows: list.slice(i, i + 6), note});
    };
    addTable('月次サマリー', ['指標', '今月', '前年同月', '前年差'], [
      ['入居率（月末）', percent(total?.occupancy), percent(oldRates.find(x => x.name === '全体')?.occupancy), '詳細は次ページ'],
      ['申込数', count(a?.total) + '件', count(pa?.total) + '件', change(a?.total, pa?.total)],
      ['総反響（人数）', count(r?.total?.people) + '人', count(pr?.total?.people) + '人', change(r?.total?.people, pr?.total?.people)],
      ['セルフ内見利用人数', count(r?.selfViewing?.total?.people) + '人', count(pr?.selfViewing?.total?.people) + '人', change(r?.selfViewing?.total?.people, pr?.selfViewing?.total?.people)]
    ], '入居率は週報の最終列。申込は申込日、反響・内見はAsanaの期日ベース。');
    addTable('月末の入居率', ['エリア', '入居率', '評価入居率', '前年入居率'], ['長崎中央', '長崎北', '諫早', '大村', '全体'].map(name => {
      const row = currentRates.find(x => x.name === name), old = oldRates.find(x => x.name === name);
      return [name, percent(row?.occupancy), percent(row?.evaluation), percent(old?.occupancy)];
    }), '未取得・数式不整合は未取得表示。4週目の値や現在のAsanaからは補完しません。');
    addTable('申込の内訳', ['地区', '申込件数', '前年同月'], Array.from(new Set([...Object.keys(a?.byArea || {}), ...Object.keys(pa?.byArea || {})])).map(k => [k, a ? count(a.byArea[k] ?? 0) : '未取得', pa ? count(pa.byArea[k] ?? 0) : '未取得']), '申込日ベース／空室一覧。過去に削除・上書きされた情報は復元できません。');
    const sv = r?.selfViewing, oldSv = pr?.selfViewing;
    addTable('かってに内見の利用と成約率', ['指標', '今月', '前年同月'], [
      ['利用人数', count(sv?.total?.people) + '人', count(oldSv?.total?.people) + '人'],
      ['利用物件ごと', count(sv?.total?.properties) + '件', count(oldSv?.total?.properties) + '件'],
      ['内見結果「申込」人数', count(sv?.applied) + '人', count(oldSv?.applied) + '人'],
      ['成約率', percent(rate(sv)), percent(rate(oldSv))]
    ], '成約率＝内見結果「申込」人数÷セルフ内見利用人数。実際の契約成立率とは異なります。');
    slides.push({title: '前年同月との比較', chart: [
      {label: '申込数', current: a?.total, prior: pa?.total},
      {label: '総反響人数', current: r?.total?.people, prior: pr?.total?.people},
      {label: 'セルフ内見人数', current: sv?.total?.people, prior: oldSv?.total?.people}
    ], note: '件・人の単位は指標名に対応。前年同月も同じAsanaの項目・数え方で再集計。'});
    addTable('反響経路の内訳', ['経路', '今月（人数）', '前年（人数）'], ['ポータル', '看板', '仲介', 'HP', '紹介', 'その他', '未設定'].map(k => {
      const value = response => {
        if (!response) return null;
        // SUUMO＋アットホームの経路別人数の合算。経路をまたぐ同一人は重複するため総人数とは異なる。
        if (k === 'ポータル') return (response.byGroup?.SUUMO?.people || 0) + (response.byGroup?.['アットホーム']?.people || 0);
        return response.byGroup?.[k]?.people ?? 0;
      };
      return [k, count(value(r)), count(value(pr))];
    }).filter(row => !['その他', '未設定'].includes(row[0]) || row[1] !== '0' || row[2] !== '0'), 'ポータル＝SUUMO＋アットホーム。経路をまたぐ同一人は重複するため、経路合計と総人数は一致しない場合があります。');
    [['今月の振り返り', draft.review], ['次月の取り組み', draft.next]].forEach(([title, value]) => textPages(value).forEach((text, i) => slides.push({title: title + (i ? '（続き）' : ''), text, note: '施策と数字の関係は参考情報です。施策だけの効果とは断定しません。'})));
    [['仲介業者別', 'byBroker'], ['契約種別', 'byContract'], ['かってに内見の有無', 'bySelfViewing']].forEach(([title, key]) => {
      addTable('補足：申込 ' + title, [title, '今月（件）', '前年（件）'], Array.from(new Set([...Object.keys(a?.[key] || {}), ...Object.keys(pa?.[key] || {})])).map(k => [k, a ? count(a[key]?.[k] ?? 0) : '未取得', pa ? count(pa[key]?.[k] ?? 0) : '未取得']), '申込日ベース。空欄は「未設定」として表示し、数字を推測しません。');
    });
    const warnings = data.warnings || [];
    if (warnings.length) textPages(warnings.join('\n')).forEach(text => slides.push({title: 'データの確認事項', text, note: '要確認の資料です。未取得の値を0や最新値で置き換えていません。'}));
    return slides.map((s, i) => ({...s, month: data.month, footer: `${data.month} 月末実績 · ${draft.snapshot ? '確定保存' : '暫定・再集計値'} · 取得 ${String(data.asOf).slice(0, 10)}`, page: i + 1, total: slides.length}));
  }
  async function powerpoint(slides, options = {}) {
    if (!window.PptxGenJS) throw new Error('PowerPoint出力ライブラリを読み込めません');
    const pptx = new window.PptxGenJS(); pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'ハウジングロビー'; pptx.subject = '入居促進 月末会議資料'; pptx.title = `${slides[0].month} 入居促進`;
    pptx.lang = 'ja-JP'; pptx.theme = {headFontFace: 'Yu Gothic', bodyFontFace: 'Yu Gothic', lang: 'ja-JP'};
    const ink = '183448', teal = '168B89', gray = '627685';
    const text = (s, value, x, y, w, h, size, color = ink, extra = {}) => s.addText(String(value), {x, y, w, h, fontFace: 'Yu Gothic', fontSize: size, color, margin: 0, breakLine: false, ...extra});
    slides.forEach(m => {
      const s = pptx.addSlide(); s.background = {color: 'FFFFFF'};
      text(s, 'HOUSING LOBBY / MONTHLY REVIEW', .65, .38, 11.8, .25, 11, teal, {charSpacing: 1.5});
      text(s, m.title, .65, .92, 12, .62, 28, ink, {bold: true});
      if (m.rows) {
        s.addTable([m.headers.map(h => ({text: h, options: {fill: ink, color: 'FFFFFF', bold: true}})), ...m.rows], {x: .65, y: 1.9, w: 12, colW: m.headers.map((_, i) => i ? 8.0 / (m.headers.length - 1) : 4),
          fontFace: 'Yu Gothic', fontSize: 17, color: ink, rowH: .40, margin: [.10, .14, .10, .14],
          border: {type: 'solid', color: 'E2E9EE', pt: .5},
          autoPage: false,
          fill: 'F3F7F9', bold: false});
      }
      if (m.chart) {
        if (m.chart.every(v => finite(v.current) && finite(v.prior))) s.addChart(pptx.ChartType.bar, [
          {name: '前年同月', labels: m.chart.map(x => x.label), values: m.chart.map(x => x.prior)},
          {name: '今月', labels: m.chart.map(x => x.label), values: m.chart.map(x => x.current)}
        ], {x: .65, y: 1.9, w: 12, h: 3.8, catAxisLabelFontFace: 'Yu Gothic', catAxisLabelFontSize: 16,
          valAxisLabelFontFace: 'Yu Gothic', valAxisLabelFontSize: 12, legendFontFace: 'Yu Gothic', legendFontSize: 14,
          showLegend: true, legendPos: 'b', showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0',
          chartColors: ['B4C4CF', teal], showTitle: false, showBorder: false, showCatName: false, valAxisMinVal: 0});
        else text(s, '前年または今月のデータが未取得のため、比較グラフを作成できません。', .65, 2.1, 11.8, 2, 22, gray);
      }
      if (m.text) text(s, m.text, .65, 1.9, 12, 3.95, 20, ink, {lineSpacingMultiple: 1.25, valign: 'top'});
      text(s, m.note, .65, 6.02, 12, .54, 10, gray, {valign: 'top'});
      s.addShape(pptx.ShapeType.line, {x: .65, y: 6.8, w: 12, h: 0, line: {color: 'E2E9EE', width: .7}});
      text(s, m.footer, .65, 6.95, 11, .2, 9, gray);
      text(s, `${m.page} / ${m.total}`, 11.7, 6.95, .95, .2, 9, gray, {align: 'right'});
    });
    const raw = await pptx.write({outputType: 'blob'});
    // PptxGenJS 4.0.1は未生成のslideMasterのContentTypeを列挙する。
    // 実在しないマスターの宣言だけ除き、スライド・表・チャート・埋込Excelは変更しない。
    const zip = await window.JSZip.loadAsync(raw);
    const manifest = new DOMParser().parseFromString(await zip.file('[Content_Types].xml').async('string'), 'application/xml');
    for (const part of Array.from(manifest.getElementsByTagName('Override'))) {
      const name = part.getAttribute('PartName').replace(/^\//, '');
      if (!zip.file(name)) {
        if (!/^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)) throw new Error('PowerPointの構成ファイルを確認できません');
        part.remove();
      }
    }
    zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(manifest));
    const blob = await zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
    if (options.blob) return blob;
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `入居促進_月末会議資料_${slides[0].month}.pptx`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  window.MeetingReport = {model, powerpoint, textPages, rate};
  const $ = id => document.getElementById(id);
  if (!$('meeting-open')) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const drafts = new Map(); let month = '', draft = null, data = null, slides = [], generation = 0, busy = false, retry = null;
  const message = (s, error = false) => { $('meeting-status').textContent = s; $('meeting-status').classList.toggle('meeting-error', error); };
  const values = () => ({review: $('meeting-review').value, next: $('meeting-next').value});
  const stash = () => {
    if (!month || !draft) return;
    const v = values();
    if (v.review !== draft.review || v.next !== draft.next) drafts.set(month, v);
    else drafts.delete(month);
  };
  const controls = locked => {
    busy = locked;
    ['meeting-save', 'meeting-finalize'].forEach(id => $(id).disabled = locked || !draft);
    $('meeting-reload').disabled = locked;
    ['meeting-review', 'meeting-next'].forEach(id => $(id).disabled = locked || !draft);
    $('promo-month').disabled = locked;
    $('meeting-download').disabled = locked || !data;
    $('meeting-finalize').disabled = locked || !data || Boolean(draft?.snapshot) || (data?.warnings || []).length > 0 || data.month >= new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(new Date()).slice(0, 7);
  };
  function draw() {
    if (!data) { $('meeting-preview').innerHTML = ''; return; }
    slides = model(data, {...draft, ...values()});
    $('meeting-state').textContent = `${draft?.snapshot ? '数値確定済み' : '暫定・再集計値'}${draft?.updatedAt ? ' ／ 保存 ' + draft.updatedAt.slice(0, 10) : ''}`;
    $('meeting-preview').innerHTML = slides.map(s => `<article class="meeting-slide"><p class="meeting-kicker">HOUSING LOBBY / MONTHLY REVIEW</p><h3>${esc(s.title)}</h3>${s.rows ? `<table><thead><tr>${s.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}${s.chart ? `<div class="meeting-bars">${s.chart.map(c => `<div class="meeting-bar"><span>${esc(c.label)}<small>（前年 / 今月）</small></span><span>${finite(c.prior) ? `<i style="width:${Math.max(1, c.prior / Math.max(1, ...s.chart.flatMap(x => [x.current || 0, x.prior || 0])) * 100)}%;background:#b4c4cf"></i>` : '未取得'}${finite(c.current) ? `<i style="margin-top:5px;width:${Math.max(1, c.current / Math.max(1, ...s.chart.flatMap(x => [x.current || 0, x.prior || 0])) * 100)}%"></i>` : '未取得'}</span><b>${count(c.prior)} / ${count(c.current)}</b></div>`).join('')}</div>` : ''}${s.text ? `<p class="meeting-prose">${esc(s.text)}</p>` : ''}<p class="meeting-chart-note">${esc(s.note)}</p><footer><span>${esc(s.footer)}</span><span>${s.page} / ${s.total}</span></footer></article>`).join('');
    const sources = Object.entries(data.rates || {}).map(([m, r]) => {
      const url = r.source?.url;
      const safe = typeof url === 'string' && url.startsWith('https://hmao034998.sharepoint.com/');
      return `<li>${esc(m)}：${safe ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(r.source.name)}</a>` : '週報未取得'} ${esc(r.source?.sheet || '')} ${esc(r.source?.columns || '')}</li>`;
    });
    $('meeting-sources').innerHTML = `<ul><li>Asana：対象月 ${esc(data.month)} ／ 前年同月 ${esc(data.previous)}。取得 ${esc(data.asOf)}。</li>${sources.join('')}${(data.warnings || []).map(w => `<li class="meeting-error">${esc(w)}</li>`).join('')}</ul>`;
    controls(busy);
  }
  async function load() {
    if (busy) return;
    stash(); const target = $('promo-month').value, ticket = ++generation;
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(target)) return;
    month = target; draft = null; data = null; retry = null;
    $('meeting-month').textContent = `${month} の会議資料`;
    $('meeting-preview').innerHTML = ''; $('meeting-sources').textContent = '';
    $('meeting-review').value = drafts.get(month)?.review || ''; $('meeting-next').value = drafts.get(month)?.next || '';
    controls(true); message('保存内容と集計データを読み込んでいます…');
    try {
      const d = await window.Api.meetingDraft(target);
      if (ticket !== generation) return;
      if (d.month !== target || !Number.isInteger(d.revision)) throw new Error('会議資料機能のGAS反映を確認してください');
      draft = d; const text = drafts.get(month) || d;
      $('meeting-review').value = text.review || ''; $('meeting-next').value = text.next || '';
      data = d.snapshot || await window.Api.meetingData(target);
      if (ticket !== generation) return;
      if (data.month !== target || !Array.isArray(data.warnings)) throw new Error('集計データの形式が正しくありません');
      draw(); message(drafts.has(month) ? '未保存の文章を復元しました。' : data.warnings.length ? '確認事項があります。暫定のPowerPointは出力できます。' : '資料を準備しました。文章を入力してPowerPointを保存できます。');
    } catch (e) { message(`読み込めませんでした：${e.message}`, true); }
    finally { controls(false); }
  }
  $('meeting-open').addEventListener('click', () => {
    const open = $('meeting-workspace').hidden;
    $('meeting-workspace').hidden = !open; $('meeting-open').setAttribute('aria-expanded', String(open));
    if (open && (!draft || month !== $('promo-month').value)) load();
  });
  $('promo-month').addEventListener('change', () => { if (!$('meeting-workspace').hidden) load(); });
  ['meeting-review', 'meeting-next'].forEach(id => $(id).addEventListener('input', () => { stash(); draw(); message('未保存の文章があります。出力には現在の入力内容を使用します。'); }));
  $('meeting-reload').addEventListener('click', () => load());
  async function save(finalize) {
    if (busy || !draft) return;
    if (finalize && !window.confirm(`${month}の数値を再取得して確定保存します。以後、この月の確定数値は上書きしません。よろしいですか？`)) return;
    const body = {month, revision: draft.revision, ...values(), finalize};
    const signature = JSON.stringify(body);
    if (!retry || retry.signature !== signature) retry = {signature, id: window.Api.newId()};
    controls(true); message(finalize ? '最新データを検証して確定保存しています…' : '文章を共有保存しています…');
    try {
      const saved = await window.Api.saveMeeting({...body, requestId: retry.id});
      if (saved.month !== month || !Number.isInteger(saved.revision)) throw new Error('保存結果を確認できません');
      draft = saved; if (saved.snapshot) data = saved.snapshot;
      drafts.delete(month); retry = null; draw(); message(finalize ? '月末数値を確定保存しました。' : '文章を共有保存しました。');
    } catch (e) { message(`保存できませんでした：${e.message}（文章は保持しています）`, true); }
    finally { controls(false); }
  }
  $('meeting-save').addEventListener('click', () => save(false));
  $('meeting-finalize').addEventListener('click', () => save(true));
  $('meeting-download').addEventListener('click', async () => {
    if (busy || !data) return;
    controls(true); message('編集可能なPowerPointを作成しています…');
    try { await powerpoint(slides); message('PowerPointを保存しました。未保存の文章も出力に含まれます。'); }
    catch (e) { message(`出力できませんでした：${e.message}`, true); }
    finally { controls(false); }
  });
  window.addEventListener('beforeunload', e => { if (drafts.size) { e.preventDefault(); e.returnValue = ''; } });
})();
