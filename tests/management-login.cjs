const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const gas = fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8');
new vm.Script(gas);
const stored = new Map(), removed = [];
const ctx = vm.createContext({
  CURRENT_USER: null, AUTH_ERROR: '社内アカウントでログインしてください',
  CFG: {areas: ['長崎中央', '長崎北', '諫早', '大村']},
  PropertiesService: {getScriptProperties: () => ({setProperty: (k, v) => stored.set(k, v)})},
  CacheService: {getScriptCache: () => ({remove: k => removed.push(k)})}
});
vm.runInContext(gas.slice(gas.indexOf('function setManagement_'), gas.indexOf('/* ---------- 巡回記録')), ctx);
// 架空のテスト値のみ。非公開の実データをコード・ログへ含めない。
const body = {month: '2026-10', source: 'test fixture', areas: Object.fromEntries(ctx.CFG.areas.map(a => [a, {sub: 10, general: 20}]))};
assert.throws(() => ctx.setManagement_(body), /社内アカウント/);
assert.throws(() => ctx.setManagement_({...body, passcode: 'legacy-test'}), /社内アカウント/);
assert.equal(stored.size, 0);
ctx.CURRENT_USER = {name: 'テスト利用者'};
assert.equal(ctx.setManagement_(body).ok, true);
assert.deepEqual(JSON.parse(stored.get('M_2026-10')).areas, body.areas);
assert.deepEqual(removed, ['snapshot_n']);
assert.equal(ctx.setManagement_({...body, month: '2026-11'}).month, '2026-11');
const before = new Map(stored);
assert.throws(() => ctx.setManagement_({...body, areas: {...body.areas, '長崎中央': {sub: -1, general: 20}}}));
assert.throws(() => ctx.setManagement_({...body, month: ''}));
assert.deepEqual(stored, before);
const app = fs.readFileSync(path.join(root, 'docs/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
assert.ok(!app.includes('form.elements.passcode'));
assert.ok(!html.includes('管理用の合言葉'));
assert.ok(!/setManagement:\s*true/.test(gas.match(/const OPEN_ACTIONS = .*;/)[0]));
console.log('Management login checks passed: anonymous rejected, logged-in save without passcode, values preserved, invalid inputs rejected.');
