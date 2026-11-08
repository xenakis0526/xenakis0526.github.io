import {createModel,isValue,ratioInputs,change,treemap,compositionNote} from './disclosure-core.mjs?v=20261108';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model,data;
const state={code:'V086',selected:new Set(['0010597','0010595','0010593']),charts:[],detail:null,chart:null,opener:null};
const vmeta=code=>model.byCode.get(code);
const short=c=>c.short_name||c.name;
function fmt(value,code=state.code,exact=false) {
  if(!isValue(value)) return '자료 없음';
  if(vmeta(code)?.unit==='%') return value.toLocaleString('ko-KR',{maximumFractionDigits:2})+'%';
  if(exact) return value.toLocaleString('ko-KR',{maximumFractionDigits:2})+'원';
  const abs=Math.abs(value);
  if(abs>=1e12) return (value/1e12).toLocaleString('ko-KR',{maximumFractionDigits:2})+'조원';
  if(abs>=1e8) return (value/1e8).toLocaleString('ko-KR',{maximumFractionDigits:2})+'억원';
  return value.toLocaleString('ko-KR',{maximumFractionDigits:2})+'원';
}
const percent=x=>isValue(x)?(x*100).toFixed(2)+'%':'—';
const delta=(x,code)=>isValue(x)?(x>0?'+':'')+x.toFixed(2)+(vmeta(code).unit==='%'?'%p':'%'):'—';
const cls=x=>!isValue(x)?'':x<0?'neg':x>0?'pos':'';
function range(){const a=data.periods.indexOf($('start').value),b=data.periods.indexOf($('end').value);return [Math.min(a,b),Math.max(a,b)];}
function idsText(target,ids){return model.members(target).filter(c=>!ids.includes(c.id)).map(short).join(', ');}
function coverage(p){return `자료 보유 ${p.count}/${p.total}개사`;}
function visibleCompanies(){const q=$('companySearch').value.trim().toLowerCase();return data.companies.filter(c=>`${c.name} ${short(c)}`.toLowerCase().includes(q));}
function renderCompanies(){
  $('companyList').innerHTML=['생명보험','손해보험'].map(sector=>{
    const arr=visibleCompanies().filter(c=>c.sector===sector);
    return `<section class="group"><h3>${sector}<span>${arr.length}개사</span></h3>${arr.map(c=>`<label class="company"><input type="checkbox" data-id="${c.id}" ${state.selected.has(c.id)?'checked':''}><span>${esc(short(c))}</span></label>`).join('')}</section>`;
  }).join('');
  $('count').textContent=state.selected.size;
  $('companyList').querySelectorAll('input').forEach(el=>el.onchange=()=>{el.checked?state.selected.add(el.dataset.id):state.selected.delete(el.dataset.id);$('count').textContent=state.selected.size;renderCards();});
}
function setVariable(code){
  state.code=code;const v=vmeta(code);
  $('variableInput').value=v.name;
  $('varName').textContent=v.name;
  $('varPath').textContent=v.path;
  $('varInfo').innerHTML=[v.code,`기존 코드 ${v.oldCode}`,v.unit,v.kind].map(x=>`<span>${esc(x)}</span>`).join('');
  $('varNote').textContent=v.note;
  hideSuggestions();
  history.replaceState(null,'',`#${code}`);
  renderCards();
}
function hideSuggestions(){$('suggestions').hidden=true;$('variableInput').setAttribute('aria-expanded','false');}
function suggestions(){
  const q=$('variableInput').value.trim().toLowerCase(),group=$('groupSelect').value;
  const norm=s=>String(s).toLowerCase().replace(/\s+/g,'');
  const matches=data.variables.filter(v=>(!group||v.group===group)&&norm(`${v.path} ${v.name} ${v.code} ${v.oldCode}`).includes(norm(q)));
  matches.sort((a,b)=>Number(norm(b.code)===norm(q)||norm(b.oldCode)===norm(q))-Number(norm(a.code)===norm(q)||norm(a.oldCode)===norm(q))||a.order-b.order);
  $('suggestions').innerHTML=matches.slice(0,80).map(v=>`<button class="suggestion" data-code="${v.code}"><strong>${esc(v.name)} · ${v.code}</strong><span>${esc(v.path)} · ${esc(v.oldCode)}</span></button>`).join('')||'<div class="context-note" style="padding:12px">일치하는 변수가 없습니다.</div>';
  $('suggestions').hidden=false;$('variableInput').setAttribute('aria-expanded','true');
  $('suggestions').querySelectorAll('button').forEach(b=>b.onclick=()=>setVariable(b.dataset.code));
}
function chartOptions(code,onClick){return {responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},onClick,
  plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.raw,code,true)}}},
  scales:{x:{grid:{display:false},ticks:{maxTicksLimit:7}},y:{ticks:{callback:x=>fmt(x,code)}}}};}
