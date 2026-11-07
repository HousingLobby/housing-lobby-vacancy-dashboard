const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const gas = fs.readFileSync(require('node:path').join(__dirname, '../gas/Code.gs'), 'utf8');
new vm.Script(gas);
const saved = new Map(), legacy = new Map();
let locks = 0;
const c = vm.createContext({
  PropertiesService: {getScriptProperties: () => ({getProperty: k => saved.get(k) || null, setProperty: (k, v) => saved.set(k, v)})},
  LockService: {getScriptLock: () => ({waitLock: () => locks++, releaseLock: () => locks--})},
  CFG: {fields: {p: 'p', r: 'r'}},
  passOk_: (_, v) => v === 'allowed',
  assertInProject_: t => {if (!t.allowed) throw Error('not in project');},
  asanaGet_: path => path.endsWith('/subtasks') ? legacy.get(path.split('/')[2]) || [] :
    {allowed: !path.includes('/999'), name: '部屋', custom_fields: [{gid: 'p', display_value: '物件'}, {gid: 'r', display_value: '101'}]},
  asanaPost_: () => {throw Error('Asana write forbidden');},
  asanaFetch_: () => {throw Error('Asana write forbidden');}
});
vm.runInContext(gas.slice(gas.indexOf('const LP_TASK_NAME'), gas.indexOf('// 成約事例シートの中身')), c);
saved.set('LP_WORKER_KEY', 'test-only');
assert.throws(() => c.lpRequest_({task: '1', passcode: 'wrong'}));
assert.throws(() => c.lpRequest_({task: '999', passcode: 'allowed'}));
assert.throws(() => c.lpStatus_('../1'));
assert.equal(c.lpRequest_({task: '1', passcode: 'allowed'}).state, '依頼中');
assert.equal(c.lpRequest_({task: '1', passcode: 'allowed'}).state, '依頼中');
assert.equal(c.lpQueue_('test-only').queue.length, 1);
assert.equal('subtask' in c.lpQueue_('test-only').queue[0], false);
assert.throws(() => c.lpUpdate_({task: '1', key: 'wrong', state: '作成中'}));
c.lpUpdate_({task: '1', key: 'test-only', state: '作成中'});
assert.equal(c.lpStatus_('1').state, '作成中');
assert.throws(() => c.lpUpdate_({task: '1', key: 'test-only', state: '完了', url: 'javascript:alert(1)'}));
c.lpUpdate_({task: '1', key: 'test-only', state: '完了', url: 'https://example.com/lp/'});
assert.equal(c.lpStatus_('1').url, 'https://example.com/lp/');
assert.equal(c.lpQueue_('test-only').queue.length, 0);
c.lpUpdate_({task: '1', key: 'test-only', state: '作成中'});
assert.equal(c.lpStatus_('1').state, '完了');
legacy.set('2', [{gid: '20', name: '物件紹介LP', notes: '状態: 完了\nURL: https://example.com/legacy/'}]);
assert.equal(c.lpStatus_('2').url, 'https://example.com/legacy/');
c.migrateLegacyLpStates(['2']); legacy.delete('2');
assert.equal(c.lpStatus_('2').url, 'https://example.com/legacy/');
c.migrateLegacyLpStates(['2']);
assert.equal(c.lpStatus_('2').state, '完了');
legacy.set('3', [{gid: '30', name: '物件紹介LP', notes: '状態: 依頼中'}]);
saved.set('LP_QUEUE', JSON.stringify([{task: '3', subtask: '30'}]));
c.migrateLegacyLpStates(['3']); legacy.delete('3');
c.lpUpdate_({task: '3', key: 'test-only', state: '失敗', message: '再試行'});
assert.equal(c.lpStatus_('3').state, '失敗');
c.lpRequest_({task: '3', passcode: 'allowed'});
assert.equal(c.lpQueue_('test-only').queue.length, 1);
saved.set('LP_STATE_4', '{broken');
assert.throws(() => c.lpRequest_({task: '4', passcode: 'allowed'}));
assert.throws(() => c.lpUpdate_({task: '5', key: 'test-only', state: '完了', url: 'https://example.com/'}));
assert.equal(locks, 0);
vm.runInContext("CFG.project='project';CFG.section='section';CFG.fields.s='s';CFG.fields.c='c';", c);
let status = '空室中', vacancy = '原状回復完了', property = '物件';
c.asanaGet_ = p => p.endsWith('/subtasks') ? [] : {completed:false, allowed:true,
  memberships:[{project:{gid:'project'},section:{gid:'section'}}],
  custom_fields:[{gid:'p',display_value:property},{gid:'r',display_value:'101'},{gid:'s',display_value:status},{gid:'c',display_value:vacancy}]};
const link = {task:'6',property:'物件',room:'101',url:'https://housinglobby.github.io/lp/example/'};
assert.equal(c.registerExistingLpLinks([link])[0].result, '登録済み');
assert.equal(c.lpStatus_('6').url, link.url);
status='募集止め'; assert.equal(c.registerExistingLpLinks([{...link,task:'7'}])[0].result,'対象外');
status='空室中';vacancy='申込あり';assert.equal(c.registerExistingLpLinks([{...link,task:'7'}])[0].result,'対象外');
vacancy='原状回復完了';property='別物件';assert.throws(()=>c.registerExistingLpLinks([{...link,task:'7'}]));
property='物件';assert.equal(c.registerExistingLpLinks([{...link,url:'https://housinglobby.github.io/lp/different/'}])[0].result,'既存URLと異なるため保留');
assert.equal(locks,0);
console.log('LP state passed: no Asana writes, legacy migration, completed URL retained after deletion, queue compatibility, retry, deduplication, locking, validation.');
