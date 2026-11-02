const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const gas = fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8');
const section = gas.slice(gas.indexOf('function goalMonth_'), gas.indexOf('/* 個人名は返さない。件数と内訳だけ。'));
const store = new Map();
const ctx = vm.createContext({CURRENT_USER: {name: 'テスト管理者'}, AUTH_ERROR: 'ログインしてください',
  passOk_: (key, value) => key === 'ADMIN_PASSCODE' && value === 'test-only',
  persistGet_: key => store.get(key), persistPut_: (key, value) => store.set(key, value),
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})}});
vm.runInContext(section, ctx);
const payload = (month = '2026-11', revision = 0, requestId = 'request-0001') => ({month, revision, requestId, passcode: 'test-only', targets: {response: 100, application: 30, contract: null}});
assert.equal(ctx.getPromotionGoals_('2026-11').revision, 0);
assert.throws(() => ctx.getPromotionGoals_('2026-13'));
ctx.CURRENT_USER = null; assert.throws(() => ctx.getPromotionGoals_('2026-11')); ctx.CURRENT_USER = {name: 'テスト管理者'};
assert.throws(() => ctx.setPromotionGoals_({...payload(), passcode: 'wrong'}));
for (const bad of [-1, 1.5, true, '20', Infinity, 1000001, undefined]) assert.throws(() => ctx.setPromotionGoals_({...payload(), targets: {response: bad, application: 30, contract: null}}));
let result = ctx.setPromotionGoals_(payload()); assert.equal(result.revision, 1);
assert.equal(ctx.setPromotionGoals_(payload()).revision, 1); // 通信再試行で二重保存しない
assert.throws(() => ctx.setPromotionGoals_(payload('2026-11', 0, 'request-0002')));
assert.equal(ctx.setPromotionGoals_(payload('2026-12')).revision, 1);
result = ctx.setPromotionGoals_({...payload('2026-11', 1, 'request-0003'), targets: {response: 0, application: null, contract: 20}});
assert.equal(result.targets.response, 0); assert.equal(result.targets.application, null);
assert.equal(ctx.getPromotionGoals_('2026-12').targets.response, 100);
const record = JSON.parse(store.get('GM202611')); assert.equal(record.history.length, 2); assert.equal(record.history[1].before.response, 100);
const client = vm.createContext({window: {}, document: {getElementById: () => null}});
vm.runInContext(fs.readFileSync(path.join(root, 'docs/promotion-goals.js'), 'utf8'), client);
const math = client.window.PromotionGoalMath;
assert.equal(math.achievement(75, 100), 75); assert.equal(math.achievement(120, 100), 120);
assert.equal(math.achievement(0, 100), 0); assert.equal(math.achievement(null, 100), null);
assert.equal(math.achievement(20, 0), null); assert.equal(math.achievement(20, null), null);
assert.equal(math.parseTarget(''), null); assert.equal(math.parseTarget('0'), 0); assert.throws(() => math.parseTarget('-1'));
console.log('Monthly goals: validation, auth, revision conflicts, idempotency, month isolation, history, achievement passed. No external requests.');
