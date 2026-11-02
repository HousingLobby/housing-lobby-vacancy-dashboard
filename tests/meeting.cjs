const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(__dirname, '..'), gas = fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8');
new vm.Script(gas); // GAS全体の構文検査（実行しない）
const store = new Map();
const ctx = vm.createContext({CURRENT_USER: {name: '確認用'}, AUTH_ERROR: '認証エラー',
  persistGet_: k => store.get(k), persistPut_: (k, v) => store.set(k, v),
  passOk_: (k, p) => k === 'ADMIN_PASSCODE' && p === 'test-only',
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})},
  todayJst_: () => '2026-11-02', monthRange_: m => ({end: m + '-31'})});
vm.runInContext(gas.slice(gas.indexOf('function goalMonth_'), gas.indexOf('function readPromotionGoals_')), ctx);
assert.equal(ctx.meetingDraft_('2026-09').revision, 0);
const payload = {month: '2026-09', revision: 0, review: '振り返り', next: '次月施策', passcode: 'test-only', requestId: 'test-request-001'};
assert.throws(() => ctx.saveMeeting_({...payload, passcode: ''}));
ctx.CURRENT_USER = null; assert.throws(() => ctx.meetingDraft_('2026-09')); ctx.CURRENT_USER = {name: '確認用'};
assert.throws(() => ctx.saveMeeting_({...payload, review: 'a'.repeat(4001)}));
assert.equal(ctx.saveMeeting_(payload).revision, 1);
assert.equal(ctx.saveMeeting_(payload).revision, 1);
assert.throws(() => ctx.saveMeeting_({...payload, next: '別の内容'}));
assert.throws(() => ctx.saveMeeting_({...payload, requestId: 'test-request-002'}));
assert.equal(ctx.meetingDraft_('2026-10').revision, 0);
ctx.meetingData_ = () => ({warnings: ['不整合'], current: {}, prior: {}});
assert.throws(() => ctx.saveMeeting_({...payload, revision: 1, requestId: 'test-request-003', finalize: true}));
ctx.meetingData_ = () => ({warnings: [], current: {total: 10}, prior: {total: 8}});
assert.equal(ctx.saveMeeting_({...payload, revision: 1, requestId: 'test-request-004', finalize: true}).revision, 2);
assert.throws(() => ctx.saveMeeting_({...payload, revision: 2, requestId: 'test-request-005', finalize: true}));
const saved = ctx.saveMeeting_({...payload, revision: 2, requestId: 'test-request-006', next: '文章だけ変更'});
assert.equal(saved.snapshot.current.total, 10);
assert.throws(() => ctx.saveMeeting_({...payload, month: '2026-11', finalize: true}));
const cells = {AL4: '評価入居率', AQ4: '入居率'};
for (const col of ['G', 'L', 'Q', 'AF', 'AK', 'AP', 'AU']) cells[col + '5'] = '最終';
for (const r of [8, 11, 18, 21, 28]) Object.assign(cells, {[`A${r}`]: r === 28 ? '全体計' : '小計', [`G${r}`]: 100, [`L${r}`]: 10, [`Q${r}`]: 5, [`AF${r}`]: 0, [`AK${r}`]: 2, [`AP${r}`]: .92, [`AU${r}`]: .85});
assert.equal(ctx.meetingRatesFromCells_('2026-09', cells).warnings.length, 0);
cells.AU11 = .9;
let rates = ctx.meetingRatesFromCells_('2026-09', cells);
assert.equal(rates.rows[1].occupancy, null); assert.equal(rates.rows[1].evaluation, .92); assert.equal(rates.warnings.length, 1);
cells.G5 = '４w'; assert.equal(ctx.meetingRatesFromCells_('2026-09', cells).rows.length, 0);
const client = vm.createContext({window: {}, document: {getElementById: () => null}});
vm.runInContext(fs.readFileSync(path.join(root, 'docs/meeting.js'), 'utf8'), client);
const report = client.window.MeetingReport;
const pages = report.textPages('あ'.repeat(4000)); assert.ok(pages.length > 1);
assert.equal(pages.join('').replace(/\n/g, '').length, 4000);
assert.equal(report.rate({applied: 0, total: {people: 0}}), null);
const slides = report.model({month: '2026-09', previous: '2025-09', asOf: '2026-11-02', warnings: []}, {review: '', next: ''});
assert.match(slides[0].rows[1][1], /未取得/); assert.doesNotMatch(slides[0].rows[1][1], /^0/);
console.log('Meeting backend/model passed: auth, revisions, idempotency, month isolation, immutable final snapshot, future-month block, invalid formulas, missing values, long-text pagination. No external calls.');
