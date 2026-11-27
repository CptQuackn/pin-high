/* ---------- animation loop ---------- */
function stepJob(){
  if(!state.job)return;
  const t0=performance.now(),total=Math.PI*H.R*H.R/3.24,budget=state.phase==='done'?24:7;
  while(performance.now()-t0<budget){
    const r=state.job.next();
    if(r.done){state.job=null;finishAnalysisWhenReady(r.value);return;}
    $('wBarI').style.width=Math.min(96,r.value/total*100)+'%';
  }
}
let pendingRes=null;
function finishAnalysisWhenReady(v){pendingRes=v;tryFinish();}
function tryFinish(){if(pendingRes&&state.phase==='done'){const v=pendingRes;pendingRes=null;finishAnalysis(v);}}
function animBall(now){
  const a=state.anim;if(!a||state.phase==='aim')return;
  const tt=(now-a.t0)/1000,gy=(x,z)=>yTop(x,z)+.22,water=state.outcome.s==='water',holed=state.outcome.s==='holed',cnt=a.rec.length/2-1;
  let x,y,z;
  if(tt<a.Tf){
    const t=tt/a.Tf,f=flightAt(a,t);x=f.x;z=f.z;y=f.y;
    cometAt(a,t);
  }else{
    if(!flLine.visible){flLine.visible=true;landMark.visible=true;}
    if(!a.landed){a.landed=true;cometOff();impactFx(a);}
    const t2=tt-a.Tf,i=Math.min(cnt,Math.floor(t2*PB/.016)),rolling=i<cnt,endT=cnt*.016/PB;
    x=a.rec[i*2];z=a.rec[i*2+1];
    if(water&&!rolling){const tf=t2-endT;y=gy(x,z)-4.5*tf*tf-.3*tf;if(y<-9){ball.visible=false;bshadow.visible=false;}}
    else if(holed&&!rolling){const tf=t2-endT;y=gy(x,z)-.12-3.4*tf*tf;if(y<gy(x,z)-.9){ball.visible=false;bshadow.visible=false;}if(!a.cupped){a.cupped=true;SFX.cup();buzz([25,40,25]);sparkAt(x,gy(x,z),z,0xffd24d,46,5.5);}}
    else y=gy(x,z)+hopOffset(t2,a.h0);
    const n=Math.min(TR-1,i+1),arr=trGeo.attributes.position.array;
    for(let q=a.last;q<n;q++){const rx=a.rec[q*2],rz=a.rec[q*2+1];arr[q*3]=rx;arr[q*3+1]=yTop(rx,rz)+.1;arr[q*3+2]=rz;}
    a.last=n;trGeo.attributes.position.needsUpdate=true;trGeo.setDrawRange(0,n);
    if(!rolling&&state.phase!=='done'&&t2>endT+(water?1.6:holed?.8:.4)){state.phase='done';showOutcome();tryFinish();}
  }
  ball.position.set(x,y,z);
  const gnd=yTop(x,z)+.04,hgt=Math.max(0,y-gnd);
  bshadow.position.set(x,gnd,z);bshadow.scale.setScalar(Math.max(.4,1-hgt*.04));bshadow.material.opacity=water&&hgt>2&&!H.inIsland(x,z)?0:Math.max(.08,.35-hgt*.012);
}

