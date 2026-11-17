/* Small marketing interactions only. No application runtime or render engine. */
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches;
  // Pause motion: its own row under the footer columns. When the system already asks for reduced
  // motion there is nothing to pause, and "Resume motion" would only invite motion back: it hides.
  const pause=document.createElement('button');pause.type='button';pause.className='pause';pause.id='pause';const tools=document.createElement('div');tools.className='foot-tools';tools.append(pause);$('.foot-cols').after(tools);
  function motion(){document.body.classList.toggle('motion-paused',paused);pause.textContent=paused?'Resume motion':'Pause motion';pause.setAttribute('aria-pressed',String(paused));tools.hidden=reduced.matches;document.dispatchEvent(new CustomEvent('site-motion',{detail:paused}));}
  pause.onclick=()=>{paused=!paused;motion();};reduced.addEventListener('change',()=>{paused=reduced.matches;motion();});motion();
  const captions={'deep-overview':'The overview: people, organisations and events, connected to the evidence.','deep-money':'Follow the money: funding rounds, investors, amounts and the sources behind them.','deep-claims':'Check the claims against the records, with a verdict and a source for each.','deep-ask':'In the app, ask a question about the research and follow the numbered sources.','deep-merge':'In the app, combine investigations to find the people and organisations they share.'};
  let requested='deep-overview';
  // The tab is marked at once and the picture dims while the next one loads, so a press always answers.
  const preview=$('.research-preview');
  $$('[data-research]').forEach(b=>b.onclick=()=>{requested=b.dataset.research;const key=requested,image=new Image();$$('[data-research]').forEach(o=>o.setAttribute('aria-selected',String(o===b)));$('#researchCaption').textContent=captions[key];preview.classList.add('loading');preview.setAttribute('aria-busy','true');image.onload=image.onerror=()=>{if(requested!==key)return;if(image.naturalWidth)$('.research-image').src=image.src;preview.classList.remove('loading');preview.removeAttribute('aria-busy');};image.src=`shots/${key}.webp`;});
  $('.research-tabs').addEventListener('keydown',e=>{const buttons=$$('[data-research]'),i=buttons.indexOf(document.activeElement);if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=buttons[(i+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length];next.focus();next.click();}});
  // Each job's detail, in the list's own words; only a job waiting for you asks for permission, and
  // the working ghost's bubble names the job picked.
  const jobs=[['Research our competitors','Working · Claude Code','Reading the market, comparing products and collecting the sources.',false],['Prepare the investor data room','Waiting for your answer · Codex','Organising the documents and checking what still needs your review.',true],['Summarise customer interviews','Ready · Claude Code','The themes, customer quotes and next steps are ready to review.',false]];
  $$('[data-job]').forEach(b=>b.onclick=()=>{const [title,meta,progress,asks]=jobs[+b.dataset.job];$('#jobTitle').textContent=title;$('#jobMeta').textContent=meta;$('#jobProgress').textContent=progress;$('#jobPermission').hidden=!asks;$('#jobBubble').textContent=title;$$('[data-job]').forEach(o=>o.setAttribute('aria-pressed',String(o===b)));});
  const activities=[['reading','Reading the sources'],['sketching','Writing the report'],['building','Building the project'],['terminal','Running checks'],['orbit','Researching'],['coffee','Waiting for your answer'],['pacing','Planning the next step']];let activity=0,touched=false,jobsVisible=false;
  function setActivity(id,text){$('.worker').dataset.animation=id;$('#jobActivity').textContent=text;$$('button[data-animation]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.animation===id)));}
  $$('button[data-animation]').forEach(b=>b.onclick=()=>{touched=true;setActivity(...activities.find(a=>a[0]===b.dataset.animation));});
  new IntersectionObserver(([e])=>{jobsVisible=e.isIntersecting;$('.worker').dataset.phase=jobsVisible&&!paused?'running':'paused';}).observe($('.job-companion'));
  setInterval(()=>{if(!paused&&!touched&&jobsVisible&&!document.hidden){activity=(activity+1)%activities.length;setActivity(...activities[activity]);}},3600);
  // A curious ghost travels, pauses to look, then changes direction. One composited SVG.
  const host=$('.close-companion'),ghost=$('#ghostTpl').content.firstElementChild.cloneNode(true);host.append(ghost);let searching=false,phase=0,searchTimer;
  const places=[[12,30,-9,-15,5],[100,9,12,15,-8],[155,65,7,18,5],[62,95,-12,-18,10],[18,35,-3,-8,-5]];
  function search(){clearTimeout(searchTimer);if(!searching||paused||document.hidden)return;const [x,y,angle,ex,ey]=places[phase++%places.length];ghost.style.transform=`translate(${x}px,${y}px) rotate(${angle}deg)`;ghost.querySelector('.g-eyes').setAttribute('transform',`translate(${ex} ${ey})`);searchTimer=setTimeout(search,phase%2?2600:1700);}
  new IntersectionObserver(([e])=>{searching=e.isIntersecting;search();}).observe(host);document.addEventListener('visibilitychange',search);document.addEventListener('site-motion',search);
  host.addEventListener('pointermove',e=>{const r=ghost.getBoundingClientRect();ghost.querySelector('.g-eyes').setAttribute('transform',`translate(${Math.max(-18,Math.min(18,(e.clientX-r.x-r.width/2)/4))} ${Math.max(-14,Math.min(14,(e.clientY-r.y-r.height/2)/4))})`);});
  // Restore the original black ghost letter layout, sharing one SVG symbol.
  const word=$('#ghostWord'),ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'svg');defs.setAttribute('aria-hidden','true');defs.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  const symbol=document.createElementNS(ns,'symbol');symbol.id='wordGhost';symbol.setAttribute('viewBox','-86 -106 172 215');symbol.append(...[...$('#ghostTpl').content.firstElementChild.children].map(n=>n.cloneNode(true)));defs.append(symbol);word.prepend(defs);
  word.querySelectorAll('i').forEach(cell=>{const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','-86 -106 172 215');const use=document.createElementNS(ns,'use');use.setAttribute('href','#wordGhost');svg.append(use);cell.append(svg);});
  let wordFrame=0;word.addEventListener('pointermove',e=>{if(paused||wordFrame)return;wordFrame=requestAnimationFrame(()=>{wordFrame=0;const r=word.getBoundingClientRect();word.style.setProperty('--word-look',`${Math.max(-8,Math.min(8,(e.clientX-r.left-r.width/2)/45))}deg`);});});word.addEventListener('pointerleave',()=>word.style.setProperty('--word-look','0deg'));
  $$('[aria-disabled=true]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
  // The nav marks the section being read: the last section whose top has passed the middle of the screen.
  // The closing section has no link of its own: past the last linked section, nothing is marked.
  const navLinks=$$('.strip nav a[href^="#"]'),targets=[...navLinks.map(a=>document.querySelector(a.getAttribute('href'))),$('#get')].filter(Boolean);
  const markNav=()=>{const line=innerHeight/2;let current=null;for(const t of targets)if(t.getBoundingClientRect().top<=line)current=t;navLinks.forEach(a=>{if(current&&a.getAttribute('href')==='#'+current.id)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});};
  // Six position reads per scroll event: cheap enough to run directly, so the mark is never a step behind.
  addEventListener('scroll',markNav,{passive:true});addEventListener('scrollend',markNav);markNav();
})();
