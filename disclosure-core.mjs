// Pure data helpers: source values are never filled, re-quarterized or overwritten.
export const isValue = x => typeof x === 'number' && Number.isFinite(x);
export const ratioInputs = code => code === 'V118' ? ['V119','V139'] : code === 'V166' ? ['V167','V187'] : null;
export function createModel(data) {
  const byCode = new Map(data.variables.map(v => [v.code, v]));
  const children = new Map(data.variables.map(v => [v.code, []]));
  for (const v of data.variables) if (v.parent) children.get(v.parent)?.push(v);
  const value = (id, code, pi) => data.series[id]?.[code]?.[pi] ?? null;
  const members = target => target.id ? data.companies.filter(c => c.id === target.id) : data.companies.filter(c => c.sector === target.sector);
  function point(target, code, pi, restrict) {
    const all = members(target).filter(c => !restrict || restrict.has(c.id));
    const ratio = ratioInputs(code);
    if (!target.id && ratio) {
      const valid = all.filter(c => ratio.every(k => isValue(value(c.id,k,pi))) && value(c.id,ratio[1],pi)>0);
      const numerator = valid.reduce((s,c)=>s+value(c.id,ratio[0],pi),0);
      const denominator = valid.reduce((s,c)=>s+value(c.id,ratio[1],pi),0);
      return {value: valid.length && denominator>0 ? numerator/denominator*100 : null, count:valid.length, total:all.length, ids:valid.map(c=>c.id), numerator, denominator};
    }
    const valid=all.filter(c=>isValue(value(c.id,code,pi)));
    return {value:valid.length ? valid.reduce((s,c)=>s+value(c.id,code,pi),0) : null, count:valid.length,total:all.length,ids:valid.map(c=>c.id)};
  }
  function components(target,code,pi,excludeOpening=false) {
    const parent=point(target,code,pi);
    // Industry children use only companies observed for this parent at this date.
    const restrict=target.id ? null : new Set(parent.ids);
    const rows=(children.get(code)||[]).map(v=>({ ...v, ...point(target,v.code,pi,restrict) }));
    const references=rows.filter(isReference);
    const excluded=rows.filter(v=>!isReference(v)&&excludeOpening&&isOpening(v));
    const included=rows.filter(v=>!isReference(v)&&!(excludeOpening&&isOpening(v)));
    const absTotal=included.reduce((s,v)=>s+(isValue(v.value)?Math.abs(v.value):0),0);
    return {parent,rows:included.map(v=>({...v,share:absTotal&&isValue(v.value)?Math.abs(v.value)/absTotal:null})),references,excluded,absTotal};
  }
  return {data,byCode,children,value,members,point,components};
}
export const isOpening = v => v.kind === '분기 기초' || v.kind === '연초 참고';
export const isReference = v => /참고/.test(v.name) || v.kind === '연초 참고';
export function change(a,b,percentUnit=false) {
  if (!isValue(a)||!isValue(b)) return null;
  if (percentUnit) return a-b;
  return b === 0 ? null : (a-b)/Math.abs(b)*100;
}
export function treemap(items,x=0,y=0,w=100,h=100) {
  const rows=items.filter(v=>isValue(v.value)&&v.value!==0).map(v=>({...v,weight:Math.abs(v.value)})).sort((a,b)=>b.weight-a.weight);
  const out=[];
  function split(arr,x,y,w,h) {
    if (!arr.length) return;
    if (arr.length===1) {out.push({...arr[0],x,y,w,h});return;}
    const total=arr.reduce((s,v)=>s+v.weight,0);
    let k=1,subtotal=arr[0].weight;
    while(k<arr.length-1 && Math.abs(subtotal+arr[k].weight-total/2)<Math.abs(subtotal-total/2)) subtotal+=arr[k++].weight;
    const fraction=subtotal/total;
    if(w>=h) {split(arr.slice(0,k),x,y,w*fraction,h);split(arr.slice(k),x+w*fraction,y,w*(1-fraction),h);}
    else {split(arr.slice(0,k),x,y,w,h*fraction);split(arr.slice(k),x,y+h*fraction,w,h*(1-fraction));}
  }
  split(rows,x,y,w,h);return out;
}
export function compositionNote(code) {
  if (ratioInputs(code)) return '지급여력비율 = 지급여력금액 ÷ 지급여력기준금액 × 100. 두 금액은 구성비로 합산하지 않습니다.';
  if (['V142','V150','V153','V190','V198','V201'].includes(code)) return '위험액은 상관관계·분산효과를 반영하므로 하위 위험액의 단순합계와 상위 금액이 다를 수 있습니다. 면적은 하위 위험액 절댓값 합계 기준입니다.';
  if (['V120','V168','V132','V180','V139','V187'].includes(code)) return '자본의 차감·한도·재분류가 포함된 계층입니다. 표시 금액의 부호는 원자료를 유지하며, 면적은 회계적 기여도나 자본 산식의 계수가 아닙니다.';
  if (['V002','V028','V031','V004'].includes(code)) return '수익·비용 또는 일부 공시 세부항목의 규모 비교입니다. 비용의 원자료 부호를 유지하므로 하위항목의 단순합계가 상위 손익과 같다는 뜻은 아닙니다.';
  if (['V035','V060','V085'].includes(code)) return '일반모형+VFA를 클릭하면 기초와 변동 구성으로 내려갑니다. 상위 잔액과 하위 잔액을 중복 합산하지 않습니다.';
  return '바로 아래 단계만 표시합니다. 면적·비중은 표시 항목의 절댓값 합계 기준이며 상위 금액 대비 비중이 아닙니다. 검증 후 보완된 0·역산값은 엑셀을 따르며, 남은 결측은 공란으로 유지합니다. 변수 정의·자료 안내에서 보완 방법을 확인하세요.';
}
