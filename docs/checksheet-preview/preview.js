(() => {
  'use strict';
  const initial = () => [
    {id:1, property:'サンプルハイツ', room:'101', name:'試験 入居者A', submitted:true, version:1, date:'2026/11/08', issues:[{id:1,category:'キズ・汚れ',description:'洋室の床に約5cmのキズ（架空の記録）',request:'記録のみ',status:'未対応',staff:'未設定'},{id:2,category:'水回り',description:'キッチンの蛇口の根元から水がにじむ（架空の記録）',request:'修理・確認希望',status:'確認中',staff:'確認担当A'}]},
    {id:2, property:'テストコーポ', room:'201', name:'試験 入居者B', submitted:false, version:0, date:'—', issues:[]},
    {id:3, property:'サンプルハイツ', room:'102', name:'試験 入居者C', submitted:true, version:1, date:'2026/11/07', issues:[]}
  ];
  let tenancies=initial(), draft=[], history=[], residentStep='start';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const badge=s=>`<span class="badge ${s==='未対応'?'open':s==='対応完了'||s==='対応不要'?'done':''}">${esc(s)}</span>`;
  const allIssues=()=>tenancies.flatMap(t=>t.issues.map(i=>({...i,tenancy:t})));
  const open=i=>!['対応完了','対応不要'].includes(i.status);
  const title=(top,sub)=>`<p class="eyebrow">RESIDENT CHECKSHEET · DEMO</p><h1>${top}</h1><p class="sub">${sub}</p>`;
  const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||'<tr><td colspan="6">対象はありません。</td></tr>'}</tbody></table></div>`;
  const plan=(interactive=false)=>`<svg class="plan" viewBox="0 0 320 420" role="img" aria-label="架空の1K間取り。洋室の床とキッチンに確認位置があります"><rect x="12" y="12" width="296" height="390" fill="#fff" stroke="#36332e" stroke-width="5"/><path d="M12 160H308M165 12V160M165 83H308" fill="none" stroke="#36332e" stroke-width="4"/><rect x="28" y="103" width="110" height="36" fill="#eef1f4" stroke="#8c867b"/><g fill="#5f5a52" text-anchor="middle" font-size="14"><text x="84" y="68">玄関</text><text x="83" y="126">キッチン</text><text x="235" y="54">トイレ</text><text x="235" y="129">浴室</text><text x="160" y="290">洋室 8帖</text><text x="160" y="418" font-size="11">架空の間取り図・1K</text></g>${[[1,150,260],[2,84,91]].map(([n,x,y])=>`<g ${interactive?`class="pin" tabindex="0" role="button" aria-label="ピン${n}のサンプル不具合を追加" data-pin="${n}"`:''}><circle cx="${x}" cy="${y}" r="15" fill="#b03a31"/><text x="${x}" y="${y+5}" fill="white" text-anchor="middle" font-size="14">${n}</text></g>`).join('')}</svg>`;
  function dashboard(){
    const submitted=tenancies.filter(t=>t.submitted).length, issues=allIssues();
    return title('ダッシュボード','架空の入居3件で、提出受付から対応管理までの流れを試せます。')
      +`<div class="cards">${[['入居中',3],['未提出',3-submitted],['提出済み',submitted],['未完了の不具合',issues.filter(open).length]].map(([l,n])=>`<div class="metric"><span>${l}</span><strong>${n}</strong><small>件</small></div>`).join('')}</div>`
      +`<section class="panel"><div class="panel-title"><h2>対応が必要な入居</h2><a href="#resident">入居者画面を試す →</a></div>${table(['物件・号室','入居者（架空）','提出状況'],tenancies.filter(t=>!t.submitted).map(t=>`<tr><td>${t.property} ${t.room}</td><td>${t.name}</td><td>${badge('未提出')}</td></tr>`))}</section>`
      +`<section class="panel"><div class="panel-title"><h2>不具合の対応状況</h2><a href="#issues">対応を確認 →</a></div>${issueTable(issues)}</section>`;
  }
  function issueTable(items){return table(['状態','物件・号室','内容','担当'],items.map(i=>`<tr><td>${badge(i.status)}</td><td>${i.tenancy.property} ${i.tenancy.room}</td><td>${i.id}. ${i.category}</td><td>${i.staff}</td></tr>`));}
  function submissions(){return title('提出状況','提出内容・間取り図・写真の確認画面です。掲載内容はすべて架空です。')+`<section class="panel">${table(['物件・号室','入居者（架空）','提出','版','内容',''],tenancies.map(t=>`<tr><td>${t.property} ${t.room}</td><td>${t.name}</td><td>${badge(t.submitted?'提出済み':'未提出')}</td><td>${t.version?'第'+t.version+'版':'—'}</td><td>${t.submitted?(t.issues.length?t.issues.length+'件':'不具合なし'):'—'}</td><td>${t.submitted?`<a href="#detail/${t.id}">詳細を見る →</a>`:'<a href="#resident">提出を試す →</a>'}</td></tr>`))}</section>`;}
  function detail(id){const t=tenancies.find(t=>t.id===id);if(!t?.submitted)return submissions();return title(`${t.property} ${t.room}号室`,`${t.name} ／ 第${t.version}版 ／ ${t.date}（架空データ）`)+`<section class="panel"><div class="two-col"><div><h2>確認位置</h2>${plan()}<p class="legend">番号は不具合の一覧と対応しています。</p></div><div><h2>提出内容</h2>${t.issues.map(i=>`<article class="issue"><h3>${i.id}. ${i.category} ${badge(i.status)}</h3><p>${i.description}</p><p class="legend">希望：${i.request}</p><div class="photo">写真の表示見本<br>実際の室内写真は使用していません</div></article>`).join('')||'<p class="empty">不具合なしの提出です。</p>'}</div></div><div class="actions"><a href="#submissions">← 提出一覧へ</a><button data-action="print">この見本を印刷・PDF保存</button></div><p class="legend">ブラウザの印刷機能です。本番用の写真入り自動PDFとは異なります。</p></section>`;}
  function issues(){return title('不具合対応','担当者・対応状況の変更を試せます。Asanaへの送信はありません。')+allIssues().map(i=>`<section class="panel"><div class="panel-title"><h2>${i.tenancy.property} ${i.tenancy.room} ／ ${i.id}. ${i.category}</h2>${badge(i.status)}</div><p>${i.description}</p><div class="two-col"><div class="issue"><label for="status-${i.tenancy.id}-${i.id}">対応状況</label><select id="status-${i.tenancy.id}-${i.id}" data-field="status" data-tenancy="${i.tenancy.id}" data-issue="${i.id}">${['未対応','確認中','手配済み','対応完了','対応不要'].map(v=>`<option${v===i.status?' selected':''}>${v}</option>`).join('')}</select></div><div class="issue"><label for="staff-${i.tenancy.id}-${i.id}">担当者（架空）</label><select id="staff-${i.tenancy.id}-${i.id}" data-field="staff" data-tenancy="${i.tenancy.id}" data-issue="${i.id}">${['未設定','確認担当A','確認担当B'].map(v=>`<option${v===i.staff?' selected':''}>${v}</option>`).join('')}</select></div></div></section>`).join('')+`<section class="panel"><h2>この画面での操作履歴</h2><ul class="history">${history.map(s=>`<li>${esc(s)}</li>`).join('')||'<li>まだ変更はありません。</li>'}</ul></section>`;}
  function resident(){
    const base=title('入居時のお部屋チェック','テストコーポ 201号室 ／ 提出先・入居者は架空です。');
    if(residentStep==='done')return `<div class="resident">${base}<section class="panel"><h2>提出の流れを確認できました</h2><p>この画面内の「提出状況」に反映しました。サーバーへの保存・通知は行っていません。</p><div class="actions"><a href="#submissions">社員側で内容を見る →</a><button class="quiet" data-action="again">再提出を試す</button></div></section></div>`;
    if(residentStep==='confirm')return `<div class="resident">${base}<section class="panel"><h2>内容の確認</h2><p>契約者名：試験 入居者B（架空・変更不可）</p>${draft.length?draft.map(i=>`<article class="issue"><h3>${i.id}. ${i.category}</h3><p>${i.description}</p><span class="badge">${i.request}</span></article>`).join(''):'<p>不具合なしで提出します。</p>'}<div class="actions"><button data-action="submit">この内容で提出を試す</button><button class="quiet" data-action="back">戻る</button></div></section></div>`;
    return `<div class="resident">${base}<section class="panel"><h2>1. 契約者名を確認</h2><div class="sample-field">試験 入居者B（架空・変更不可）</div><h2 style="margin-top:24px">2. 気になる場所を選択</h2><p class="legend">赤い番号を押すと、サンプルの不具合が追加されます。</p>${plan(true)}${draft.map(i=>`<article class="issue"><h3>${i.id}. ${i.category}</h3><p>${i.description}</p><button class="quiet" data-remove="${i.id}">取り消す</button></article>`).join('')}<div class="actions"><button data-action="confirm">${draft.length?'確認へ進む':'不具合なしで確認へ'}</button></div><p class="legend">写真・自由入力はこのデモでは無効です。</p></section></div>`;
  }
  function render(){
    const route=location.hash.slice(1)||'dashboard', [page,id]=route.split('/');
    $('view').innerHTML=page==='submissions'?submissions():page==='detail'?detail(Number(id)):page==='issues'?issues():page==='resident'?resident():dashboard();
    document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+(page==='detail'?'submissions':page))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  }
  function pin(n){if(!draft.some(i=>i.id===n))draft.push({id:n,category:n===1?'キズ・汚れ':'水回り',description:n===1?'洋室の床のキズ（架空の記録）':'キッチンの水漏れ（架空の記録）',request:n===1?'記録のみ':'修理・確認希望',status:'未対応',staff:'未設定'});render();}
  $('app').addEventListener('click',e=>{
    const p=e.target.closest('[data-pin]');if(p){pin(Number(p.dataset.pin));return;}
    const remove=e.target.closest('[data-remove]');if(remove){draft=draft.filter(i=>i.id!==Number(remove.dataset.remove));render();return;}
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action==='confirm')residentStep='confirm';
    if(action==='back'||action==='again')residentStep='start';
    if(action==='submit'){const t=tenancies.find(t=>t.id===2);t.submitted=true;t.version++;t.date='確認操作時';t.issues=draft.map(i=>({...i}));residentStep='done';$('notice').textContent='デモ内だけに反映しました。SharePoint・Asanaへの保存／送信はありません。';}
    if(action==='print'){window.print();return;}
    if(e.target.closest('#reset')){tenancies=initial();draft=[];history=[];residentStep='start';$('notice').textContent='デモを初期状態に戻しました。';}
    if(action||e.target.closest('#reset'))render();
  });
  $('app').addEventListener('keydown',e=>{const p=e.target.closest('[data-pin]');if(p&&(e.key==='Enter'||e.key===' ')){e.preventDefault();pin(Number(p.dataset.pin));}});
  $('app').addEventListener('change',e=>{const s=e.target;if(!s.matches('select[data-field]'))return;const t=tenancies.find(t=>t.id===Number(s.dataset.tenancy)),i=t.issues.find(i=>i.id===Number(s.dataset.issue));history.unshift(`${t.property} ${t.room}：${s.dataset.field==='staff'?'担当者':'対応状況'} ${i[s.dataset.field]} → ${s.value}`);i[s.dataset.field]=s.value;$('notice').textContent='デモ内の状態を変更しました。外部への送信はありません。';render();});
  window.addEventListener('hashchange',()=>{render();$('notice').textContent='';});
  (async()=>{try{if(!window.Auth)throw new Error('ログイン機能を読み込めませんでした。再読み込みしてください。');await window.Auth.ready;$('app').hidden=false;$('login-status').hidden=true;render();}catch(e){$('login-status').textContent=e.message||'ログインを確認できませんでした。';}})();
})();
