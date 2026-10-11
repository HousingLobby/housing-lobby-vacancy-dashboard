(() => {
  'use strict';
  // 社内用 分析レポート（トップ営業の視点）。画面に表示し、PDFで保存する。オーナー様には出さない。
  // 判定 → 空室のコスト → どこで止まっているか → 相場の位置 → 原因の仮説 → 打ち手の優先順位 → オーナー様への提案の進め方 → 未対応・記録の抜け
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '―';
  const man = v => v == null || isNaN(v) ? '―' : `${(Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '')}万円`;
  const rentNum = v => { const n = parseFloat(String(v || '').replace(/[^0-9.]/g, '')); return n > 0 ? (n > 1000 ? n / 10000 : n) : null; };

  function analyze(d) {
    const own = rentNum(d.rent);
    const m = d.market && !d.market.error && d.market.count ? d.market : null;
    const ref = m ? (m.same && m.same.count >= 3 ? m.same : m.all) : null;
    const diff = own && ref ? own - ref.median : null;
    const days = d.vacantDays;
    const perMonth = d.total / (d.months || 1);
    // どこで止まっているか
    let stage, stageNote;
    if (d.applied > 0) { stage = '申込あり'; stageNote = '申込に至った反響があります。審査・契約までの進捗を確認。'; }
    else if (d.total === 0 || perMonth < 1) { stage = '反響が少ない'; stageNote = 'そもそも見つけてもらえていない。露出（掲載・写真・価格帯）の問題。'; }
    else if (d.viewed / d.total < 0.3) { stage = '反響→内見で止まっている'; stageNote = '問い合わせ後に比較で外れている。追客スピード・初期費用・写真と実物の差を確認。'; }
    else if (d.viewed >= 2) { stage = '内見→申込で止まっている'; stageNote = '現地を見て見送られている。室内の印象・設備・条件（賃料・初期費用）を疑う。'; }
    else { stage = '様子見'; stageNote = '件数が少なく、まだ判断材料が足りない。'; }
    // 判定
    let level = '様子見';
    if (d.applied > 0 || (days != null && days < 30 && d.total >= 2)) level = '順調';
    if ((days != null && days >= 60) || (d.viewed >= 3 && d.applied === 0) || (d.total === 0 && days != null && days >= 30) || (diff != null && diff >= 0.3)) level = '要テコ入れ';
    // 原因の仮説（率直に）
    const causes = [];
    if (diff != null && diff >= 0.2) causes.push(`賃料が成約中央値より${man(diff)}高い（相場の${own > ref.q3 ? '上位25%より上' : '上半分'}）。検索の価格帯で外れている可能性大。`);
    if (diff != null && diff <= -0.2) causes.push('賃料は相場より安い。価格以外（写真・室内・立地の伝え方）に原因がある。');
    if (stage === '反響が少ない') causes.push('露出不足。ポータルの写真枚数・1枚目の写真・コメント、掲載順位を確認。');
    if (stage === '反響→内見で止まっている') causes.push('反響への初動（即日連絡・かってに内見の案内）と、初期費用の見せ方を確認。');
    if (stage === '内見→申込で止まっている') causes.push('内見で見送り。におい・明るさ・清掃・設備の古さ、競合物件との条件差を確認。');
    if (!d.brokerVisits) causes.push('仲介会社の同行内見がゼロ。業者への露出（AD・資料配布）が弱い可能性。');
    // 打ち手（効果・速さ・費用で点数化）
    const actions = [];
    const add = (name, effect, speed, cost, why) => actions.push({name, effect, speed, cost, why, score: effect * 2 + speed - cost});
    if (diff != null && diff >= 0.2) add('賃料を成約中央値付近へ', 3, 3, 2, `${man(own)}→${man(Math.round(ref.median * 10) / 10)}。最も即効性が高い`);
    if (stage === '反響が少ない') add('写真の撮り直し・掲載強化', 2, 2, 1, '1枚目の写真とコメントを刷新。費用小');
    if (stage === '反響→内見で止まっている') add('追客の徹底・かってに内見の案内', 2, 3, 0, '費用なし。担当の動きで改善できる');
    if (stage === '内見→申込で止まっている') add('ステージング・再クリーニング', 3, 2, 2, '内見時の印象を上げる');
    if (days != null && days >= 60) add('フリーレント1か月・礼金なし', 3, 3, 2, '賃料を下げずに決め手を作る');
    add('AD設定・仲介会社への資料配布', 2, 2, 1, '他社経由の案内を増やす');
    actions.sort((a, b) => b.score - a.score);
    // オーナー様への説得材料
    const talk = [];
    if (own && days != null) talk.push(`空室のコスト：これまでの${days}日で約${man(own * days / 30)}。このまま1か月決まらないと、さらに${man(own)}。`);
    if (diff != null && diff >= 0.2) {
      const cut = Math.round(diff * 10) / 10;
      talk.push(`賃料を${man(cut)}下げた場合の年間減収は${man(cut * 12)}。空室が1か月短くなるだけで${man(own)}の回収になり、差し引き${own - cut * 12 >= 0 ? `約${man(own - cut * 12)}のプラス` : `約${man(cut * 12 - own)}のマイナス（2か月短縮できれば回収）`}。`);
      talk.push('話す順番：①現地はしっかり管理している（巡回写真）→ ②反響・内見の事実 → ③近隣の成約相場 → ④賃料の「ご相談」。最初から値下げを言わない。');
    }
    if (days != null && days >= 60 && !(diff != null && diff >= 0.2)) talk.push('賃料は相場並み。値下げより、フリーレント等の「期間限定の条件」を提案する方が受け入れられやすい。');
    // 記録の抜け
    const gaps = [];
    if (!own) gaps.push('【空室一覧】の「家賃」が空欄 → 相場比較ができない');
    if (!m) gaps.push('近隣の成約事例が取れていない（住所・間取りの未入力の可能性）');
    if (d.moveOut == null) gaps.push('「解約日」が空欄 → 空室日数が出せない');
    gaps.push('アットホームの反響は記録分のみ。未登録がないか確認');
    return {own, m, ref, diff, days, stage, stageNote, level, causes, actions, talk, gaps};
  }

  function render(d, extra = {}) {
    const a = analyze(d);
    const pr = extra.patrol;
    const levelCls = a.level === '要テコ入れ' ? 'lv-bad' : a.level === '順調' ? 'lv-good' : 'lv-mid';
    const funnel = [['反響', d.total, ''], ['内見', d.viewed, pct(d.viewed, d.total)], ['申込', d.applied, pct(d.applied, d.viewed)]];
    return `
      <div class="internal-banner">社内用・持ち出し禁止（オーナー様には「オーナー様向け 報告書（Word）」をお送りください）</div>
      <section class="internal">
        <h2>社内分析（トップ営業の視点）</h2>
        <div class="verdict-row"><span class="level ${levelCls}">${esc(a.level)}</span><span>${esc(a.stage)}：${esc(a.stageNote)}</span></div>
        <div class="kpi-row">
          <div class="kpi-box"><span>空室日数</span><strong>${a.days == null ? '―' : a.days + '日'}</strong></div>
          <div class="kpi-box"><span>機会損失（これまで）</span><strong>${a.own && a.days != null ? man(a.own * a.days / 30) : '―'}</strong></div>
          <div class="kpi-box"><span>あと1か月空くと</span><strong>${a.own ? '＋' + man(a.own) : '―'}</strong></div>
          <div class="kpi-box"><span>相場との差</span><strong>${a.diff == null ? '―' : (a.diff > 0 ? '＋' : a.diff < 0 ? '－' : '') + man(Math.abs(a.diff))}</strong></div>
        </div>
        <h3>どこで止まっているか（直近${d.months}か月）</h3>
        <div class="funnel">${funnel.map(([k, v, r], i) => `<div class="f-step"><span>${k}</span><strong>${v}件</strong>${i ? `<small>前段階から ${r}</small>` : ''}</div>`).join('<div class="f-arrow">→</div>')}</div>
        ${a.ref ? `<p>相場の位置：成約中央値 ${man(a.ref.median)}（中央の半数 ${man(a.ref.q1)}〜${man(a.ref.q3)}）に対し、この部屋 ${man(a.own)}。</p>` : ''}
        <h3>原因の仮説</h3>
        <ul>${a.causes.map(c => `<li>${esc(c)}</li>`).join('') || '<li>目立った原因は見当たらない。現地の声を集める。</li>'}</ul>
        <h3>打ち手の優先順位（効果×速さ÷費用）</h3>
        <table class="actions"><thead><tr><th>順位</th><th>打ち手</th><th>効果</th><th>速さ</th><th>費用</th><th>ねらい</th></tr></thead><tbody>
          ${a.actions.slice(0, 4).map((x, i) => `<tr><td>${i + 1}</td><td><strong>${esc(x.name)}</strong></td><td>${'★'.repeat(x.effect)}</td><td>${'★'.repeat(x.speed)}</td><td>${x.cost ? '¥'.repeat(x.cost) : 'なし'}</td><td>${esc(x.why)}</td></tr>`).join('')}
        </tbody></table>
        ${a.talk.length ? `<h3>オーナー様への提案の進め方</h3><ul>${a.talk.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <h3>現地の未対応・記録の抜け</h3>
        <ul>
          ${pr ? (pr.issues.length ? `<li>${esc(pr.date)}の巡回で要対応：${esc(pr.issues.join('、'))}（巡回確認の対応タスクの期日を確認）</li>` : `<li>${esc(pr.date)}の巡回では不備なし</li>`) : '<li>巡回の記録なし → 早めに巡回し、写真を撮る（オーナー報告書に載ります）</li>'}
          ${pr && pr.otherIssue ? `<li>その他不備：${esc(pr.otherIssue)}</li>` : ''}
          ${a.gaps.map(g => `<li>${esc(g)}</li>`).join('')}
        </ul>
      </section>`;
  }

  window.ReportInternal = {analyze, render};
})();
