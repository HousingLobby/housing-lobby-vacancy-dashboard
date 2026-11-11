// 物件名と号室の切り分け：画面(docs/room-split.js)とGAS(gas/Code.gs)が同じ結果になること、代表例が正しく分かれること
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const web=fs.readFileSync(path.join(__dirname,'../docs/room-split.js'),'utf8'),gas=fs.readFileSync(path.join(__dirname,'../gas/Code.gs'),'utf8');
const c1=vm.createContext({});vm.runInContext(web,c1);
const c2=vm.createContext({});vm.runInContext(gas.slice(gas.indexOf('function splitPropertyRoom_'),gas.indexOf('function hankyoVacancyNames_')),c2);
const names=['コーポK','アパートメントABE','グロワール玖島Ⅰ','yushinaAP','エクリュみゆき','セジュールカメリア','TAMAKI-Ⅲ','ハイカムール間瀬貝'];
const cases=[ // [入力, 物件名, 号室, 辞書を使うか]
 ['アパートメントABE103','アパートメントABE','103'],['アパートメントＡＢＥ１０３','アパートメントＡＢＥ','１０３'],['EAST101','EAST','101'],
 ['セジュールサンライズB102','セジュールサンライズ','B102'],['エスポワール坊ノ前Ａ402','エスポワール坊ノ前','Ａ402'],['ハイツプリメーラ1A','ハイツプリメーラ','1A'],
 ['パティオコウダA2','パティオコウダ','A2'],['KAKOI TERRACE A-3','KAKOI TERRACE','A-3'],['グランディール中嶋201号室','グランディール中嶋','201'],
 ['グロワール玖島Ⅰ203','グロワール玖島Ⅰ','203'],['アメニティハウスⅡ303','アメニティハウスⅡ','303'],['セジュールYMⅡ101','セジュールYMⅡ','101'],
 ['河合貸家','河合貸家',''],['第2真珠ビル302','第2真珠ビル','302'],['WINDMUHLE=BUNKYO201','WINDMUHLE=BUNKYO','201'],
 ['コーポK103','コーポK','103',true],['yushinaAP3','yushinaAP','3',true],['エクリュみゆきH','エクリュみゆき','H',true],['セジュールカメリア','セジュールカメリア','',true],
 ['TAMAKI-Ⅲ 202','TAMAKI-Ⅲ','202',true],['ハイカムール間瀬貝 B201','ハイカムール間瀬貝','B201',true],['アパートメントABE 103','アパートメントABE','103',true]];
for(const [t,p,r,dict] of cases){const a=c1.splitPropertyRoom(t,dict?names:null),b=c2.splitPropertyRoom_(t,dict?names:null);
 assert.deepEqual({...a},{...b},t);assert.equal(a.prop,p,t+' 物件名');assert.equal(a.room,r,t+' 号室');}
const body=s=>s.replace(/\s+/g,' ');
assert.equal(body(web.slice(web.indexOf('{',web.indexOf('function splitPropertyRoom(')),web.indexOf("if (typeof window")).trim()),
 body(gas.slice(gas.indexOf('{',gas.indexOf('function splitPropertyRoom_(')),gas.indexOf('// 物件名の末尾の号室を分ける')).trim()),'画面とGASの中身が違います');
console.log('room-split: ok',cases.length);