function createChart(canvas,code,ps,vals,onClick,selected=-1){return new Chart(canvas,{type:'line',data:{labels:ps,datasets:[{data:vals,borderColor:'#2f6f9f',borderWidth:2.2,pointRadius:vals.map((_,i)=>i===selected?6:2.5),pointBackgroundColor:vals.map((_,i)=>i===selected?'#b46648':'#2f6f9f'),pointHitRadius:12,spanGaps:false,tension:.12}]},options:chartOptions(code,onClick)});}
function renderCards(){
  state.charts.forEach(c=>c.destroy());state.charts=[];$('sectorGrid').innerHTML='';$('grid').innerHTML='';
  const [a,b]=range(),ps=data.periods.slice(a,b+1);
  $('aggregateNote').textContent=ratioInputs(state.code)?'업권 비율은 두 금액이 함께 있는 회사의 지급여력금액 합계 ÷ 지급여력기준금액 합계 × 100입니다. 개별 회사 비율은 엑셀 공시값을 표시합니다.':'업권 합계는 해당 분기에 값이 있는 회사만 합산합니다. 분기마다 자료 보유 회사가 달라질 수 있습니다. 하위항목 탐색 시 같은 시점의 자료 보유 범위를 함께 확인하세요.';
  const targets=[{sector:'생명보험'},{sector:'손해보험'},...data.companies.filter(c=>state.selected.has(c.id))];
  for(const target of targets){
    const points=ps.map((_,i)=>model.point(target,state.code,a+i)),vals=points.map(p=>p.value);
    const li=vals.findLastIndex(isValue),p=li>=0?points[li]:points.at(-1);
    const title=target.id?short(target):`${target.sector} ${ratioInputs(state.code)?'통합 비율':'합계'}`;
    const card=document.createElement('article');card.className='chartcard';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`${title} 상세보기`);
    card.innerHTML=`<div class="cardtop"><div><h3>${esc(title)}</h3><div class="sector">${target.id?target.sector:coverage(p)}</div></div><div class="latest"><strong>${li>=0?fmt(vals[li]):'자료 없음'}</strong><span>${li>=0?ps[li]:'선택 기간 내 미관측'}</span></div></div><div class="canvaswrap"><canvas></canvas></div>`;
    card.onclick=()=>openDetail(target);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(target);}};
    $(target.id?'grid':'sectorGrid').appendChild(card);
    state.charts.push(createChart(card.querySelector('canvas'),state.code,ps,vals));
  }
  if(!state.selected.size)$('grid').innerHTML='<div class="empty">왼쪽에서 보험회사를 선택하세요.</div>';
}
function openDetail(target,rootCode=state.code,pi=range()[1],code=rootCode){
  if(!$('modal').classList.contains('open'))state.opener=document.activeElement;
  state.detail={target,rootCode,code,pi};
  $('modalSector').textContent=target.sector;
  $('modalTitle').textContent=target.id?short(target):`${target.sector} ${ratioInputs(rootCode)?'통합 비율':'합계'}`;
  $('modalSub').textContent=`${vmeta(rootCode).path} · ${rootCode}`;
  const [a,b]=range(),ps=data.periods.slice(a,b+1);
  $('detailPeriod').innerHTML=ps.map(p=>`<option>${p}</option>`).join('');$('detailPeriod').value=data.periods[pi];
  $('modal').hidden=false;$('modal').classList.add('open');$('modal').classList.toggle('industry-detail',!target.id);document.body.style.overflow='hidden';
  state.chart?.destroy();
  state.chart=createChart($('modalCanvas'),rootCode,ps,ps.map((_,i)=>model.point(target,rootCode,a+i).value),(event,els)=>{if(els.length)selectPeriod(a+els[0].index);},pi-a);
  $('excludeOpening').checked=state.excludeOpening||false;
  renderTrendTable();renderComposition();$('modal').querySelector('.panel').scrollTop=0;$('close').focus();
}
function closeDetail(){$('modal').classList.remove('open');$('modal').hidden=true;document.body.style.overflow='';state.chart?.destroy();state.chart=null;state.detail=null;state.opener?.focus();}
function selectPeriod(pi){
  state.detail.pi=pi;$('detailPeriod').value=data.periods[pi];
  const [a,b]=range();state.chart.data.datasets[0].pointRadius=data.periods.slice(a,b+1).map((_,i)=>i===pi-a?6:2.5);
  state.chart.data.datasets[0].pointBackgroundColor=data.periods.slice(a,b+1).map((_,i)=>i===pi-a?'#b46648':'#2f6f9f');state.chart.update();
  renderTrendTable();renderComposition();
}
function renderTrendTable(){
  const {target,rootCode,pi}=state.detail,[a,b]=range();
  const points=data.periods.map((_,i)=>model.point(target,rootCode,i)),v=points[pi].value,unit=vmeta(rootCode).unit==='%';
  const dq=change(v,points[pi-1]?.value,unit),dy=change(v,points[pi-4]?.value,unit),valid=points.slice(a,b+1).map(p=>p.value).filter(isValue);
  const stats=[['선택 시점',data.periods[pi]],['선택 값',fmt(v,rootCode)],['자료 보유',`${points[pi].count}/${points[pi].total}개사`],['전분기 대비',delta(dq,rootCode)],['전년동기 대비',delta(dy,rootCode)],['기간 범위',valid.length?`${fmt(Math.min(...valid),rootCode)} ~ ${fmt(Math.max(...valid),rootCode)}`:'자료 없음']];
  $('stats').innerHTML=stats.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${esc(v)}</strong></div>`).join('');
  $('tbody').innerHTML=data.periods.slice(a,b+1).map((p,j)=>{const i=a+j,v=points[i].value,q=change(v,points[i-1]?.value,unit),y=change(v,points[i-4]?.value,unit);return `<tr class="${i===pi?'row-selected':''}"><td><button data-pi="${i}" aria-label="${p} 구성 보기">${p}</button></td><td title="${esc(fmt(v,rootCode,true))}">${fmt(v,rootCode)}</td><td class="${cls(q)}">${delta(q,rootCode)}</td><td class="${cls(y)}">${delta(y,rootCode)}</td><td>${points[i].count}/${points[i].total}</td></tr>`;}).reverse().join('');
  $('tbody').querySelectorAll('button').forEach(b=>b.onclick=()=>selectPeriod(Number(b.dataset.pi)));
}
function browse(code){state.detail.code=code;renderComposition();}
function drawMap(host,rows,onSelect){
  host.innerHTML='';const layouts=treemap(rows);
  if(!layouts.length){host.innerHTML='<div class="empty-map">면적으로 표시할 비영(非零) 값이 없습니다. 공시된 0과 미공시 항목은 아래 표에서 구분할 수 있습니다.</div>';return;}
  const map=document.createElement('div');map.className='treemap';host.appendChild(map);
  const total=rows.reduce((s,v)=>s+(isValue(v.value)?Math.abs(v.value):0),0);
  for(const item of layouts){
    const tile=document.createElement('button');tile.className=`tree-tile ${item.value<0?'negative':''} ${item.w*item.h<220||item.w<10||item.h<12?'tiny':''}`;
    Object.assign(tile.style,{left:item.x+'%',top:item.y+'%',width:item.w+'%',height:item.h+'%'});
    const label=`${item.name} · ${fmt(item.value,item.code,true)} · 절댓값 비중 ${percent(Math.abs(item.value)/total)}`;
    tile.title=label;tile.setAttribute('aria-label',label);
    tile.innerHTML=`<strong>${esc(item.name)}</strong><span>${fmt(item.value,item.code)}</span><span>${percent(Math.abs(item.value)/total)}${item.count!=null?` · ${item.count}/${item.total}개사`:''}</span>`;
    if(item.h/100*map.clientHeight<82||item.w/100*map.clientWidth<110)tile.classList.add('compact');
    tile.onclick=()=>onSelect(item);map.appendChild(tile);
  }
}
function rowTable(rows,onSelect,{open=false,title='항목별 금액·비중',shares=true}={}){
  const detail=document.createElement('details');detail.className='detail-toggle';detail.open=open;
  detail.innerHTML=`<summary>${esc(title)} (${rows.length}개)</summary><div class="table-scroll"><table><thead><tr><th>항목</th><th>원문 금액</th>${shares?'<th>절댓값 비중</th>':''}<th>자료 보유</th></tr></thead><tbody>${rows.map((v,i)=>`<tr><td><button data-row="${i}">${esc(v.name)} <small>${esc(v.code)}</small></button></td><td>${fmt(v.value,v.code,true)}</td>${shares?`<td>${percent(v.share)}</td>`:''}<td>${v.count}/${v.total}</td></tr>`).join('')}</tbody></table></div>`;
  detail.querySelectorAll('button').forEach(b=>b.onclick=()=>onSelect(rows[Number(b.dataset.row)]));return detail;
}
function renderComposition(){
  const {target,code,pi}=state.detail,v=vmeta(code),result=model.components(target,code,pi,state.excludeOpening),{parent,rows,references,excluded}=result;
  const ancestors=[];let node=v;while(node){ancestors.unshift(node);node=vmeta(node.parent);}
  $('breadcrumbs').innerHTML=ancestors.map(x=>`<button data-code="${x.code}" ${x.code===code?'aria-current="page"':''}>${esc(x.name)} · ${x.code}</button>`).join('<span>›</span>');
  $('breadcrumbs').querySelectorAll('button').forEach(b=>b.onclick=()=>browse(b.dataset.code));
  $('up').disabled=!v.parent;$('up').onclick=()=>v.parent&&browse(v.parent);
  $('compositionValue').innerHTML=`${esc(v.name)} · ${fmt(parent.value,code)}<small>${data.periods[pi]} · ${coverage(parent)}${target.id?'':' · 하위항목도 이 회사 범위에서 집계'}</small>`;
  $('compositionNote').textContent=compositionNote(code);
  $('componentsMap').innerHTML='';$('componentsTable').innerHTML='';
  const ratio=ratioInputs(code);
  if(ratio){
    const numerator=rows.find(r=>r.code===ratio[0]),denominator=rows.find(r=>r.code===ratio[1]);
    const computed=isValue(numerator?.value)&&isValue(denominator?.value)&&denominator.value>0?numerator.value/denominator.value*100:null;
    $('componentsMap').innerHTML=`<div class="formula"><div class="formula-values">${fmt(numerator?.value,ratio[0])} ÷ ${fmt(denominator?.value,ratio[1])} × 100</div>금액 기준 재계산: ${fmt(computed,code)}<br>${target.id?'공시 비율과는 반올림·금액 표시 정밀도에 따른 차이가 있을 수 있습니다.':'분자·분모가 함께 관측된 동일 회사 집합으로 계산합니다.'}<div>${rows.map(r=>`<button data-code="${r.code}">${esc(r.name)} 구성 보기</button>`).join('')}</div></div>`;
    $('componentsMap').querySelectorAll('button').forEach(b=>b.onclick=()=>browse(b.dataset.code));
    $('componentsTable').appendChild(rowTable(rows,x=>browse(x.code),{shares:false}));
  } else if(!model.children.get(code)?.length){
    $('componentsMap').innerHTML='<div class="empty-map">수집된 변수체계의 마지막 단계입니다. 더 세분화된 하위 변수는 없습니다.</div>';
  } else {
    drawMap($('componentsMap'),rows,x=>browse(x.code));
    const missing=rows.filter(r=>!isValue(r.value)||r.count<r.total),zero=rows.filter(r=>r.value===0);
    if(missing.length){const p=document.createElement('p');p.className='missing-note';p.textContent=`미공시 또는 회사 범위가 불완전한 하위항목 ${missing.length}개. 관측된 금액만으로 비중을 계산합니다.`;$('componentsTable').appendChild(p);}
    if(zero.length){const p=document.createElement('p');p.className='zero-note';p.textContent=`공시값 0: ${zero.map(x=>x.name).join(', ')} (면적 없음)`;$('componentsTable').appendChild(p);}
    $('componentsTable').appendChild(rowTable(rows,x=>browse(x.code),{open:Boolean(target.id)}));
  }
  if(excluded.length){const p=document.createElement('p');p.className='context-note';p.textContent=`기초잔액을 제외한 절댓값 합계 ${fmt(result.absTotal,code)} 기준입니다. 왼쪽 추이의 금액은 변하지 않습니다.`;$('componentsTable').appendChild(p);}
  if(references.length)$('componentsTable').appendChild(rowTable(references,x=>browse(x.code),{title:'참고항목 · 구성도 면적에서 제외',shares:false}));
  if(!target.id){const missing=idsText(target,parent.ids);if(missing){const p=document.createElement('p');p.className='missing-note';p.textContent=`현재 상위항목 미관측 회사: ${missing}`;$('componentsTable').appendChild(p);}}
  renderCompanyComposition();
}
function renderCompanyComposition(){
  const {target,code,pi,rootCode}=state.detail;
  $('companyComposition').hidden=Boolean(target.id);if(target.id)return;
  const ratio=ratioInputs(code),previous=$('companyMeasure').value;
  $('companyMeasure').innerHTML=(ratio||[code]).map(c=>`<option value="${c}">${esc(vmeta(c).name)}</option>`).join('');
  if((ratio||[code]).includes(previous))$('companyMeasure').value=previous;
  $('companyMeasure').hidden=!ratio;
  const measure=$('companyMeasure').value;
  const parent=model.point(target,code,pi),eligible=new Set(parent.ids),members=model.members(target);
  const rows=members.map(c=>({id:c.id,name:short(c),code:measure,value:eligible.has(c.id)?model.value(c.id,measure,pi):null,count:eligible.has(c.id)&&isValue(model.value(c.id,measure,pi))?1:0,total:1}));
  const absTotal=rows.reduce((s,r)=>s+(isValue(r.value)?Math.abs(r.value):0),0);
  rows.forEach(r=>r.share=isValue(r.value)&&absTotal?Math.abs(r.value)/absTotal:null);
  const count=rows.filter(r=>isValue(r.value)).length;
  $('companyCoverage').textContent=`${data.periods[pi]} · ${vmeta(measure).name} · 자료 보유 ${count}/${members.length}개사. ${ratio?'비율 자체를 회사별 지분으로 더하지 않고, 동일 회사 범위의 선택 금액을 비교합니다. ':''}면적은 회사별 금액의 절댓값 기준입니다. 회사를 클릭하면 상세보기로 이동합니다.`;
  const onSelect=r=>openDetail(data.companies.find(c=>c.id===r.id),rootCode,pi,code);
  drawMap($('companiesMap'),rows,onSelect);
  $('companiesTable').innerHTML='';$('companiesTable').appendChild(rowTable(rows,onSelect,{title:'회사별 금액·비중·결측'}));
  const missing=rows.filter(r=>!isValue(r.value));if(missing.length){const p=document.createElement('p');p.className='missing-note';p.textContent=`미관측: ${missing.map(r=>r.name).join(', ')}`;$('companiesTable').appendChild(p);}
}
async function start(){
  const response=await fetch('./data/disclosure/panel.json.gz.b64?v=20261108');if(!response.ok)throw new Error('공시 데이터 파일을 불러오지 못했습니다.');
  const bytes=Uint8Array.from(atob((await response.text()).trim()),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));data=await new Response(stream).json();model=createModel(data);
  if(typeof Chart==='undefined')throw new Error('차트 도구를 불러오지 못했습니다. 네트워크 연결을 확인한 후 새로고침하세요.');
  for(const id of ['start','end']){$(id).innerHTML=data.periods.map(p=>`<option>${p}</option>`).join('');$(id).value=id==='start'?data.periods[0]:data.periods.at(-1);$(id).onchange=renderCards;}
  $('groupSelect').innerHTML='<option value="">전체 분류</option>'+[...new Set(data.variables.map(v=>v.group))].map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');
  $('groupSelect').onchange=()=>{$('variableInput').value='';suggestions();};
  $('sourceName').textContent=`자료: ${data.source} · DATA 및 변수정보 시트. 2026-11-08 갱신. 엑셀의 보완값을 그대로 반영하며 사이트에서 추가 추정하지 않습니다.`;
  $('companySearch').oninput=renderCompanies;
  $('selectVisible').onclick=()=>{visibleCompanies().forEach(c=>state.selected.add(c.id));renderCompanies();renderCards();};
  $('clearCompanies').onclick=()=>{state.selected.clear();renderCompanies();renderCards();};
  $('variableInput').onfocus=suggestions;$('variableInput').oninput=suggestions;
  $('variableInput').onkeydown=e=>{if(e.key==='Escape')hideSuggestions();if(e.key==='Enter'){const b=$('suggestions').querySelector('button');if(b){e.preventDefault();b.click();}}if(e.key==='ArrowDown'){e.preventDefault();$('suggestions').querySelector('button')?.focus();}};
  $('close').onclick=closeDetail;document.querySelector('[data-close]').onclick=closeDetail;
  $('detailPeriod').onchange=()=>selectPeriod(data.periods.indexOf($('detailPeriod').value));
  $('excludeOpening').onchange=()=>{state.excludeOpening=$('excludeOpening').checked;renderComposition();};
  $('companyMeasure').onchange=renderCompanyComposition;
  document.addEventListener('click',e=>{if(!e.target.closest('.field'))hideSuggestions();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(state.detail)closeDetail();else hideSuggestions();}
    if(e.key==='Tab'&&state.detail){const els=[...$('modal').querySelectorAll('button:not([disabled]),select,input,a[href],summary')].filter(el=>el.getClientRects().length);const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  renderCompanies();const hash=location.hash.slice(1);setVariable(model.byCode.has(hash)?hash:state.code);
}
start().catch(error=>{console.error(error);$('grid').innerHTML=`<div class="empty">${esc(error.message)}<br><button class="btn" onclick="location.reload()">다시 불러오기</button></div>`;$('varName').textContent='데이터를 불러오지 못했습니다.';});
