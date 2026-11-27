/* ---------- camera ---------- */
const cs={az:0,pol:.95,zoom:1,azT:0,polT:.95,zoomT:1},tgt=new THREE.Vector3(H.vcx,.5*VE,H.vcz);let fitD=60,viewOff=0;
function resize(){
  const w=window.innerWidth,h=window.innerHeight;
  renderer.setSize(w,h,false);cam.aspect=w/h;
  const t=Math.tan(cam.fov*Math.PI/360);
  {const vr=Math.max(H.Rview,H.Rmax),k=2.3;fitD=Math.max(vr*k/(2*t),vr*k/(2*t*cam.aspect));}
  const top=$('top').getBoundingClientRect().bottom,dock=$('dock').getBoundingClientRect().top;
  for(const dm of [$('dirM'),$('windM')]){if(w<700){dm.style.top='auto';dm.style.bottom=Math.round(h-dock+6)+'px';}else{dm.style.top='';dm.style.bottom='';}}
  const ro=$('readout').getBoundingClientRect();
  const freeTop=w<700?ro.bottom:top,freeBot=dock>0?dock:h;
  viewOff=h/2-(freeTop+freeBot)/2;
  cam.setViewOffset(w,h,0,viewOff,w,h);cam.updateProjectionMatrix();
}
function updCam(){
  cs.az+=(cs.azT-cs.az)*.14;cs.pol+=(cs.polT-cs.pol)*.14;cs.zoom+=(cs.zoomT-cs.zoom)*.14;
  const d=fitD*cs.zoom;
  cam.position.set(tgt.x+d*Math.sin(cs.pol)*Math.sin(cs.az),tgt.y+d*Math.cos(cs.pol),tgt.z+d*Math.sin(cs.pol)*Math.cos(cs.az));
  cam.lookAt(tgt);
}
const ptrs=new Map();let drag=null,pinchD=0;const ray=new THREE.Raycaster();
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1)drag={t:performance.now(),moved:0};else if(drag)drag.moved=99;
  pinchD=0;
});
cv.addEventListener('pointermove',e=>{
  const p=ptrs.get(e.pointerId);if(!p)return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===2){const [a,b]=[...ptrs.values()],dd=Math.hypot(a.x-b.x,a.y-b.y);if(pinchD){cs.zoomT=clamp(cs.zoomT*pinchD/dd,.5,1.5);cs.zoom=cs.zoomT;}pinchD=dd;return;}
  if(drag){drag.moved+=Math.abs(dx)+Math.abs(dy);if(drag.moved>6){cs.azT-=dx*.006;cs.polT=clamp(cs.polT-dy*.005,.15,1.38);cs.az=cs.azT;cs.pol=cs.polT;}}
});
function endPtr(e){
  const was=ptrs.has(e.pointerId);ptrs.delete(e.pointerId);
  if(was&&drag&&ptrs.size===0&&drag.moved<=6&&performance.now()-drag.t<600&&e.type==='pointerup')pickAt(e.clientX,e.clientY);
  if(ptrs.size===0)drag=null;pinchD=0;
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{e.preventDefault();cs.zoomT=clamp(cs.zoomT*(1+Math.sign(e.deltaY)*.08),.5,1.5);},{passive:false});
function pickAt(cx,cy){
  if(state.phase!=='aim')return;
  const r=cv.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1),cam);
  const hit=ray.intersectObject(topMesh,false)[0];
  if(hit){setAim(hit.point.x,hit.point.z);$('hint').classList.add('gone');}
}

