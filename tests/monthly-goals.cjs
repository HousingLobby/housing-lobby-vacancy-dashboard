const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(__dirname, '..'), gas = fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8');
new vm.Script(gas);
const store = new Map();
store.set('GM202611', JSON.stringify({revision: 2, targets: {application: 25, response: 100, contract: 20}}));
const ctx = vm.createContext({CURRENT_USER: {name: '確認用'}, AUTH_ERROR: 'ログインしてください',
  persistGet_: key => store.get(key), persistPut_: (key, v) => store.set(key, v),
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})}});
vm.runInContext(gas.slice(gas.indexOf('function goalMonth_'), gas.indexOf('/* 個人名は返さない。件数と内訳だけ。')), ctx);
const targets = y => Object.fromEntries(Array.from({length: 12}, (_, i) => [`${y}-${String(i + 1).padStart(2, '0')}`, i + 10]));
const body = {year: '2026', targets: targets('2026'), revision: 0, requestId: 'annual-request-001'};
assert.equal(ctx.getAnnualPromotionGoals_('2026').targets['2026-11'], 25);
ctx.CURRENT_USER = null;
assert.throws(() => ctx.getAnnualPromotionGoals_('2026')); assert.throws(() => ctx.setAnnualPromotionGoals_(body));
ctx.CURRENT_USER = {name: '確認用'};
assert.throws(() => ctx.getAnnualPromotionGoals_('2026x'));
assert.throws(() => ctx.setPromotionGoals_({}));
for (const v of [-1, 1.5, true, '20', Infinity, 1000001, undefined]) assert.throws(() => ctx.setAnnualPromotionGoals_({...body, targets: {...body.targets, '2026-07': v}}));
assert.throws(() => ctx.setAnnualPromotionGoals_({...body, targets: {'2026-01': 20}}));
assert.equal(store.has('YG2026'), false); // 検証エラー時に一部の月だけ保存しない
assert.equal(ctx.setAnnualPromotionGoals_(body).revision, 1); // 合言葉なし
assert.equal(ctx.setAnnualPromotionGoals_(body).revision, 1);
assert.throws(() => ctx.setAnnualPromotionGoals_({...body, targets: {...body.targets, '2026-01': 99}}));
assert.throws(() => ctx.setAnnualPromotionGoals_({...body, requestId: 'annual-request-002'}));
assert.equal(ctx.getPromotionGoals_('2026-11').targets.application, 20);
assert.deepEqual(Object.keys(ctx.getPromotionGoals_('2026-11').targets), ['application']);
assert.equal(JSON.parse(store.get('GM202611')).targets.application, 25); // 旧記録は破壊しない
const updated = ctx.setAnnualPromotionGoals_({...body, revision: 1, requestId: 'annual-request-003', targets: {...body.targets, '2026-01': 0, '2026-02': null}});
assert.equal(updated.targets['2026-01'], 0); assert.equal(updated.targets['2026-02'], null);
assert.equal(ctx.getAnnualPromotionGoals_('2027').targets['2027-01'], null);
assert.equal(JSON.parse(store.get('YG2026')).history.length, 2);
const client = vm.createContext({window: {}, document: {getElementById: () => null}});
vm.runInContext(fs.readFileSync(path.join(root, 'docs/promotion-goals.js'), 'utf8'), client);
const m = client.window.PromotionGoalMath;
assert.equal(m.achievement(18, 30), 60); assert.ok(Math.abs(m.achievement(40, 30) - 400 / 3) < 1e-10); assert.equal(m.achievement(0, 0), null); assert.equal(m.achievement(null, 20), null);
assert.equal(m.parseTarget(''), null); assert.equal(m.parseTarget('0'), 0); assert.throws(() => m.parseTarget('-1'));
console.log('Annual goals passed: login required, no passcode, 12-month validation, legacy migration, atomic validation, revisions, idempotency, year isolation, null/zero, application-only metrics.');
