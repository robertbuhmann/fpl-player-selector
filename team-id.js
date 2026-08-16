(()=>{
  const KEY='fpl-entry-id';
  let busy=false;

  function inject(){
    if(document.getElementById('teamIdPanel'))return;
    const intro=document.querySelector('.team-intro');
    if(!intro)return;
    const panel=document.createElement('section');
    panel.id='teamIdPanel';
    panel.className='team-id-panel';
    panel.innerHTML=`<div class="team-id-copy"><h3>Load from FPL Team ID <span class="recommended">Recommended</span></h3><p>Enter your FPL entry ID to load the latest publicly available squad directly from the official FPL API.</p></div><div class="team-id-controls"><input id="teamIdInput" inputmode="numeric" pattern="[0-9]*" placeholder="e.g. 1234567" value="${localStorage.getItem(KEY)||''}"><button id="loadTeamId">Load my team</button></div><div id="teamIdStatus" class="team-id-status"></div>`;
    intro.insertAdjacentElement('afterend',panel);
    document.getElementById('loadTeamId').onclick=load;
    document.getElementById('teamIdInput').addEventListener('keydown',e=>{if(e.key==='Enter')load()});
  }

  function status(msg,kind='info'){
    const el=document.getElementById('teamIdStatus');if(!el)return;
    el.className=`team-id-status ${kind}`;el.innerHTML=msg;
  }

  async function applyTeam(data){
    const picks=[...(data.picks||[])].sort((a,b)=>a.position-b.position);
    if(!picks.length)return;
    for(let i=0;i<Math.min(15,picks.length);i++){
      const pick=picks[i];
      const player=document.querySelector(`[data-slot="${i}"]`);
      const role=document.querySelector(`[data-role="${i}"]`);
      if(player){player.value=String(pick.playerId);player.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,25));}
      const role2=document.querySelector(`[data-role="${i}"]`);
      if(role2){role2.value=pick.role;role2.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20));}
    }
    await new Promise(r=>setTimeout(r,50));
    const cap=document.getElementById('captain');if(cap){cap.value=String(data.captainId||'');cap.dispatchEvent(new Event('change',{bubbles:true}));}
    await new Promise(r=>setTimeout(r,30));
    const vice=document.getElementById('vice');if(vice){vice.value=String(data.viceId||'');vice.dispatchEvent(new Event('change',{bubbles:true}));}
  }

  async function load(){
    if(busy)return;
    const input=document.getElementById('teamIdInput');const entry=input?.value?.trim();
    if(!entry||!/^[0-9]+$/.test(entry)){status('<strong>Enter a valid numeric FPL Team ID.</strong>','error');return;}
    busy=true;localStorage.setItem(KEY,entry);status('<strong>Loading your squad from FPL…</strong>');
    try{
      const r=await fetch(`/api/team?entry=${encodeURIComponent(entry)}`,{cache:'no-store'});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Could not load team');
      if(!data.publicPicksAvailable){status(`<strong>${data.teamName||'Team found'}, but no public picks are available yet.</strong> ${data.message||''} Use screenshot import below for unpublished changes.`,'warn');return;}
      await applyTeam(data);
      status(`<strong>Loaded ${data.teamName||'your team'} from GW${data.event}.</strong> Starting XI, bench, captain and vice-captain were populated from the official FPL API. If you have made changes after that deadline, use screenshot import or edit the squad below.`,'success');
    }catch(e){status(`<strong>Could not load that team.</strong> ${e.message||''}`,'error')}
    finally{busy=false}
  }

  const observer=new MutationObserver(()=>inject());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',inject);
  setTimeout(inject,300);
})();