/* ---------- aim / readouts ---------- */
function setAim(x,z){state.aim={x,z};refresh();}
/* incoming shot line: where the ball is coming from */
const srcG=new THREE.Group();scene.add(srcG);
const srcMat=new THREE.LineDashedMaterial({color:0xffffff,transparent:true,opacity:.7,dashSize:.5,gapSize:.35,depthTest:false});
const SRCN=48,srcGeo=new THREE.BufferGeometry();srcGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(SRCN*3),3));
const srcLine=new THREE.Line(srcGeo,srcMat);srcLine.renderOrder=5;srcLine.frustumCulled=false;srcG.add(srcLine);
const chevGeo=(function(){const sh=new THREE.Shape();sh.moveTo(.55,0);sh.lineTo(-.35,.5);sh.lineTo(-.1,0);sh.lineTo(-.35,-.5);sh.closePath();const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);return g;})();
const chevMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthTest:false,side:THREE.DoubleSide});
const chevs=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(chevGeo,chevMat.clone());m.renderOrder=6;srcG.add(m);chevs.push(m);}
const srcLbl=(function(){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  x.font='600 26px "DM Mono",ui-monospace,monospace';x.textAlign='center';x.textBaseline='middle';x.fillStyle='rgba(0,0,0,.45)';x.fillText('BALL FROM',129,34);x.fillStyle='#fff';x.fillText('BALL FROM',128,32);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false,opacity:.9}));sp.scale.set(4.2,1.05,1);sp.renderOrder=7;srcG.add(sp);return sp;})();
function updSrc(g,a){
  srcG.visible=false;
  let dR=1;while(dR<80&&H.inIsland(a.x-g.ux*dR,a.z-g.uz*dR))dR+=.5;
  const arr=srcGeo.attributes.position.array,D0=.9,D1=dR+6;let ly=yTop(a.x,a.z);
  const at=d=>{const x=a.x-g.ux*d,z=a.z-g.uz*d;if(H.inIsland(x,z))ly=yTop(x,z);return [x,ly+.1,z];};
  for(let i=0;i<SRCN;i++){const p=at(D0+(D1-D0)*i/(SRCN-1));arr[3*i]=p[0];arr[3*i+1]=p[1];arr[3*i+2]=p[2];}
  srcGeo.attributes.position.needsUpdate=true;srcLine.computeLineDistances();
  chevs.forEach((m,i)=>{const p=at(Math.max(2,dR-2.6)-i*3.6+3.6);m.position.set(p[0],p[1]+.03,p[2]);m.rotation.y=-Math.atan2(g.uz,g.ux);m.material.opacity=.9-.22*i;});
  srcLbl.visible=false;
}
/* white dashed line from the tee to the aim point, along the shot's flight arc. Each dash is a flat camera-facing ribbon
   (a fixed ~3 px wide on screen), rebuilt every frame, so it reads as a real dash at any zoom rather than a row of dots. */
