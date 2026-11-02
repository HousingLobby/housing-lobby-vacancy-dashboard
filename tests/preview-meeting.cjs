// 仮の数値だけで画面・PPTXを検証。実APIには一切接続しない。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require('/Users/leasingdept/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.resolve(root, '../outputs');
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.abort());
    const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
    const panel = html.match(/<section class="panel meeting-panel"[\s\S]*?<\/section>/)[0];
    const css = ['styles.css', 'meeting.css'].map(n => fs.readFileSync(path.join(root, 'docs', n), 'utf8')).join('\n');
    await page.setContent(`<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main class="shell"><h1>会議資料・動作検証用（仮の数値）</h1><select id="promo-month"><option>2026-09</option><option>2026-10</option></select>${panel}</main></html>`);
    await page.evaluate(() => {
      window.failSave = false; window.requests = []; const records = {};
      const stats = scale => ({application: {total: 20 * scale, byArea: {'長崎中央': 10 * scale, '長崎北': 6 * scale, '諫早': 3 * scale, '大村': scale}, byBroker: {'確認用A社': 12 * scale, '確認用B社': 8 * scale}, byContract: {'個人': 15 * scale, '法人': 5 * scale}, bySelfViewing: {'あり': 8 * scale, 'なし': 12 * scale}}, response: {total: {people: 40 * scale}, selfViewing: {total: {people: 20 * scale, properties: 24 * scale}, applied: 8 * scale}, byGroup: {SUUMO: {people: 20 * scale}, 'アットホーム': {people: 10 * scale}, '看板': {people: 5 * scale}, '紹介': {people: 5 * scale}}}});
      const data = month => ({month, previous: '2025' + month.slice(4), asOf: '2026-11-02T01:00:00Z', current: stats(1), prior: stats(2), rates: {[month]: {rows: ['長崎中央', '長崎北', '諫早', '大村', '全体'].map(name => ({name, occupancy: .93, evaluation: .95}))}}, warnings: []});
      window.Api = {
        newId: () => 'test-request-' + (requests.length + 1),
        meetingDraft: async month => structuredClone(records[month] || {month, revision: 0, review: '', next: '', snapshot: null}),
        meetingData: async month => data(month),
        saveMeeting: async body => { requests.push({...body, passcode: undefined}); if (window.failSave) throw Error('検証用保存失敗'); return records[body.month] = {month: body.month, revision: body.revision + 1, review: body.review, next: body.next, snapshot: body.finalize ? data(body.month) : null}; }
      };
    });
    for (const script of ['vendor/pptxgenjs-4.0.1.bundle.js', 'meeting.js']) await page.addScriptTag({content: fs.readFileSync(path.join(root, 'docs', script), 'utf8')});
    await page.locator('#meeting-open').click();
    await page.waitForFunction(() => document.querySelectorAll('.meeting-slide').length >= 8);
    await page.locator('#meeting-review').fill('【検証用】ポータル経由の反響が中心。\n来月は内見後のフォローを改善します。');
    await page.locator('#meeting-next').fill('【検証用】募集写真の見直し\n担当：テスト担当／期限：翌月10日\n指標：反響数・セルフ内見人数');
    await page.locator('.meeting-slide').nth(0).screenshot({path: path.join(output, 'meeting-preview-sample.png')});
    await page.locator('.meeting-slide').nth(4).screenshot({path: path.join(output, 'meeting-chart-sample.png')});
    const bytes = await page.evaluate(async () => {
      const d = await Api.meetingDraft('2026-09'), data = await Api.meetingData('2026-09');
      const model = MeetingReport.model(data, {...d, review: document.getElementById('meeting-review').value, next: document.getElementById('meeting-next').value});
      const blob = await MeetingReport.powerpoint(model, {blob: true});
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    fs.writeFileSync(path.join(output, 'meeting-export-test.pptx'), Buffer.from(bytes));
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#meeting-download').click()]);
    assert.match(download.suggestedFilename(), /2026-09.*pptx/);
    await page.waitForFunction(() => !document.getElementById('meeting-save').disabled);
    await page.locator('#promo-month').selectOption('2026-10');
    await page.waitForFunction(() => !document.getElementById('meeting-review').disabled);
    assert.equal(await page.locator('#meeting-review').inputValue(), '');
    await page.locator('#promo-month').selectOption('2026-09');
    await page.waitForFunction(() => !document.getElementById('meeting-review').disabled);
    assert.match(await page.locator('#meeting-review').inputValue(), /検証用/);
    await page.evaluate(() => window.failSave = true);
    await page.locator('#meeting-save').click();
    await page.waitForFunction(() => document.getElementById('meeting-status').textContent.includes('保存できません'));
    assert.match(await page.locator('#meeting-review').inputValue(), /検証用/);
    await page.evaluate(() => window.failSave = false);
    await page.locator('#meeting-save').click();
    await page.waitForFunction(() => document.getElementById('meeting-status').textContent.includes('共有保存しました'));
    await page.setViewportSize({width: 390, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#meeting-workspace').screenshot({path: path.join(output, 'meeting-mobile-sample.png')});
    assert.deepEqual(errors, []);
    console.log('Meeting UI passed: preview, editable PPTX export, month isolation, draft retention, save failures, mobile no page overflow. No external calls.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
