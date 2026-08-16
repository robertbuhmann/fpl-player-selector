(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]+/g,' ').trim();
  const lev=(a,b)=>{a=norm(a);b=norm(b);const m=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=0;j<=b.length;j++)m[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return m[a.length][b.length]};
  const teamAliases={
    ARS:['ars','arsenal'],AVL:['avl','aston villa','villa'],BOU:['bou','bournemouth'],BRE:['bre','brentford'],BHA:['bha','brighton'],BUR:['bur','burnley'],CHE:['che','chelsea'],CRY:['cry','crystal palace','palace'],EVE:['eve','everton'],FUL:['ful','fulham'],LEE:['lee','leeds'],LIV:['liv','liverpool'],MCI:['mci','man city','manchester city'],MUN:['mun','man utd','man united','manchester united'],NEW:['new','newcastle'],NFO:['nfo','nottingham forest','forest'],SUN:['sun','sunderland'],TOT:['tot','tottenham','spurs'],WHU:['whu','west ham'],WOL:['wol','wolves','wolverhampton']
  };
  function status(html,kind='info'){
    let el=document.getElementById('ocrStatus');
    if(!el){el=document.createElement('div');el.id='ocrStatus';const anchor=document.querySelector('.team-intro');if(anchor)anchor.insertAdjacentElement('afterend',el);else document.querySelector('.app')?.prepend(el)}
    el.className=`ocr-status ${kind}`;el.innerHTML=html;
  }
  function availablePlayers(){
    const sel=document.querySelector('[data-slot="0"]');
    if(!sel)return[];
    return [...sel.options].filter(o=>o.value).map(o=>{
      const txt=o.textContent||'';
      const m=txt.match(/^(.+?)\s+—\s+(.+?)\s+\([^,]+,\s*£([0-9.]+)m\)$/);
      return{id:o.value,name:(m?.[1]||txt.split(' — ')[0]).trim(),team:(m?.[2]||'').trim(),price:Number(m?.[3]||0)};
    });
  }
  function parsePrice(line){
    const vals=[...String(line||'').matchAll(/(?:£\s*)?([0-9]{1,2}(?:[.,][0-9])?)(?:\s*m)?/gi)].map(m=>Number(m[1].replace(',','.'))).filter(v=>v>=3.5&&v<=20);
    return vals;
  }
  function nameScore(lineName,playerName){
    const l=norm(lineName),p=norm(playerName);if(!l||!p)return 0;
    if(l.includes(p))return 1;
    const pParts=p.split(' '),lParts=l.split(' '),surname=pParts[pParts.length-1];
    let best=0;
    for(const part of lParts){
      if(part.length<3)continue;
      const d=lev(part,surname);const allowed=surname.length>=8?2:1;
      if(d<=allowed)best=Math.max(best,.78-d*.12);
    }
    if(pParts.length>1){
      const initial=pParts[0][0];
      if(lParts.some(x=>x[0]===initial)&&lParts.some(x=>lev(x,surname)<=1))best+=.08;
    }
    return Math.min(1,best);
  }
  function candidateScore(player,line,context){
    let score=nameScore(line.n,player.name)*100;
    if(score<55)return{score:0,reasons:[]};
    const reasons=[];
    const prices=parsePrice(`${line.raw} ${context}`);
    if(prices.length){
      const delta=Math.min(...prices.map(v=>Math.abs(v-player.price)));
      if(delta<.01){score+=38;reasons.push(`£${player.price.toFixed(1)}`)}
      else if(delta<=.1){score+=28;reasons.push(`price≈£${player.price.toFixed(1)}`)}
      else if(delta<=.5)score+=6;
      else score-=18;
    }
    const ctx=norm(`${line.raw} ${context}`);
    const teamKey=Object.keys(teamAliases).find(k=>teamAliases[k].some(a=>norm(player.team)===norm(a)||norm(player.team)===norm(k)))||player.team;
    const aliases=[norm(player.team),...(teamAliases[teamKey]||[])].filter(Boolean);
    if(aliases.some(a=>ctx.includes(norm(a)))){score+=30;reasons.push(player.team)}
    return{score,reasons};
  }
  function detectPlayers(text,players){
    const rawLines=String(text||'').split(/\n+/).map((raw,i)=>({i,raw,n:norm(raw)})).filter(x=>x.n);
    const claims=[];
    for(const line of rawLines){
      const context=[rawLines[line.i-1]?.raw,rawLines[line.i+1]?.raw].filter(Boolean).join(' ');
      const ranked=players.map(p=>({p,...candidateScore(p,line,context)})).filter(x=>x.score>=58).sort((a,b)=>b.score-a.score);
      if(!ranked.length)continue;
      const best=ranked[0],second=ranked[1];
      const margin=best.score-(second?.score||0);
      if(best.score>=82||margin>=18){claims.push({id:best.p.id,name:best.p.name,team:best.p.team,price:best.p.price,line:line.i,score:best.score,reasons:best.reasons,margin})}
    }
    claims.sort((a,b)=>a.line-b.line||b.score-a.score);
    const usedPlayers=new Set(),usedLines=new Set(),out=[];
    for(const c of claims){
      if(usedPlayers.has(c.id)||usedLines.has(c.line))continue;
      usedPlayers.add(c.id);usedLines.add(c.line);out.push(c);
    }
    return out.slice(0,15);
  }
  async function fillSlots(matches){
    for(let i=0;i<matches.length&&i<15;i++){
      const sel=document.querySelector(`[data-slot="${i}"]`);if(!sel)break;
      sel.value=matches[i].id;sel.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,30));
    }
  }
  async function process(file){
    if(!file||!file.type.startsWith('image/')){status('<strong>Could not read that file.</strong> Please choose an image screenshot.','error');return}
    if(!window.Tesseract){status('<strong>Screenshot reader did not load.</strong> Refresh the page and try again.','error');return}
    status('<strong>Reading screenshot…</strong> Matching name, club and price.');
    try{
      const worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')status(`<strong>Reading screenshot…</strong> ${Math.round((m.progress||0)*100)}%`)}});
      const result=await worker.recognize(file);await worker.terminate();
      const players=availablePlayers(),matches=detectPlayers(result?.data?.text||'',players);
      if(!matches.length){status('<strong>No players were confidently detected.</strong> Try a full-resolution screenshot or select players manually.','warn');return}
      await fillSlots(matches);
      const names=matches.map(x=>`${x.name} (${x.team}, £${x.price.toFixed(1)}m)`).join(', ');
      status(`<strong>Detected ${matches.length} player${matches.length===1?'':'s'} using name + club + price matching.</strong> ${names}. <strong>Please still verify the squad before using the projection.</strong>`,matches.length>=11?'success':'warn');
    }catch(err){console.error(err);status('<strong>Screenshot reading failed.</strong> You can still enter the squad manually.','error')}
  }
  document.addEventListener('change',e=>{if(e.target?.id==='teamScreenshot'){const f=e.target.files?.[0];if(f)setTimeout(()=>process(f),60)}});
})();