const ARN=6000,arPos=new Float32Array(ARN*3),arFirst=new Uint8Array(ARN),arT=new Float32Array(ARN);let arCount=0;
const aimLGeo=new THREE.BufferGeometry();aimLGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(ARN*2*3),3));
aimLGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(ARN*2*4).fill(1),4));
aimLGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(ARN*6),1));aimLGeo.setDrawRange(0,0);
const aimLine=new THREE.Mesh(aimLGeo,new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:1,depthTest:false,depthWrite:false}));
aimLine.renderOrder=6;aimLine.frustumCulled=false;aimLine.visible=false;scene.add(aimLine);
function updAimLine(a){
  const sel=state,g=geom(sel,a),L={x:a.x,z:a.z,rx:g.rx,rz:g.rz,ux:g.ux,uz:g.uz},S0={x:H.P.x,z:H.P.z},fa=Object.assign({S0,L},flightParams(sel,g,L,S0));
  const m=Math.max(6,Math.ceil(fa.R/.25)+1);let n=0,prev=false;
  for(let i=0;i<m&&n<ARN;i++){const on=i%10<6||i===m-1;if(!on){prev=false;continue;}const f=flightAt(fa,i/(m-1));arPos[3*n]=f.x;arPos[3*n+1]=f.y;arPos[3*n+2]=f.z;arFirst[n]=prev?0:1;arT[n]=i/(m-1);prev=true;n++;}
  arCount=n;aimLine.visible=state.phase==='aim';updAimRib();
}
const _av=new THREE.Vector3(),_at=new THREE.Vector3(),_as=new THREE.Vector3();
function updAimRib(){
  if(!aimLine.visible||!arCount)return;
  const pos=aimLGeo.attributes.position.array,col=aimLGeo.attributes.color.array,idx=aimLGeo.index.array,px=3*Math.tan(cam.fov*Math.PI/360)*2/Math.max(1,cv.clientHeight);let ic=0;
  for(let j=0;j<arCount;j++){
    const x=arPos[3*j],y=arPos[3*j+1],z=arPos[3*j+2];
    const hasN=j+1<arCount&&!arFirst[j+1],hasP=!arFirst[j];
    const j0=hasP?j-1:j,j1=hasN?j+1:j;
    _at.set(arPos[3*j1]-arPos[3*j0],arPos[3*j1+1]-arPos[3*j0+1],arPos[3*j1+2]-arPos[3*j0+2]);
    _av.set(x-cam.position.x,y-cam.position.y,z-cam.position.z);const d=_av.length();
    _as.crossVectors(_at,_av).normalize().multiplyScalar(d*px*.5);
    pos[6*j]=x+_as.x;pos[6*j+1]=y+_as.y;pos[6*j+2]=z+_as.z;pos[6*j+3]=x-_as.x;pos[6*j+4]=y-_as.y;pos[6*j+5]=z-_as.z;
    {const q=Math.min(1,arT[j]*2),al=q*q*(3-2*q);col[8*j+3]=al;col[8*j+7]=al;} /* fades in from the tee, fully visible by the halfway point */
    if(hasN){const v=2*j;idx[ic++]=v;idx[ic++]=v+1;idx[ic++]=v+2;idx[ic++]=v+1;idx[ic++]=v+3;idx[ic++]=v+2;}
  }
  aimLGeo.setDrawRange(0,ic);aimLGeo.attributes.position.needsUpdate=true;aimLGeo.attributes.color.needsUpdate=true;aimLGeo.index.needsUpdate=true;
}
function refresh(){
  const a=state.aim,sel=state,g=geom(sel,a);
  const y=yTop(a.x,a.z)+.05;
  aimG.position.set(a.x,y,a.z);
  const sgm=H.grad(a.x,a.z),pc=Math.hypot(sgm[0],sgm[1])*100;
  $('sCarry').textContent=Math.round(g.dist*YD)+' yd';
  $('sSlope').textContent=pc.toFixed(1)+'%';
  $('sArrow').style.transform='rotate('+(Math.atan2(-sgm[0],sgm[1])*180/Math.PI).toFixed(0)+'deg)';
  const need=Math.round(g.dist*YD),stock=CLUBS[state.club].y;
  const note=g.sw0>1?' &middot; out of reach, lands '+Math.round(g.dist*YD-stock)+' yd short':'';
  const lg=H.grad(a.x+g.ux*g.still,a.z+g.uz*g.still),lsa=(lg[0]*g.ux+lg[1]*g.uz)*100;
  const slNote=Math.abs(lsa)>.8?' &middot; lands '+(lsa>0?'into a '+lsa.toFixed(1)+'% upslope (spin bites)':'on a '+(-lsa).toFixed(1)+'% downslope (releases)'):'';
  const ft=$('fit');ft.innerHTML=g.sw0>1?'Out of reach: the <em>'+CLUBS[state.club].n+'</em> carries '+stock+' yd and lands '+Math.round(g.dist*YD-stock)+' yd short':'';ft.hidden=!ft.innerHTML;
  document.querySelectorAll('.club').forEach((el,i)=>{const sw=need/CLUBS[i].y;el.classList.toggle('fits',sw>=.75&&sw<=1);el.setAttribute('aria-pressed',String(i===state.club));});
  {const rl=$('clubs'),on=document.querySelector('.club[aria-pressed="true"]');if(rl&&on)rl.scrollLeft=on.offsetLeft-(rl.clientWidth-on.offsetWidth)/2;}
  /* landing ring: where the ball lands on average with this club, 75% of shots inside */
  const cx=a.x+g.ux*g.still,cz=a.z+g.uz*g.still,k=1.67,arr=ellGeo.attributes.position.array;
  for(let i=0;i<ELL;i++){const t=i/ELL*TAU,al=Math.cos(t)*g.sa*k,la=Math.sin(t)*g.sl*k,x=cx+g.ux*al+g.rx*la,zz=cz+g.uz*al+g.rz*la;arr[i*3]=x;arr[i*3+1]=yTop(x,zz)+.08;arr[i*3+2]=zz;}
  ellGeo.attributes.position.needsUpdate=true;
  updSrc(g,a);updAimLine(a);
}
function accentSync(){const c=new THREE.Color(0xffffff);aimMat.color.copy(c);srcMat.color.copy(c);chevs.forEach(m=>m.material.color.copy(c));ellMat.color.copy(c);trail.material.color.copy(c);}

