/* streak: consecutive daily holes played, and the best daily score */
function streakInfo(){
  const days=new Set();let best=0;
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),m=/^pinhigh:(\d{4}-\d{2}-\d{2})$/.exec(k||'');if(!m)continue;
    let v=null;try{v=JSON.parse(localStorage.getItem(k));}catch(e){}if(!v||v.cost==null)continue;days.add(m[1]);best=Math.max(best,totalScore(v.cost,v.avg));}}catch(e){}
  let n=0;const d=new Date(dateStr+'T12:00:00');
  while(days.has(d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()))){n++;d.setDate(d.getDate()-1);}
  return {streak:n,best,played:days.size};
}
function streakLine(){
  const el=$('rStreak');if(state.practice&&!saved){el.innerHTML='';return;}
  const s=streakInfo();el.innerHTML=s.played?'Streak <b>'+s.streak+'</b> day'+(s.streak===1?'':'s')+' · Best <b>'+s.best+'</b>':'';
}
/* the reveal: score counts up with ticks, then the tier lands */
let revealTok=0;
function revealScore(total,holed){
  const tok=++revealTok,el=$('rTotal'),tr=tierOf(total),nx=nextTier(total),tEl=$('rTier'),nEl=$('rNext'),card=document.querySelector('#result .card');
  tEl.className='tier';tEl.textContent='';nEl.textContent='';el.className='';
  const land=()=>{
    if(tok!==revealTok)return;el.textContent=total;el.className='t'+tr.c;tEl.textContent=holed?'Holed out! · '+tr.n:tr.n;tEl.className='tier t'+tr.c+' on';
    nEl.textContent=nx?(nx[0]-total)+' points from '+nx[1]:'Nobody does better on this green';
    const sb=$('scoreBox');sb.classList.remove('hit');void sb.offsetWidth;if(!reduced)sb.classList.add('hit');
    SFX.reveal(tr.c,total>=985||holed);buzz(total>=900?[30,50,30,50,60]:total>=450?[25]:[60]);
    if(total>=900||holed)FXC.burst(total>=985||holed?130:80,['#ffc83d','#7be3a0','#ffffff','#ff8c72','#8cc8ff']);
  };
  if(card&&!reduced){card.classList.remove('pop');void card.offsetWidth;card.classList.add('pop');}
  if(reduced){land();return;}
  const d=Math.min(1500,450+total*.9),t0=performance.now();let lastTk=-1;
  el.textContent='0';
  (function step(now){
    if(tok!==revealTok)return;const u=clamp((now-t0)/d,0,1),e=1-Math.pow(1-u,3),v=Math.round(total*e),tk=Math.floor(v/30);
    el.textContent=v;if(tk!==lastTk){lastTk=tk;SFX.tick(e);}
    if(u<1)requestAnimationFrame(step);else land();
  })(t0);
}
function setFlight(a){
  const arr=flGeo.attributes.position.array,gy=yTop(a.L.x,a.L.z)+.22;
  for(let i=0;i<FLN;i++){const f=flightAt(a,i/(FLN-1));arr[i*3]=f.x;arr[i*3+1]=f.y;arr[i*3+2]=f.z;}
  flGeo.attributes.position.needsUpdate=true;landMark.position.set(a.L.x,yTop(a.L.x,a.L.z)+.1,a.L.z);
}
/* after the shot: the best spot to aim at (gold ring) and where that shot would finish (gold dot) */
const bestMat=new THREE.MeshBasicMaterial({color:0xffc83d,transparent:true,opacity:.95,depthTest:false,side:THREE.DoubleSide});
const bestRing=new THREE.Mesh(new THREE.RingGeometry(.34,.5,40),bestMat),bestDot=new THREE.Mesh(new THREE.CircleGeometry(.2,20),bestMat);
for(const m of [bestRing,bestDot]){m.rotation.x=-Math.PI/2;m.renderOrder=7;m.visible=false;scene.add(m);}
function hideBest(){bestRing.visible=false;bestDot.visible=false;}
function showBest(b){
  const o=planShot({club:b.sel.club,spin:b.sel.spin,shape:b.sel.shape,hand:HAND},b.aim).out;
  bestRing.position.set(b.aim.x,yTop(b.aim.x,b.aim.z)+.14,b.aim.z);bestRing.visible=true;
  bestDot.position.set(o.x,yTop(o.x,o.z)+.14,o.z);bestDot.visible=true;
  const ft=o.s==='holed'?0:Math.hypot(o.x-H.pin.x,o.z-H.pin.z)*FT;
  return {out:o,ft};
}
function shoot(){
  if(state.phase!=='aim')return;hideBest();
  const sel={club:state.club,spin:state.spin,shape:state.shape,hand:HAND},aim=state.aim;
  const P=planShot(sel,aim);
  state.outcome=P.out;state.sel=sel;state.aimShot=aim;
  state.anim=Object.assign({t0:performance.now()},P.anim);setFlight(state.anim);flLine.visible=false;landMark.visible=false;
  state.phase='flight';aimLine.visible=false;SFX.unlock();SFX.strike();buzz(12);
  $('shoot').disabled=true;trGeo.setDrawRange(0,0);ball.visible=true;bshadow.visible=true;
  state.job=analyze(sel,aim);state.result=null;state.heat=null;state.showHeat=false;
  $('pick').hidden=true;$('result').hidden=true;$('bReopen').hidden=true;$('wait').hidden=false;beginResultUI();
  requestAnimationFrame(resize);
}
/* rebuilds a finished shot without animating it (used when a saved daily result is reopened) */
function replayShot(sel,aim){
  const P=planShot(sel,aim),a=P.anim;
  a.t0=-1e9; /* long past, so the animation loop just draws the finished shot */
  a.landed=true;a.cupped=true;
  state.outcome=P.out;state.sel=sel;state.aimShot=aim;state.anim=a;state.phase='done';
  const n=Math.min(TR-1,a.rec.length/2),arr=trGeo.attributes.position.array;
  for(let q=0;q<n;q++){const rx=a.rec[q*2],rz=a.rec[q*2+1];arr[q*3]=rx;arr[q*3+1]=yTop(rx,rz)+.1;arr[q*3+2]=rz;}
  trGeo.attributes.position.needsUpdate=true;trGeo.setDrawRange(0,n);
  const x=a.rec[(n-1)*2],z=a.rec[(n-1)*2+1],gone=P.out.s==='water'||P.out.s==='holed';
  ball.position.set(x,yTop(x,z)+.22,z);ball.visible=!gone;bshadow.position.set(x,yTop(x,z)+.04,z);bshadow.visible=!gone;
  setFlight(a);flLine.visible=true;landMark.visible=true;
}
$('shoot').addEventListener('click',shoot);

