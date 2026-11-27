/* ---------- controls ---------- */
/* shape buttons run left to right by how the ball bends on screen, so a lefty's row is mirrored */
function mkShape(){
  const el=$('segShape');el.innerHTML='';
  const order=SHAPE.map((_,i)=>i);if(HAND==='L')order.reverse();
  order.forEach(i=>{const b=document.createElement('button');b.textContent=SHAPE[i].n;b.setAttribute('aria-pressed',String(state.shape===i));
    b.addEventListener('click',()=>{if(state.phase!=='aim')return;state.shape=i;[...el.children].forEach(c=>c.setAttribute('aria-pressed',String(c===b)));refresh();});el.appendChild(b);});
  [...$('segHand').children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===HAND)));
}
$('segHand').addEventListener('click',e=>{const v=e.target.dataset&&e.target.dataset.v;if(!v||v===HAND||state.phase!=='aim')return;HAND=v;try{localStorage.setItem('pinhigh:hand',HAND);}catch(e){}mkShape();refresh();});
/* menu: grid, theme, handedness */
(function(){
  const m=$('menu'),b=$('menuB');
  const close=()=>{m.hidden=true;b.setAttribute('aria-expanded','false');};
  b.addEventListener('click',e=>{e.stopPropagation();m.hidden=!m.hidden;b.setAttribute('aria-expanded',String(!m.hidden));});
  document.addEventListener('pointerdown',e=>{if(!m.hidden&&!m.contains(e.target)&&e.target!==b&&!b.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  let th='auto';try{th=localStorage.getItem('pinhigh:theme')||'auto';}catch(e){}
  const apply=v=>{th=v;if(v==='auto')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',v);
    [...$('segTheme').children].forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===v)));};
  apply(th);
  $('segTheme').addEventListener('click',e=>{const v=e.target.dataset&&e.target.dataset.v;if(!v)return;apply(v);try{localStorage.setItem('pinhigh:theme',v);}catch(e){}});
})();
function mkSeg(id,items,key){
  const el=$(id);el.innerHTML='';
  items.forEach((it,i)=>{const b=document.createElement('button');b.textContent=it.n;b.setAttribute('aria-pressed',String(state[key]===i));
    b.addEventListener('click',()=>{if(state.phase!=='aim')return;state[key]=i;[...el.children].forEach((c,j)=>c.setAttribute('aria-pressed',String(j===i)));refresh();});el.appendChild(b);});
}
(function(){
  const rail=$('clubs');
  CLUBS.forEach((c,i)=>{const b=document.createElement('button');b.className='club';b.innerHTML='<b>'+c.n+'</b><span>'+c.y+' yd</span>';
    b.addEventListener('click',()=>{if(state.phase!=='aim')return;state.club=i;refresh();});rail.appendChild(b);});
  mkSeg('segSpin',SPIN,'spin');mkShape();
})();
function setTog(id,key,fn){$(id).addEventListener('click',()=>{state[key]=!state[key];$(id).setAttribute('aria-pressed',String(state[key]));paint();if(fn)fn();});}
setTog('tgSlope','slope');
$('vApproach').addEventListener('click',()=>{cs.azT=0;cs.polT=.95;cs.zoomT=1;});
$('vTop').addEventListener('click',()=>{cs.azT=0;cs.polT=.17;cs.zoomT=.92;});

