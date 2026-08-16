(()=>{
  const LIMITS={GKP:2,DEF:5,MID:5,FWD:3};
  const previous=new WeakMap();
  const label=p=>`${p.name} — ${p.team} (${p.position}, £${Number(p.price).toFixed(1)}m)`;
  function show(message){let el=document.getElementById('squadRuleStatus');if(!el){el=document.createElement('div');el.id='squadRuleStatus';el.className='ocr-status warn';const card=document.querySelector('.squad-card');card?.prepend(el)}if(el){el.className='ocr-status warn';el.innerHTML=`<strong>Squad rule:</strong> ${message}`}}
  document.addEventListener('focusin',e=>{if(e.target?.matches?.('[data-slot-input]'))previous.set(e.target,e.target.value)},true);
  document.addEventListener('change',e=>{
    const target=e.target;if(!target?.matches?.('[data-slot-input]'))return;
    const players=window.fplApp?.getPlayers?.()||[];
    const byLabel=new Map(players.map(p=>[label(p),p]));
    const selected=[...document.querySelectorAll('[data-slot-input]')].map(input=>byLabel.get(input.value.trim())).filter(Boolean);
    const counts={GKP:0,DEF:0,MID:0,FWD:0};selected.forEach(p=>{if(counts[p.position]!=null)counts[p.position]++});
    const invalid=Object.keys(LIMITS).find(pos=>counts[pos]>LIMITS[pos]);
    if(!invalid)return;
    e.preventDefault();e.stopImmediatePropagation();
    target.value=previous.get(target)||'';
    show(`FPL squads can contain only ${LIMITS[invalid]} ${invalid==='GKP'?'goalkeepers':invalid==='DEF'?'defenders':invalid==='MID'?'midfielders':'forwards'}. That selection was not added.`);
  },true);
})();