function beginResultUI(){
  $('rWind').hidden=true;
  $('rUsed').textContent='';
  $('rOut').textContent='...';$('wOut').textContent='...';$('rSub').textContent='';$('rScore').textContent='-';$('rCost').textContent='';$('rTotal').textContent='-';
  $('rBest').textContent='';$('rHaz').hidden=true;$('wBarI').style.width='0';
  $('bShare').disabled=true;$('shareBox').style.display='none';
}
function describeBest(b){
  const dz=(b.aim.z-H.pin.z)*FT,dx=(b.aim.x-H.pin.x)*FT,s=b.sel;
  const along=Math.abs(dz)<2?'':Math.round(Math.abs(dz))+' ft '+(dz>0?'short':'long'),side=Math.abs(dx)<2?'':Math.round(Math.abs(dx))+' ft '+(dx>0?'right':'left');
  const where=(along&&side)?along+' and '+side+' of the pin':(along||side)?(along||side)+' of the pin':'at the pin';
  return '<b>'+CLUBS[s.club].n+', '+SPIN[s.spin].n.toLowerCase()+' spin, '+SHAPE[s.shape].n.toLowerCase()+'</b>, landing '+where+'.';
}
function cmpText(cost,avg){
  if(avg==null)return cost<.015?'Matched the best shot':'';
  const d=avg-cost;
  return d>.04?'You beat the typical player':d<-.04?'The typical player beat you':'Level with the typical player';
}
function hazHTML(hz){
  const where=h=>h.holed>.5?'Holed':h.water>.5?'Off the island':h.sand>.5?'Sand':'Green';
  const row=(l,h)=>'<span class="r">'+l+'</span><span>'+(h.holed>.5?'0 ft':h.water>.5?'-':Math.round(h.ft)+' ft')+'</span><span class="'+(h.water>.5||h.sand>.5?'w':'')+'">'+where(h)+'</span>';
  return '<span></span><span class="h">Leave</span><span class="h">Where</span>'+row('You',hz.you)+row('Typical player',hz.avg||hz.best);
}
/* Score from strokes lost against the best shot on this green. Calibrated so a casual shot near the pin lands around 450-600,
   a sharp read lands 780+, and even a miss keeps a little: 0.15 lost = 880, 0.4 = 740, 0.8 = 590, 1.3 = 430, 2 = 250, 2.6+ = about 100. */
