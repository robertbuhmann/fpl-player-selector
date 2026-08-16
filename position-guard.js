(()=>{
  const LIMITS={GKP:2,DEF:5,MID:5,FWD:3};
  const previous=new WeakMap();
  let normalizing=false;
  let timer=null;
  const label=p=>`${p.name} — ${p.team} (${p.position}, £${Number(p.price).toFixed(1)}m)`;

  function show(message){
    let el=document.getElementById('squadRuleStatus');
    if(!el){
      el=document.createElement('div');
      el.id='squadRuleStatus';
      el.className='ocr-status warn';
      const card=document.querySelector('.squad-card');
      card?.prepend(el);
    }
    if(el){
      el.className='ocr-status warn';
      el.innerHTML=`<strong>Squad rule:</strong> ${message}`;
    }
  }

  function normalizeExisting(){
    if(normalizing||!window.fplApp?.setPlayerSlot)return;
    const inputs=[...document.querySelectorAll('[data-slot-input][data-position]')];
    if(!inputs.length)return;
    const excess=[];
    for(const [pos,limit] of Object.entries(LIMITS)){
      const row=inputs.filter(el=>el.dataset.position===pos);
      if(row.length>limit){
        row.slice(limit).forEach(el=>{
          const slot=Number(el.dataset.slotInput);
          if(Number.isInteger(slot))excess.push({slot,pos});
        });
      }
    }
    if(!excess.length)return;
    normalizing=true;
    const removed=[];
    for(const x of excess){
      window.fplApp.setPlayerSlot(x.slot,'');
      removed.push(x.pos);
    }
    show(`An older/imported squad exceeded FPL position limits and was corrected automatically. Limits are 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards.`);
    window.fplApp.render?.();
    setTimeout(()=>{normalizing=false},0);
  }

  function scheduleNormalize(){
    clearTimeout(timer);
    timer=setTimeout(normalizeExisting,30);
  }

  document.addEventListener('focusin',e=>{
    if(e.target?.matches?.('[data-slot-input]'))previous.set(e.target,e.target.value);
  },true);

  document.addEventListener('change',e=>{
    const target=e.target;
    if(!target?.matches?.('[data-slot-input]'))return;
    const players=window.fplApp?.getPlayers?.()||[];
    const byLabel=new Map(players.map(p=>[label(p),p]));
    const selected=[...document.querySelectorAll('[data-slot-input]')].map(input=>byLabel.get(input.value.trim())).filter(Boolean);
    const counts={GKP:0,DEF:0,MID:0,FWD:0};
    selected.forEach(p=>{if(counts[p.position]!=null)counts[p.position]++});
    const invalid=Object.keys(LIMITS).find(pos=>counts[pos]>LIMITS[pos]);
    if(!invalid){scheduleNormalize();return;}
    e.preventDefault();
    e.stopImmediatePropagation();
    target.value=previous.get(target)||'';
    show(`FPL squads can contain only ${LIMITS[invalid]} ${invalid==='GKP'?'goalkeepers':invalid==='DEF'?'defenders':invalid==='MID'?'midfielders':'forwards'}. That selection was not added.`);
  },true);

  const observer=new MutationObserver(scheduleNormalize);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scheduleNormalize);
  setTimeout(scheduleNormalize,300);
})();