/* ---------- shot ---------- */
const fmtFt=ft=>ft<30?Math.floor(ft)+' ft '+Math.round((ft-Math.floor(ft))*12)%12+' in':Math.round(ft)+' ft';
/* landing bounces: each hop is lower and shorter than the last */
function hopOffset(t,h0){
  let h=h0,dur=.5;
  while(h>.02){if(t<=dur){const u=t/dur;return 4*h*u*(1-u);}t-=dur;h*=.42;dur*=.65;}
  return 0;
}
/* everything about one shot, deterministic: where it lands, how it rolls, and how it should fly */
function flightParams(sel,g,L,S0){
  const shs=SHAPE[sel.shape].s,spinK=[.8,1,1.25][sel.spin],apexK=spinK*(1+.08*shs); /* low spin and draw fly lower, high spin and fade fly higher */
  const bulge=-Math.sign(g.curve)*Math.min(14,.75*Math.abs(g.curve)); /* a draw starts right of its finish line and bends back left, a fade the opposite; a hard shape bows ~10 yd off the line with a 7i (placeholder size, no iron data found) */
  const cl=CLUBS[sel.club],kc=clamp(g.carry*YD/cl.y,.45,1); /* a softer swing flies lower */
  return {bulge,H:cl.h/YD*Math.pow(kc,.7)*apexK,m0:Math.tan(cl.la*Math.PI/180)*apexK,m1:Math.tan(cl.ld*(1+.06*shs)*Math.PI/180)*Math.sqrt(spinK),R:Math.hypot(L.x-S0.x,L.z-S0.z)}; /* a draw comes down flatter (-6% landing angle per step), a fade steeper */
}
function planShot(sel,aim){
  const g=geom(sel,aim),L=landFrom(g,aim,0,0),rec=[];
  const out=outcomeAt(sel,L,rec);
  if(!rec.length)rec.push(L.x,L.z);
  const vis=Math.min(g.carry,72),S0={x:H.P.x,z:H.P.z}; /* the real tee: the same world point every shot, whatever the camera, wind, shape or aim */
  const Tf=1.9+g.carry/160;
  const hopK=(sel.spin===2?.5:sel.spin===0?1.25:1)*clamp(.6+.7*(CLUBS[sel.club].rel-1.92)/1.54,.6,1.3),h0=(out.s==='water'||out.s==='bunker')?0:.7*hopK;
  const fp=flightParams(sel,g,L,S0);
  return {out,anim:Object.assign({Tf,S0,L,rec,last:0,h0},fp)};
}
/* flight arc and landing marker stay on screen after the shot, so "View the green" shows the whole last shot */
const FLN=64,flGeo=new THREE.BufferGeometry();flGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(FLN*3),3));
const flLine=new THREE.Line(flGeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthTest:false}));flLine.renderOrder=3;flLine.frustumCulled=false;flLine.visible=false;scene.add(flLine);
const landMark=new THREE.Mesh(new THREE.RingGeometry(.3,.44,24),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthTest:false,side:THREE.DoubleSide}));landMark.rotation.x=-Math.PI/2;landMark.renderOrder=6;landMark.visible=false;scene.add(landMark);

/* ball flight: a ball is launched fast and slows horizontally, so it peaks a little past halfway and comes down steeper than it went up */
function flightAt(a,t){
  t=clamp(t,0,1);const u=1-Math.pow(1-t,1.12),k=a.bulge*4*u*(1-u),gy=yTop(a.L.x,a.L.z)+.22;
  return {x:lerp(a.S0.x,a.L.x,u)+a.L.rx*k,z:lerp(a.S0.z,a.L.z,u)+a.L.rz*k,y:gy+flightH(a,u)};
}
/* height along the flight: two smooth cubic pieces, rising at the club's launch angle to a peak 62% of the way along, then
   falling to the green at the club's landing angle (steeper for short clubs) */