/* ---------- slope flow blobs (travel downhill along grid lines) ---------- */
const FLOW=(function(){
  const NP=230,LEN=.95,WID=.26;
  const pos=new Float32Array(NP*12),uvs=new Float32Array(NP*8),al=new Float32Array(NP*4),col=new Float32Array(NP*12),ix=[];
  for(let i=0;i<NP;i++){const o=i*4;uvs.set([-1,-1,1,-1,1,1,-1,1],i*8);ix.push(o,o+1,o+2,o,o+2,o+3);}
  const P=[];let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  g.setAttribute('alpha',new THREE.BufferAttribute(al,1));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(ix);
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    vertexShader:'attribute float alpha;attribute vec3 color;varying float va;varying vec3 vc;varying vec2 vu;void main(){va=alpha;vc=color;vu=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying float va;varying vec3 vc;varying vec2 vu;void main(){float across=smoothstep(1.,.2,abs(vu.y));float along=smoothstep(-1.,.55,vu.x)*smoothstep(1.,.8,vu.x);float a=across*along*va;if(a<.01)discard;gl_FragColor=vec4(mix(vc,vec3(1.),smoothstep(.2,1.,vu.x)*.5),a);}'});
  const mesh=new THREE.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=3;scene.add(mesh);
  function spawn(q){
    for(let t=0;t<12;t++){
      const ax=rnd()<.5?0:1,line=Math.round((rnd()*2-1)*H.Rmax/GSP)*GSP,along=(rnd()*2-1)*H.Rmax;
      const x=ax?line:along,z=ax?along:line;
      if(!H.inIsland(x,z)||H.edgeR(x,z)<CW||H.inBunker(x,z))continue;
      q.ax=ax;q.line=line;q.a=along;q.age=0;q.life=1.3+rnd()*1.2;q.dir=1;return;
    }
    q.ax=0;q.line=0;q.a=0;q.age=0;q.life=1.5;q.dir=1;q.dead=true;
  }
  for(let i=0;i<NP;i++){const q={};spawn(q);q.age=rnd()*q.life;P.push(q);}
  let last=0;
  const pt=(q,al_,off)=>{const x=q.ax?q.line+off:al_,z=q.ax?al_:q.line+off;return [x,yTop(x,z)+.04,z];};
  function update(now){
    const dt=Math.min(.05,(now-last)/1000||0);last=now;
    mesh.visible=state.slope&&!state.showHeat;
    if(!mesh.visible)return;
    for(let i=0;i<NP;i++){
      const q=P[i];q.age+=dt;
      if(q.age>=q.life)spawn(q);
      const x=q.ax?q.line:q.a,z=q.ax?q.a:q.line;
      const gr=H.grad(x,z),gc=q.ax?gr[1]:gr[0],gm=Math.hypot(gr[0],gr[1]);
      if(Math.abs(gc)>1e-4)q.dir=-Math.sign(gc);
      q.a+=q.dir*(.2+2.0*Math.pow(clamp(gm*100/6,0,1),1.1))*(state.acc?.25+1.5*(q.age/q.life):1)*dt;
      const nx=q.ax?q.line:q.a,nz=q.ax?q.a:q.line,u=q.age/q.life;
      const tl0=q.ax?[q.line,q.a-q.dir*LEN/2]:[q.a-q.dir*LEN/2,q.line],hd0=q.ax?[q.line,q.a+q.dir*LEN/2]:[q.a+q.dir*LEN/2,q.line],M2=CW+.35;
      const ok=H.inIsland(nx,nz)&&H.edgeR(nx,nz)>M2&&!H.inBunker(nx,nz)&&H.inIsland(tl0[0],tl0[1])&&H.edgeR(tl0[0],tl0[1])>M2&&H.inIsland(hd0[0],hd0[1])&&H.edgeR(hd0[0],hd0[1])>M2;
      const tc=slopeTint(clamp(gm*100/6,0,1)),fade=Math.sin(Math.PI*u),vis=clamp((Math.abs(gc)*100-.25)/.9,0,1);
      const tl=q.a-q.dir*LEN/2,hd=q.a+q.dir*LEN/2,w=WID/2;
      const v=[pt(q,tl,-w),pt(q,hd,-w),pt(q,hd,w),pt(q,tl,w)];
      for(let k=0;k<4;k++){const o=(i*4+k)*3;pos[o]=v[k][0];pos[o+1]=v[k][1];pos[o+2]=v[k][2];
        col[o]=lerp(tc[0],255,.45)/255;col[o+1]=lerp(tc[1],255,.45)/255;col[o+2]=lerp(tc[2],255,.45)/255;al[i*4+k]=ok?fade*vis*.95:0;}
    }
    g.attributes.position.needsUpdate=g.attributes.alpha.needsUpdate=g.attributes.color.needsUpdate=true;
  }
  return {update};
})();

const dirM=$('dirM'),dirA=$('dirA'),_v=new THREE.Vector3();
const windM=$('windM'),windA=$('windA');
function updDir(){
  const show=state.phase==='aim';dirM.hidden=!show;windM.hidden=!show;if(!show)return;
  const g=geom(state,state.aim),a=state.aim,y=yTop(a.x,a.z);
  _v.set(a.x-g.ux*4,y,a.z-g.uz*4).project(cam);const x0=_v.x,y0=_v.y;
  _v.set(a.x,y,a.z).project(cam);
  const ang=Math.atan2(_v.x-x0,_v.y-y0)*180/Math.PI;
  dirA.setAttribute('transform','rotate('+ang.toFixed(1)+')');
  const W=H.wind;
  _v.set(a.x,y,a.z).project(cam);const wx0=_v.x,wy0=_v.y;
  _v.set(a.x+W.x*4,y,a.z+W.z*4).project(cam);
  windA.setAttribute('transform','rotate('+(Math.atan2(_v.x-wx0,_v.y-wy0)*180/Math.PI).toFixed(1)+')');
}
function frame(now){
  requestAnimationFrame(frame);
  updCam();updAimRib();stepJob();animBall(now);FLOW.update(now);updDir();if(flagUpd)flagUpd(now);GRASS.update(now);HZ.update(now);{const dt=Math.min(.1,Math.max(0,(now-wfxT)/1000));wfxT=now;WFX.update(dt,now/1000);}
  {const dtf=Math.min(.1,Math.max(0,(now-fxT)/1000));fxT=now;fxUpdate(dtf,now);}
  renderer.render(scene,cam);
}
let fxT=0;

