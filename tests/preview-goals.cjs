// デザイン・操作のローカル検証。実API・認証・Asanaには接続しない。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('/Users/leasingdept/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1024}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const source = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
    const panel = source.match(/<section class="panel goals-panel"[\s\S]*?<\/section>/)[0];
    const css = ['styles.css', 'promotion-goals.css'].map(n => fs.readFileSync(path.join(root, 'docs', n), 'utf8')).join('\n');
    await page.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><header class="masthead"><div class="masthead-inner"><div class="brand"><span class="brand-mark">H</span>空室業務ダッシュボード</div><span>デザイン確認用・仮の数値</span></div></header><main class="shell"><div class="section-heading"><div><p class="eyebrow">LEASING PROMOTION</p><h1>入居促進</h1></div></div><div class="filters"><label>対象月<select id="promo-month"><option>2026-11</option><option>2026-12</option></select></label></div>${panel}</main></html>`);
    await page.evaluate(() => {
      const records = {};
      window.demoCalls = []; window.failGoals = false; window.failSave = false;
      const fresh = month => ({month, revision: 0, targets: {response: 100, application: 30, contract: 20}, updatedAt: null});
      window.Api = {
        promotionGoals: async month => { if (window.failGoals) throw Error('確認用の通信失敗'); return structuredClone(records[month] || fresh(month)); },
        setPromotionGoals: async body => {
          window.demoCalls.push({...body, passcode: undefined});
          if (window.failSave) throw Error('確認用の保存失敗');
          return records[body.month] = {month: body.month, revision: body.revision + 1, targets: body.targets, updatedBy: '管理者', updatedAt: '2026-11-02T01:00:00Z'};
        },
        newId: () => 'test-request-' + (window.demoCalls.length + 1)
      };
    });
    await page.addScriptTag({content: fs.readFileSync(path.join(root, 'docs/promotion-goals.js'), 'utf8')});
    await page.evaluate(() => { PromotionGoals.setMonth('2026-11'); PromotionGoals.setActuals('2026-11', {response: 75, application: 18, contract: null}, {}); });
    await page.waitForFunction(() => !document.getElementById('goals-save').disabled);
    assert.match(await page.locator('.goal-card').nth(0).innerText(), /75\.0/);
    assert.match(await page.locator('.goal-card').nth(2).innerText(), /実績未連携/);
    await page.screenshot({path: path.join(root, '../outputs/monthly-goals-desktop.png'), fullPage: true});
    await page.locator('#goals-editor summary').click();
    await page.locator('#goal-response').fill('120');
    await page.evaluate(() => PromotionGoals.setMonth('2026-12'));
    await page.waitForFunction(() => !document.getElementById('goals-save').disabled);
    assert.equal(await page.locator('#goal-response').inputValue(), '100');
    await page.evaluate(() => { PromotionGoals.setMonth('2026-11'); PromotionGoals.setActuals('2026-11', {response: 75, application: 18, contract: null}, {}); });
    await page.waitForFunction(() => !document.getElementById('goals-save').disabled);
    assert.equal(await page.locator('#goal-response').inputValue(), '120');
    await page.locator('#goal-passcode').fill('demo-not-a-real-secret');
    await page.locator('#goals-save').click();
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('保存しました'));
    assert.equal(await page.locator('#goal-passcode').inputValue(), '');
    assert.match(await page.locator('.goal-card').nth(0).innerText(), /62\.5/);
    await page.screenshot({path: path.join(root, '../outputs/monthly-goals-editor.png'), fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({path: path.join(root, '../outputs/monthly-goals-mobile.png'), fullPage: true});
    await page.locator('#goal-response').fill('130');
    await page.evaluate(() => { window.failSave = true; });
    await page.locator('#goal-passcode').fill('demo-not-a-real-secret'); await page.locator('#goals-save').click();
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('保存できません'));
    assert.equal(await page.locator('#goal-response').inputValue(), '130');
    assert.match(await page.locator('.goal-card').nth(0).innerText(), /62\.5/);
    await page.evaluate(() => { window.failGoals = true; PromotionGoals.setMonth('2026-12'); });
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('取得できません'));
    assert.equal(await page.locator('#goals-save').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('Goals UI passed: desktop/mobile, draft retention, save/failure, password clearing, no overflow, unavailable backend. No external writes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
