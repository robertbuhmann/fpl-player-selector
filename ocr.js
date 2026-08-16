(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const lev=(a,b)=>{a=norm(a);b=norm(b);const m=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=0;j<=b.length;j++)m[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return m[a.length][b.length]};
  function status(html,kind='info'){
    let el=document.getElementById('ocrStatus');
    if(!el){el=document.createElement('div');el.id='ocrStatus';const anchor=document.querySelector('.team-intro');if(anchor)anchor.insertAdjacentElement('afterend',el);else document.querySelector('.app')?.prepend(el)}
    el.className=`ocr-status ${kind}`;el.innerHTML=html;
  }
  function availablePlayers(){
    const sel=document.querySelector('[data-slot="0"]');
    if(!sel)return[];
    return [...sel.options].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent.split(' — ')[0].trim()}));
  }
  function detectPlayers(text,players){
    const raw=norm(text),lines=String(text||'').split(/\n+/).map((line,i)=>({i,raw:line,n:norm(line)})).filter(x=>x.n);
    const found=[];
    for(const p of players){
      const n=norm(p.name);if(n.length<3)continue;
      let idx=raw.indexOf(n),confidence=idx>=0?1:0;
      if(idx<0&&n.length>=4){
        let best={d:999,i:999};
        for(const line of lines){
          const parts=line.n.split(' ');
          for(const part of parts){if(Math.abs(part.length-n.length)>2)continue;const d=lev(part,n);if(d<best.d)best={d,i:line.i}}
        }
        const allowed=n.length>=8?2:1;
        if(best.d<=allowed){idx=100000+best.i*100;confidence=.75-best.d*.1}
      }
      if(idx>=0)found.push({...p,idx,confidence});
    }
    return found.sort((a,b)=>a.idx-b.idx||b.confidence-a.confidence).filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i).slice(0,15);
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
    status('<strong>Reading screenshot…</strong> Preparing OCR. This can take a little while the first time.');
    try{
      const worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')status(`<strong>Reading screenshot…</strong> ${Math.round((m.progress||0)*100)}%`)}});
      const result=await worker.recognize(file);
      await worker.terminate();
      const players=availablePlayers();
      const matches=detectPlayers(result?.data?.text||'',players);
      if(!matches.length){status('<strong>No player names were confidently detected.</strong> The screenshot is still shown below; you can select the players manually. Try a full-resolution FPL screenshot for better recognition.','warn');return}
      await fillSlots(matches);
      const names=matches.map(x=>x.name).join(', ');
      status(`<strong>Detected ${matches.length} player${matches.length===1?'':'s'}.</strong> I filled the squad selectors with: ${names}. <strong>Please check every name and the Starting XI/Bench assignments before using the projection.</strong>`,matches.length>=11?'success':'warn');
    }catch(err){console.error(err);status('<strong>Screenshot reading failed.</strong> The image is still available as a reference, so you can enter the players manually.','error')}
  }
  document.addEventListener('change',e=>{if(e.target?.id==='teamScreenshot'){const f=e.target.files?.[0];if(f)setTimeout(()=>process(f),60)}});
})();