/* ---------- practice / share ---------- */
function toResetAim(){
  state.phase='aim';state.anim=null;state.result=null;state.job=null;pendingRes=null;state.showHeat=false;state.heat=null;
  ball.visible=false;bshadow.visible=false;trGeo.setDrawRange(0,0);flLine.visible=false;landMark.visible=false;hideBest();cometOff();revealTok++;
  paint();$('result').hidden=true;$('wait').hidden=true;$('bReopen').hidden=true;$('pick').hidden=false;$('shoot').disabled=false;requestAnimationFrame(resize);refresh();
}
$('bView').addEventListener('click',()=>{$('result').hidden=true;$('bReopen').hidden=false;});
$('bReopen').addEventListener('click',()=>{$('result').hidden=false;$('bReopen').hidden=true;});
$('bPractice').addEventListener('click',()=>{state.practice=true;$('modeChip').textContent='Practice, does not count';toResetAim();});
$('bNew').addEventListener('click',()=>{const d=new Date(Date.UTC(2027,0,1)+Math.floor(Math.random()*900)*864e5);location.hash=d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());});
window.addEventListener('hashchange',()=>{try{location.reload();}catch(e){}});
if(custom)$('modeChip').textContent='Practice hole, does not count';
function shareText(){
  const s=state.sel||(saved&&saved.sel),r=state.result;
  const cost=r?r.cost:saved&&saved.cost,total=totalScore(cost,r?r.avg:saved&&saved.avg),out=r?outcomeText(state.outcome).main:saved&&saved.out;
  const n=Math.round(total/100),sq=total>=780?'\ud83d\udfe9':total>=450?'\ud83d\udfe8':'\ud83d\udfe5';
  const st=streakInfo();
  return 'Pin High, '+dateLabel+'\n'+sq.repeat(n)+'\u2b1c'.repeat(10-n)+' '+total+'\n'+H.pinYd+' yd, '+H.wind.mph+' mph wind, '+CLUBS[s.club].n+', '+SPIN[s.spin].n.toLowerCase()+' spin, '+SHAPE[s.shape].n.toLowerCase()+'\n'+tierOf(total).n+' \u00b7 '+Number(cost).toFixed(2)+' strokes lost \u00b7 '+out+(st.streak>1?'\nStreak '+st.streak:'');
}
let toastT=0;
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),1800);}
$('bShare').addEventListener('click',async()=>{
  const txt=shareText();
  try{await navigator.clipboard.writeText(txt);toast('Result copied');}
  catch(e){const b=$('shareBox');b.value=txt;b.style.display='block';b.focus();b.select();toast('Select the text to copy it');}
});

/* ---------- boot ---------- */
$('holeSub').textContent='Par 3 · '+H.type+' · '+dateLabel;
$('dPin').textContent=H.pinYd;
$('sStimp').textContent=H.stimp.toFixed(1);
{const W=H.wind,kmh=Math.round(W.mph*1.609);$('windT').innerHTML='<b>'+W.mph+'</b> mph<br><b>'+kmh+'</b> km/h';}
if(saved){$('modeChip').textContent='Daily hole played';}
(function init(){
  /* default club: the one that needs a comfortable swing to the pin, so the first shot is playable */
  const need=geom({club:0,spin:1,shape:NEU},state.aim).dist*YD;let bi=0,bd=1e9;CLUBS.forEach((c,i)=>{const d=Math.abs(need/c.y-.95);if(d<bd){bd=d;bi=i;}});state.club=bi;
  window.addEventListener('resize',resize);
  if(window.ResizeObserver)new ResizeObserver(resize).observe($('dock'));
  const mq=window.matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',()=>setTimeout(accentSync,50));
  new MutationObserver(()=>setTimeout(accentSync,50)).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
$('tgSnd').setAttribute('aria-pressed',String(SFX.on));$('tgSnd').addEventListener('click',()=>{SFX.set(!SFX.on);$('tgSnd').setAttribute('aria-pressed',String(SFX.on));if(SFX.on){SFX.unlock();SFX.tick(.5);}});
  accentSync();paint();resize();refresh();
  if(saved){
    $('pick').hidden=true;$('result').hidden=false;
    {const ts=totalScore(saved.cost,saved.avg),tr=tierOf(ts),nx=nextTier(ts);$('rTotal').textContent=ts;$('rTotal').className='t'+tr.c;$('rTier').textContent=tr.n;$('rTier').className='tier t'+tr.c+' on';$('rNext').textContent=nx?(nx[0]-ts)+' points from '+nx[1]:'Nobody does better on this green';streakLine();}
    if(saved.sel)$('rUsed').textContent=usedText(saved.sel);
    $('rOut').textContent=saved.out;$('rSub').textContent='Today\u2019s result';$('rScore').textContent=Number(saved.cost).toFixed(2);
    $('rCost').textContent=cmpText(saved.cost,saved.avg);
    if(saved.hz){$('rHaz').innerHTML=hazHTML(saved.hz);$('rHaz').hidden=false;}
    
    $('rBest').textContent='New island tomorrow.';
    if(saved.sel&&saved.aim)replayShot(saved.sel,saved.aim);
    requestAnimationFrame(resize);
  }
  requestAnimationFrame(frame);
})();
})();
