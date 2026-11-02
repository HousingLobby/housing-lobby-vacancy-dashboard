// 仮データのみ。実APIへの通信は遮断する。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium} = require('/Users/leasingdept/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1100}}), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.route('**/*', r => r.abort());
    const panel = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8').match(/<section class="panel goals-panel"[\s\S]*?<\/section>/)[0];
    const css = ['styles.css', 'promotion-goals.css'].map(n => fs.readFileSync(path.join(root, 'docs', n), 'utf8')).join('\n');
    await page.setContent(`<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main class="shell"><h1>申込目標・検証用（仮データ）</h1><select id="promo-month"><option>2026-11</option><option>2027-01</option></select>${panel}</main></html>`);
    await page.evaluate(() => {
      const records = {}; window.failSave = false; window.failLoad = false; window.calls = [];
      const fresh = year => ({year, revision: 0, targets: Object.fromEntries(Array.from({length: 12}, (_, i) => [`${year}-${String(i + 1).padStart(2, '0')}`, 30])), updatedAt: null});
      window.Api = {
        annualPromotionGoals: async year => { if (window.legacyBackend) throw Error('不明な操作です'); if (window.failLoad) throw Error('検証用取得失敗'); return structuredClone(records[year] || fresh(year)); },
        promotionGoals: async month => ({month, revision: 1, targets: {application: 25}}),
        setAnnualPromotionGoals: async body => { window.calls.push(body); if (window.failSave) throw Error('検証用保存失敗'); return records[body.year] = {year: body.year, revision: body.revision + 1, targets: body.targets, updatedAt: '2026-11-02', updatedBy: '確認用'}; },
        newId: () => 'annual-request-' + (calls.length + 1)
      };
    });
    await page.addScriptTag({content: fs.readFileSync(path.join(root, 'docs/promotion-goals.js'), 'utf8')});
    await page.evaluate(() => { PromotionGoals.setMonth('2026-11'); PromotionGoals.setActuals('2026-11', {application: 18}, {}); });
    await page.waitForFunction(() => !document.getElementById('goals-save').disabled);
    assert.equal(await page.locator('.goal-card').count(), 1); assert.match(await page.locator('.goal-card').innerText(), /60\.0/);
    assert.equal(await page.locator('input[type=password]').count(), 0);
    await page.locator('#goals-editor summary').click();
    assert.equal(await page.locator('#goals-annual-inputs input').count(), 12);
    await page.locator('#goal-2026-01').fill('40'); await page.locator('#goal-2026-11').fill('36');
    await page.locator('#goals-year').selectOption('2027');
    await page.waitForFunction(() => !document.getElementById('goals-save').disabled);
    assert.equal(await page.locator('#goal-2027-01').inputValue(), '30');
    await page.locator('#goals-year').selectOption('2026');
    await page.waitForFunction(() => !document.getElementById('goals-save').disabled);
    assert.equal(await page.locator('#goal-2026-01').inputValue(), '40'); assert.equal(await page.locator('#goal-2026-11').inputValue(), '36');
    await page.locator('#goals-save').click();
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('保存しました'));
    assert.match(await page.locator('.goal-card').innerText(), /50\.0/);
    assert.equal(await page.evaluate(() => Object.keys(calls[0].targets).length), 12);
    assert.equal(await page.evaluate(() => Object.hasOwn(calls[0], 'passcode')), false);
    await page.screenshot({path: path.join(root, '../outputs/annual-goals-desktop.png'), fullPage: true});
    await page.setViewportSize({width: 390, height: 1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({path: path.join(root, '../outputs/annual-goals-mobile.png'), fullPage: true});
    await page.locator('#goal-2026-11').fill('50'); await page.evaluate(() => window.failSave = true);
    await page.locator('#goals-save').click();
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('保存できません'));
    assert.equal(await page.locator('#goal-2026-11').inputValue(), '50'); assert.match(await page.locator('.goal-card').innerText(), /50\.0/);
    await page.evaluate(() => window.failLoad = true); await page.locator('#goals-year').selectOption('2027');
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('取得できません'));
    assert.equal(await page.locator('#goals-save').isDisabled(), true);
    await page.evaluate(() => { window.legacyBackend = true; window.failLoad = false; PromotionGoals.setMonth('2026-11'); PromotionGoals.setActuals('2026-11', {application: 18}, {}); });
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('再デプロイが必要'));
    assert.match(await page.locator('.goal-card').innerText(), /72\.0/);
    assert.equal(await page.locator('#goals-save').isDisabled(), true);
    await page.evaluate(() => { window.legacyBackend = false; window.failSave = false; PromotionGoals.setMonth('2027-01'); PromotionGoals.setActuals('2027-01', {application: 45}, {}); });
    await page.waitForFunction(() => !document.getElementById('goals-save').disabled);
    assert.match(await page.locator('.goal-achievement dd').innerText(), /150\.0/);
    assert.equal(await page.locator('.goal-track>span').evaluate(e => e.style.width), '100%');
    assert.match(await page.locator('.goal-status').innerText(), /目標達成/);
    await page.locator('#goal-2027-01').fill('0'); await page.locator('#goals-save').click();
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('保存しました'));
    assert.equal(await page.locator('.goal-achievement dd').innerText(), '—');
    assert.match(await page.locator('.goal-status').innerText(), /目標0/);
    await page.locator('#goal-2027-01').fill(''); await page.locator('#goals-save').click();
    await page.waitForFunction(() => document.getElementById('goals-message').textContent.includes('保存しました'));
    assert.match(await page.locator('.goal-status').innerText(), /未設定/);
    assert.deepEqual(errors, []);
    console.log('Annual goals UI passed: application only, no passcode, 12 inputs, one save request, achievement, year drafts, save/load failure, desktop/mobile.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