const SCORE_PTS=[[0,1000],[.03,975],[.15,880],[.4,740],[.8,590],[1.3,430],[2,250],[2.6,100],[3.5,50]];
/* Relative score: 1000 is the best shot, about 500 is what the typical player gets, and it falls toward 60 at twice their loss.
   The reference loss is floored at 0.25 strokes so an easy hole doesn't turn small misses into zeros. Older saves without
   a typical-player figure use the fixed curve below. */
function totalScore(cost,avg){
  if(avg!=null){
    if(cost<=0)return 1000;
    const A=Math.max(avg,.25);return Math.round(clamp(1000*(1-.5*Math.pow(cost/A,.8)),60,1000));
  }
  if(cost<=0)return 1000;
  for(let i=1;i<SCORE_PTS.length;i++){const a=SCORE_PTS[i-1],b=SCORE_PTS[i];if(cost<=b[0])return Math.round(lerp(a[1],b[1],(cost-a[0])/(b[0]-a[0])));}
  return 50;
}
const TIERS=[[985,'Pro line',3],[900,'Dialed in',3],[780,'Sharp read',3],[620,'Solid',2],[450,'Decent',2],[250,'Costly',1],[0,'Wrong read',1]];
function tierOf(sc){for(const t of TIERS)if(sc>=t[0])return {min:t[0],n:t[1],c:t[2]};return {min:0,n:'Wrong read',c:1};}
function nextTier(sc){let nx=null;for(const t of TIERS){if(t[0]>sc)nx=t;}return nx;}
function showResult(){$('wait').hidden=true;$('result').hidden=false;$('bReopen').hidden=true;}
/* the typical player: the club that needs a comfortable swing, standard spin, no shape, aimed straight at the pin */
function typicalShot(){
  const pin={x:H.pin.x,z:H.pin.z},need=geom({club:0,spin:1,shape:NEU},pin).dist*YD;let bi=0,bd=1e9;
  CLUBS.forEach((c,i)=>{const d=Math.abs(need/c.y-.95);if(d<bd){bd=d;bi=i;}});
  return {sel:{club:bi,spin:1,shape:NEU,hand:HAND},aim:pin};
}
function finishAnalysis(res){
  const ty=typicalShot(),avgCost=Math.max(0,evChoice(ty.sel,ty.aim,Z0)-res.pro.ev2);res.hz.avg=hazOf(ty.sel,ty.aim,Z0);
  const cost=Math.max(0,res.mine-res.pro.ev2),total=totalScore(+cost.toFixed(2),+avgCost.toFixed(2));
  state.result={res,cost,total,avg:avgCost};state.heat=res.heat;
  $('rTotal').textContent=total;
  $('rUsed').textContent=usedText(state.sel);
  $('rScore').innerHTML=cost.toFixed(2);
  $('rCost').textContent=cmpText(cost,avgCost);
  $('rHaz').innerHTML=hazHTML(res.hz);$('rHaz').hidden=false;
  $('bShare').disabled=false;
  
  {const b=res.best,bi=showBest(b);
   $('rBest').innerHTML='<b>Best shot</b> '+usedText(b.sel)+' \u00b7 gold ring';}
  showResult();
  if(!state.practice&&!saved){
    saved={v:2,total,cost:+cost.toFixed(2),out:outcomeText(state.outcome).main,sel:state.sel,aim:{x:state.aimShot.x,z:state.aimShot.z},hz:res.hz,avg:+avgCost.toFixed(2)};
    try{localStorage.setItem('pinhigh:'+dateStr,JSON.stringify(saved));}catch(e){}
    $('modeChip').textContent='Daily hole played';
  }
  streakLine();
  revealScore(total,state.outcome.s==='holed');
}
function windText(sel,aim,out){
  /* what moved the ball, after the fact: wind, shape and roll */
  const g=geom(sel,aim),W=H.wind,d=g.dist*YD,play=d*(g.wf-1),dr=g.wdrift*YD,cv=g.curve*YD,p=[];
  if(Math.abs(play)>=1)p.push('played '+Math.round(Math.abs(play))+' yd '+(play>0?'longer':'shorter'));
  if(Math.abs(dr)>=1)p.push('pushed it '+Math.round(Math.abs(dr))+' yd '+(dr>0?'right':'left'));
  let t='<b>Wind '+W.mph+' mph / '+Math.round(W.mph*1.609)+' km/h</b> '+(p.length?p.join(', '):'barely mattered')+'.';
  if(Math.abs(cv)>=1){t+='<br><b>'+SHAPE[sel.shape].n+'</b> started '+Math.round(Math.abs(cv))+' yd '+(cv>0?'left':'right')+' of the line and bent back to the aim';
    const k=Math.round(15*SHAPE[sel.shape].s*handSign(sel)*Math.sign(g.cross));if(g.cross&&k)t+=', '+(k<0?'holding':'adding')+' '+Math.abs(k)+'% to the wind push';t+='.';}
  if(out&&out.s!=='water'){const L=landFrom(g,aim,0,0),roll=Math.hypot(out.x-L.x,out.z-L.z)*YD;if(roll>=1)t+='<br><b>Roll</b> '+Math.round(roll)+' yd after landing.';}
  return t;
}
function usedText(s){return CLUBS[s.club].n+' · '+SPIN[s.spin].n+' spin · '+SHAPE[s.shape].n;}
function outcomeText(o){
  if(o.s==='holed')return {main:'Holed out',sub:'Nothing left to play',cls:'good'};
  if(o.s==='water')return {main:H.inWater(o.x,o.z)?'In the water':'Off the island',sub:'Penalty and a drop',cls:'bad'};
  const ft=Math.hypot(o.x-H.pin.x,o.z-H.pin.z)*FT;
  if(o.s==='bunker')return {main:H.inSand(o.x,o.z)?'In the sand':'In the rough',sub:fmtFt(ft)+' from the pin',cls:'bad'};
  let sub='from the pin';
  if(o.near){const mph=Math.round(o.near.v*2.237);sub+=o.near.d<CUPR?' \u00b7 rolled over the hole at '+mph+' mph, too fast to drop (about 4 mph max)':' \u00b7 caught the edge of the hole at '+mph+' mph';}
  return {main:fmtFt(ft),sub,cls:''};
}
function showOutcome(){const t=outcomeText(state.outcome);const el=$('rOut');el.textContent=t.main;el.className='v '+t.cls;$('rSub').textContent=t.sub;$('wOut').textContent=t.main;}