function flightH(a,u){
  const xa=.62,H=a.H,R=a.R;
  if(u<=xa){const q=u/xa,h=xa*R;return (q*q*q-2*q*q+q)*h*a.m0+(-2*q*q*q+3*q*q)*H;}
  const q=(u-xa)/(1-xa),h=(1-xa)*R;return (2*q*q*q-3*q*q+1)*H+(q*q*q-q*q)*h*(-a.m1);
}
/* soft glow sprite, comet trail and landing particles */
const glowTex=(function(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const CT=30,ctGeo=new THREE.BufferGeometry(),ctPos=new Float32Array(CT*3),ctCol=new Float32Array(CT*3);
ctGeo.setAttribute('position',new THREE.BufferAttribute(ctPos,3));ctGeo.setAttribute('color',new THREE.BufferAttribute(ctCol,3));
const comet=new THREE.Points(ctGeo,new THREE.PointsMaterial({size:.8,map:glowTex,vertexColors:true,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
comet.renderOrder=5;comet.frustumCulled=false;comet.visible=false;scene.add(comet);
function cometAt(a,t){
  comet.visible=true;
  for(let i=0;i<CT;i++){const f=flightAt(a,Math.max(0,t-i*.011)),q=Math.pow(1-i/CT,1.7)*(t<.03?t/.03:1);
    ctPos[i*3]=f.x;ctPos[i*3+1]=f.y;ctPos[i*3+2]=f.z;ctCol[i*3]=q;ctCol[i*3+1]=q;ctCol[i*3+2]=q*.92;}
  ctGeo.attributes.position.needsUpdate=true;ctGeo.attributes.color.needsUpdate=true;
}
function cometOff(){comet.visible=false;}
const NSP=90,spGeo=new THREE.BufferGeometry(),spPos=new Float32Array(NSP*3),spCol=new Float32Array(NSP*3),spV=new Float32Array(NSP*3),spLife=new Float32Array(NSP),spBase=new Float32Array(NSP*3);
spGeo.setAttribute('position',new THREE.BufferAttribute(spPos,3));spGeo.setAttribute('color',new THREE.BufferAttribute(spCol,3));
const sparks=new THREE.Points(spGeo,new THREE.PointsMaterial({size:.55,map:glowTex,vertexColors:true,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
sparks.renderOrder=6;sparks.frustumCulled=false;scene.add(sparks);
let spN=0;
function sparkAt(x,y,z,hex,n,speed){
  const c=new THREE.Color(hex);
  for(let k=0;k<n;k++){const i=spN++%NSP,th=Math.random()*6.283,r=(.35+Math.random()*.65)*speed;
    spPos[i*3]=x;spPos[i*3+1]=y+.1;spPos[i*3+2]=z;spV[i*3]=Math.cos(th)*r;spV[i*3+1]=(.5+Math.random())*speed*.9;spV[i*3+2]=Math.sin(th)*r;
    spBase[i*3]=c.r;spBase[i*3+1]=c.g;spBase[i*3+2]=c.b;spLife[i]=.5+Math.random()*.5;}
}
const ripple=new THREE.Mesh(new THREE.RingGeometry(.9,1,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
ripple.rotation.x=-Math.PI/2;ripple.renderOrder=6;ripple.visible=false;scene.add(ripple);let rippleT=-1,rippleMax=3;
function fxUpdate(dt,now){
  for(let i=0;i<NSP;i++){
    if(spLife[i]>0){spLife[i]-=dt;spV[i*3+1]-=16*dt;spPos[i*3]+=spV[i*3]*dt;spPos[i*3+1]+=spV[i*3+1]*dt;spPos[i*3+2]+=spV[i*3+2]*dt;
      const q=Math.max(0,spLife[i]*1.6);spCol[i*3]=spBase[i*3]*q;spCol[i*3+1]=spBase[i*3+1]*q;spCol[i*3+2]=spBase[i*3+2]*q;}
    else{spCol[i*3]=spCol[i*3+1]=spCol[i*3+2]=0;}
  }
  spGeo.attributes.position.needsUpdate=true;spGeo.attributes.color.needsUpdate=true;
  if(rippleT>=0){rippleT+=dt;const u=rippleT/.7;if(u>=1){ripple.visible=false;rippleT=-1;}else{ripple.visible=true;ripple.scale.setScalar(.4+u*rippleMax);ripple.material.opacity=.7*(1-u)*(1-u);}}
}
function impactFx(a){
  const o=state.outcome,x=a.L.x,z=a.L.z,y=yTop(x,z)+.15,water=o.s==='water',sand=o.s==='bunker';
  const col=water?0xcfe8ff:sand?0xe6d29a:0xd2f5a8;
  sparkAt(x,y,z,col,water?34:sand?22:16,water?4.5:3.2);
  ripple.position.set(x,y,z);ripple.material.color.set(col);rippleMax=water?4.5:2.4;rippleT=0;
  if(water){SFX.splash();buzz([40,30,60]);}else{SFX.land(sand);buzz(14);}
}
const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
function buzz(p){try{if(navigator.vibrate&&SFX.on)navigator.vibrate(p);}catch(e){}}
