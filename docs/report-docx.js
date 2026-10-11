(() => {
  'use strict';
  // オーナー様向け「募集状況のご報告」をWord（.docx）で作る。担当者が修正・加筆できるよう、
  // 自動で入る数字に加えて「担当者記入」欄（黄色の網掛け）と「ご提案」表を入れる。外部サービスは使わず、ブラウザ内で作成する。
  const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const FONT = '<w:rFonts w:ascii="Yu Gothic" w:hAnsi="Yu Gothic" w:eastAsia="游ゴシック" w:cs="Yu Gothic"/>';

  // ---- 部品 ----
  const run = (text, o = {}) => `<w:r><w:rPr>${FONT}${o.bold ? '<w:b/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.size ? `<w:sz w:val="${o.size * 2}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}</w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
  const memo = text => run(`【担当者記入】${text}`, {fill: 'FFF2CC', color: '7F6000'}); // 黄色の網掛け＝担当者が書き換える所
  const para = (runs, o = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.align ? `<w:jc w:val="${o.align}"/>` : ''}${o.bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}<w:spacing w:after="${o.after ?? 80}"/></w:pPr>${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;
  const p = (text, o = {}) => para(run(text, o), o);
  const h1 = t => para(run(t), {style: 'Title'});
  const h2 = t => para(run(t), {style: 'Heading2'});
  const bullet = runs => para(runs, {bullet: true});
  const cell = (content, o = {}) => `<w:tc><w:tcPr>${o.w ? `<w:tcW w:w="${o.w}" w:type="dxa"/>` : ''}${o.head ? '<w:shd w:val="clear" w:color="auto" w:fill="E8F0F5"/>' : o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${(Array.isArray(content) ? content : [content]).map(c => c.startsWith('<w:p>') ? c : para(c.startsWith('<w:r>') ? c : run(c, {bold: o.head, size: 9.5}), {after: 0, align: o.align})).join('')}</w:tc>`;
  const table = (head, rows, widths) => {
    const W = widths || head.map(() => Math.floor(9600 / head.length));
    const border = '<w:top w:val="single" w:sz="4" w:color="BFCFDA"/><w:left w:val="single" w:sz="4" w:color="BFCFDA"/><w:bottom w:val="single" w:sz="4" w:color="BFCFDA"/><w:right w:val="single" w:sz="4" w:color="BFCFDA"/><w:insideH w:val="single" w:sz="4" w:color="BFCFDA"/><w:insideV w:val="single" w:sz="4" w:color="BFCFDA"/>';
    return `<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
      + `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((t, i) => cell(t, {head: true, w: W[i]})).join('')}</w:tr>`
      + rows.map(r => `<w:tr>${r.map((c, i) => cell(c, {w: W[i], align: typeof c === 'string' && /^[0-9０-９.,%＋－+\-]+(件|人|日|%|万円)?$/.test(c) ? 'right' : undefined})).join('')}</w:tr>`).join('')
      + '</w:tbl>' + para('', {after: 60});
  };

  // ---- 文言 ----
  const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : '―';
  const man = v => v == null || isNaN(v) ? '―' : `${(Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '')}万円`;
  const rentNum = v => { const n = parseFloat(String(v || '').replace(/[^0-9.]/g, '')); return n > 0 ? (n > 1000 ? n / 10000 : n) : null; };
  const jpDate = s => s ? s.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, (m, y, mo, d) => `${Number(y)}年${Number(mo)}月${Number(d)}日`) : '―';
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00+09:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  // 数字から「ご提案」の候補を作る（担当者が取捨選択・修正する前提）
  const proposals = (d, own, ref) => {
    const out = [];
    const perMonth = d.total / (d.months || 1);
    if (own && ref && own - ref.median >= 0.2) out.push(['賃料の見直し', `成約の中央値（${man(ref.median)}）に近づける。例：${man(own)} → ${man(Math.round(ref.median * 10) / 10)}`, `月${man(own - Math.round(ref.median * 10) / 10)}の減額`, '検索の価格帯に入り、反響の増加が見込める']);
    if (d.total === 0 || perMonth < 2) out.push(['掲載の強化', 'SUUMO等の写真の撮り直し・パノラマ追加・おすすめコメントの刷新、特集への掲載', '【要確認】掲載費', '一覧での見え方を改善し、反響を増やす']);
    if (d.total >= 3 && d.viewed / d.total < 0.3) out.push(['反響から内見へのつなぎ', '問い合わせへの即日連絡・かってに内見（セルフ内見）の案内・初期費用の見せ方の工夫', '費用なし', '問い合わせ止まりを減らす']);
    if (d.viewed >= 3 && d.applied === 0) out.push(['室内の第一印象の改善', 'ステージング（家具・小物の設置）・照明・におい対策・再クリーニング', '【要確認】数万円程度', '内見から申込への転換を上げる']);
    if (d.vacantDays != null && d.vacantDays >= 60) out.push(['入居条件の緩和', 'フリーレント1か月、礼金なし、二人入居・ペット相談可などの条件の見直し', '【要確認】', '他の物件との差別化。長期の空室を早く解消する']);
    out.push(['仲介会社への働きかけ', '仲介会社への訪問・物件資料の配布、広告料（AD）の設定・上乗せの検討', '【要確認】AD○か月', '仲介会社からの紹介・同行内見を増やす']);
    return out.slice(0, 5);
  };

  // 決まらない理由の見立て（自動の目安。担当者が現地の状況と合わせて書き換える）
  const diagnosis = (d, own, ref) => {
    const t = [];
    if (d.total === 0) t.push('この期間に反響がなく、まず「見つけてもらえていない」段階と考えられます。');
    else if (d.viewed / d.total < 0.3) t.push(`反響${d.total}件に対して内見が${d.viewed}件と少なく、問い合わせ後に比較の段階で外れている可能性があります。`);
    else if (d.viewed && !d.applied) t.push(`内見が${d.viewed}件あるものの申込がなく、現地の印象や条件面（賃料・初期費用）で見送られている可能性があります。`);
    else t.push('反響・内見とも一定数あり、条件が合うお客様が見つかれば決まりやすい状況です。');
    if (own && ref) { const df = own - ref.median; if (df >= 0.2) t.push(`賃料が近隣の成約中央値より${man(df)}高く、比較で不利になっている可能性があります。`); else if (df <= -0.2) t.push('賃料は近隣の成約中央値より低く、価格面の不利は小さいと考えられます。'); }
    return t;
  };

  async function build(d, extra = {}) {
    const own = rentNum(d.rent);
    const m = d.market && !d.market.error && d.market.count ? d.market : null;
    const ref = m ? (m.same && m.same.count >= 3 ? m.same : m.all) : null;
    const today = (d.to || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const loss = own && d.vacantDays ? own * d.vacantDays / 30 : null;
    const body = [];

    // 表紙・あいさつ
    body.push(para([memo('オーナー様のお名前'), run('　様')], {after: 120}));
    body.push(para(run(`${jpDate(today)}`), {align: 'right', after: 0}));
    body.push(para([run('株式会社ハウジングロビー　担当：'), memo('氏名・連絡先')], {align: 'right', after: 200}));
    body.push(h1(`${d.property || ''} ${d.room || ''}　募集状況のご報告`));
    body.push(p('平素より大変お世話になっております。標記のお部屋の募集状況と、今後のご提案をご報告いたします。', {after: 160}));

    // 1. 要点
    body.push(h2('1. ご報告の要点'));
    if (d.vacantDays != null) body.push(bullet(run(`空室期間：解約日（${jpDate(d.moveOut)}）から${d.vacantDays}日${loss ? `（家賃収入の機会損失の目安：約${man(loss)}）` : ''}`)));
    body.push(bullet(run(`直近${d.months}か月の反響${d.total}件・内見${d.viewed}件・申込${d.applied}件`)));
    if (own && ref) { const df = own - ref.median; body.push(bullet(run(`賃料${man(own)}は、近隣の成約中央値（${man(ref.median)}）${Math.abs(df) < 0.2 ? 'とほぼ同水準' : `より${man(Math.abs(df))}${df > 0 ? '高い' : '低い'}`}です`))); }
    body.push(bullet(memo('オーナー様に一番お伝えしたい結論を1〜2行で（例：賃料を○円下げれば○月中の成約が見込めます）')));

    // 2. 数字
    body.push(h2('2. 募集の状況'));
    body.push(p(`集計期間：${jpDate(d.from)}〜${jpDate(d.to)}（直近${d.months}か月）`, {size: 9, color: '5C7182'}));
    body.push(table(['項目', '件数・割合', '説明'], [
      ['反響（お問い合わせ・セルフ内見）', `${d.total}件`, `同じ方を1人と数えると${d.people}人`],
      ['内見', `${d.viewed}件`, `内見率 ${pct(d.viewed, d.total)}`],
      ['申込', `${d.applied}件`, `反響からの申込率 ${pct(d.applied, d.total)}`],
      ['仲介会社の同行内見', `${d.brokerVisits || 0}件`, '他社経由のご案内'],
      ['この号室への反響', `${d.thisRoom || 0}件`, '物件全体のうち、このお部屋を指定したもの']
    ], [3600, 1800, 4200]));
    const src = Object.entries(d.bySource || {}).sort((a, b) => b[1] - a[1]);
    if (src.length) { body.push(p('反響の経路', {bold: true})); body.push(table(['経路', '件数', '構成比'], src.map(([k, v]) => [k, `${v}件`, pct(v, d.total)]), [4800, 2400, 2400])); }
    const mon = Object.entries(d.byMonth || {}).sort();
    if (mon.length) { body.push(p('月別の反響数', {bold: true})); body.push(table(['月', '件数'], mon.map(([k, v]) => [k.replace(/^(\d{4})-(\d{2})$/, (s, y, mo) => `${y}年${Number(mo)}月`), `${v}件`]), [4800, 4800])); }

    // 3. 相場
    if (m) {
      body.push(h2('3. 近隣の成約相場'));
      body.push(p(`${m.scope === 'city' ? `${m.town}周辺は事例が少ないため${m.city || '市内'}全体` : `${m.town}`}の成約事例（${m.period || ''}）との比較です。`, {size: 9, color: '5C7182'}));
      const rows = [];
      if (m.same) rows.push([`同じ間取り（${m.layout || ''}）`, `${m.same.count}件`, man(m.same.median), `${man(m.same.q1)}〜${man(m.same.q3)}`, `${man(m.same.min)}〜${man(m.same.max)}`]);
      if (m.similar && m.similarLayouts && m.similarLayouts.length) rows.push([`類似間取り（${m.similarLayouts.join('・')}）`, `${m.similar.count}件`, man(m.similar.median), `${man(m.similar.q1)}〜${man(m.similar.q3)}`, `${man(m.similar.min)}〜${man(m.similar.max)}`]);
      if (!rows.length && m.all) rows.push(['全間取り', `${m.all.count}件`, man(m.all.median), `${man(m.all.q1)}〜${man(m.all.q3)}`, `${man(m.all.min)}〜${man(m.all.max)}`]);
      body.push(table(['比較対象', '事例数', '成約の中央値', '中央の半数', '最低〜最高'], rows, [2800, 1200, 1800, 1900, 1900]));
      if (own) body.push(p(`このお部屋の賃料：${man(own)}`, {bold: true}));
      if ((m.examples || []).length) {
        body.push(p('賃料が近い成約例', {bold: true}));
        body.push(table(['物件', '間取り', '賃料', 'この部屋との差', '築年', '成約日'], m.examples.slice(0, 8).map(e => {
          const df = own ? e.rent - own : null;
          return [e.name || '（物件名なし）', e.layout || '', man(e.rent), df == null ? '―' : `${df > 0 ? '＋' : df < 0 ? '－' : ''}${man(Math.abs(df))}`, e.age != null ? `築${e.age}年` : '―', e.date || ''];
        }), [2900, 1000, 1300, 1600, 1100, 1700]));
      }
    }

    // 4. 現地の状況
    body.push(h2(`${m ? 4 : 3}. 現地の状況`));
    const pr = extra.patrol;
    if (pr) {
      body.push(p(`最新の巡回：${jpDate(pr.date)}（担当：${pr.inspector || '―'}）`));
      if (pr.issues.length) pr.issues.forEach(i => body.push(bullet(run(`要対応：${i}`))));
      else body.push(bullet(run('のぼり・看板・室内清掃などの確認項目に不備はありませんでした。')));
      if (pr.otherIssue) body.push(bullet(run(`その他：${pr.otherIssue}`)));
    } else body.push(p('巡回の記録はまだありません。'));
    body.push(para(memo('室内・外観の写真を貼り付け（オーナー様が現地を想像できる写真を2〜4枚）')));

    // 5. 見立て
    body.push(h2(`${m ? 5 : 4}. 成約に至っていない理由の見立て`));
    diagnosis(d, own, ref).forEach(t => body.push(bullet(run(t))));
    body.push(bullet(memo('仲介会社やお客様の声（例：「駅から遠い」「収納が少ない」）があれば具体的に')));

    // 6. 提案
    body.push(h2(`${m ? 6 : 5}. ご提案（ご判断をお願いしたいこと）`));
    body.push(p('次の施策について、ご意向をお聞かせください。費用や条件は担当者が最終確認のうえご案内します。', {size: 9, color: '5C7182'}));
    body.push(table(['施策', '内容', '費用・条件の目安', '期待できる効果', 'ご判断'], proposals(d, own, ref).map(r => [...r, '□ お願いする\n□ 見送る'].map(c => c.includes('\n') ? c.split('\n').map(l => para(run(l, {size: 9.5}), {after: 0})) : c)), [1500, 3000, 1600, 2000, 1500]));

    // 7. 今後の予定
    body.push(h2(`${m ? 7 : 6}. 今後の予定`));
    body.push(bullet([run('次回のご報告：'), memo(`${jpDate(addDays(today, 14))}ごろ（2週間後を目安）`)]));
    body.push(bullet([run('それまでに実施すること：'), memo('例：写真の撮り直し、仲介会社10社への資料配布、次回巡回 ○月○日')]));
    body.push(p('ご不明な点やご要望がございましたら、担当までお気軽にお申し付けください。引き続きよろしくお願い申し上げます。', {after: 200}));
    body.push(p('※個人名は掲載していません。反響の数は当社の記録（セルフ内見予約表）にもとづきます。相場は当社が把握している成約事例にもとづく目安です。', {size: 8.5, color: '7A8D9A'}));

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${FONT}<w:sz w:val="21"/><w:lang w:val="en-US" w:eastAsia="ja-JP"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="200"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:color="1B5D85"/></w:pBdr></w:pPr><w:rPr><w:b/><w:color w:val="102841"/><w:sz w:val="34"/></w:rPr></w:style>`
      + `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="1B5D85"/><w:sz w:val="26"/></w:rPr></w:style></w:styles>`;
    const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="・"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="420" w:hanging="300"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>');
    zip.file('word/document.xml', documentXml);
    zip.file('word/styles.xml', stylesXml);
    zip.file('word/numbering.xml', numberingXml);
    return zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }

  window.ReportDocx = {build, proposals, diagnosis};
})();
