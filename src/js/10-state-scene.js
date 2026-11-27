(function(){
'use strict';
if(typeof THREE==='undefined'){document.getElementById('fail').style.display='flex';return;}
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const now0=new Date();
const hq=(location.hash||'').slice(1),custom=/^\d{4}-\d{2}-\d{2}$/.test(hq); /* #YYYY-MM-DD opens that day's hole as a practice hole */
const dateStr=custom?hq:now0.getFullYear()+'-'+pad(now0.getMonth()+1)+'-'+pad(now0.getDate());
const dateLabel=custom?'Hole '+hq.slice(5):now0.toLocaleDateString('en-US',{month:'short',day:'numeric'});
H=makeHole(dateStr);

const state={club:2,spin:1,shape:NEU,aim:{x:H.pin.x,z:H.pin.z},phase:'aim',slope:true,acc:false,heat:null,showHeat:false,practice:custom,anim:null,outcome:null,result:null,job:null};
let saved=null;
if(!custom){try{saved=JSON.parse(localStorage.getItem('pinhigh:'+dateStr)||'null');}catch(e){}}
if(saved&&!saved.v){if(saved.sel){saved.sel.shape+=1;saved.sel.hand='R';}saved.v=2;} /* results saved before the five shapes used Draw/Neutral/Fade = 0/1/2 */
try{if(localStorage.getItem('pinhigh:hand')==='L')HAND='L';}catch(e){}

/* ---------- renderer / scene ---------- */
const cv=$('gl');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(34,1,.5,700);
scene.add(new THREE.HemisphereLight(0xeaf2f7,0x2b3a33,.6));
const sun=new THREE.DirectionalLight(0xfff1dc,.6);sun.position.set(-22,26,14);scene.add(sun);const fill=new THREE.DirectionalLight(0xb8c4e0,.85);fill.position.set(14,-20,18);scene.add(fill);
const yTop=(x,z)=>VE*H.hv(x,z);

/* island mesh */
const S=H.S,NR=120,NS=360,TAU=Math.PI*2;
function buildIsland(){
  const pos=[],uv=[],idx=[];
  pos.push(0,yTop(0,0),0);
  for(let i=1;i<=NR;i++){const f=i/NR;for(let k=0;k<NS;k++){const th=k/NS*TAU,ro=H.vOutline(th)*f,x=Math.cos(th)*ro,z=Math.sin(th)*ro;pos.push(x,yTop(x,z),z);}}
  for(let n=0;n<pos.length/3;n++)uv.push((pos[3*n]+S)/(2*S),(pos[3*n+2]+S)/(2*S));
  const rv=(i,k)=>1+(i-1)*NS+(k%NS);
  for(let k=0;k<NS;k++)idx.push(0,rv(1,k+1),rv(1,k));
  for(let i=1;i<NR;i++)for(let k=0;k<NS;k++){const a=rv(i,k),b=rv(i,k+1),c=rv(i+1,k),d=rv(i+1,k+1);idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();
  return g;
}
const topGeo=buildIsland();
const canvas2=document.createElement('canvas');canvas2.width=canvas2.height=1024;
const tex=new THREE.CanvasTexture(canvas2);tex.flipY=false;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
const topMesh=new THREE.Mesh(topGeo,new THREE.MeshLambertMaterial({map:tex}));
scene.add(topMesh);

function buildSkirt(){
  const M=26,NK=NS,pos=[],col=[],idx=[];
  const cTop=new THREE.Color(0x322a20),cMid=new THREE.Color(0x251f1b),cLow=new THREE.Color(0x151419),cA=new THREE.Color(0x3a3126),cc=new THREE.Color();
  const nz=(th,f,sd)=>Math.sin(5*th+3*f+sd)*.5+Math.sin(9*th-2.3*f+sd*2)*.3+Math.sin(17*th+5.1*f-sd)*.2;
  const ring=(j,k)=>j*NK+(k%NK);
  for(let j=0;j<=M;j++){
    const f=j/M,band=Math.floor(f*9)%2;
    cc.copy(cTop).lerp(cMid,Math.min(1,f*1.6)).lerp(cLow,Math.max(0,(f-.45)/.55));
    if(band)cc.lerp(cA,.0).multiplyScalar(.9);
    for(let k=0;k<NK;k++){
      const th=k/NK*TAU,ro=H.vOutline(th),r=nz(th,f,1.7);
      const aa=f*Math.PI/2,sc=(.4+.6*Math.cos(aa))*(1-.09*(.5+.5*r)*Math.min(1,f*4));
      const ex=Math.cos(th)*ro,ez=Math.sin(th)*ro,y0=yTop(ex,ez);
      const drop=TH+4.6*Math.sin(aa)*(1+.1*nz(th,0,4))+.3*r*f;
      pos.push(ex*sc,y0-drop,ez*sc);
      const sh=1+.12*nz(th,f,9);col.push(cc.r*sh,cc.g*sh,cc.b*sh);
    }
  }
  for(let j=0;j<M;j++)for(let k=0;k<NK;k++){const a=ring(j,k),b=ring(j,k+1),c=ring(j+1,k),d=ring(j+1,k+1);idx.push(a,b,c,b,d,c);}
  const cb=pos.length/3;pos.push(0,yTop(0,0)-TH-4.9,0);col.push(cLow.r*.8,cLow.g*.8,cLow.b*.8);
  for(let k=0;k<NK;k++)idx.push(cb,ring(M,k),ring(M,k+1));
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}));
}
scene.add(buildSkirt());
/* vertical slab edge: turf lip over soil */
(function(){
  const pos=[],col=[],idx=[],lip=new THREE.Color().setRGB(.1,.24,.17),mid=new THREE.Color(0x2c2a1f),bot=new THREE.Color(0x322a20),cc=new THREE.Color(),R=3;
  for(let j=0;j<=R;j++){const f=j/R;
    if(j===0)cc.copy(lip);else if(j===1)cc.copy(lip);else if(j===2)cc.copy(mid);else cc.copy(bot);
    for(let k=0;k<NS;k++){const th=k/NS*TAU,ro=H.vOutline(th)-(j<2?.04:0),ex=Math.cos(th)*ro,ez=Math.sin(th)*ro,y0=yTop(ex,ez);
      const y=j===0?y0:y0-TH*(j===1?.3:j===2?.62:1);pos.push(ex,y,ez);col.push(cc.r,cc.g,cc.b);}}
  for(let j=0;j<R;j++)for(let k=0;k<NS;k++){const a=j*NS+k,b=j*NS+(k+1)%NS,c=(j+1)*NS+k,d=(j+1)*NS+(k+1)%NS;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
  scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
})();

/* hazards beside the green: sand bunkers and ponds, each a small sunken patch attached to the island edge */
const HZ=(function(){
  const NA=72,lip=[.21,.42,.29],turf=[.15,.33,.23];
  const kinds={sand:{f:[.86,.76,.52],e:[.72,.62,.42]},water:{f:[.16,.48,.62],e:[.12,.38,.52]}};
  const rock=[[.40,.33,.25],[.30,.26,.23],[.2,.19,.23]];
    /* the hazards themselves are painted into the island texture and sunk into its surface */
  /* an island green stands in water */
  let ring=null;
  if(H.waterAround){
    const wy=-1.7,R=H.Rmax*2.3;
    const cv=document.createElement('canvas');cv.width=cv.height=256;const cx=cv.getContext('2d'),gr=cx.createRadialGradient(128,128,40,128,128,128);
    gr.addColorStop(0,'rgba(44,102,112,.95)');gr.addColorStop(.55,'rgba(44,102,112,.8)');gr.addColorStop(1,'rgba(44,102,112,0)');cx.fillStyle=gr;cx.fillRect(0,0,256,256);
    const w=new THREE.Mesh(new THREE.PlaneGeometry(2*R,2*R),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthWrite:false}));w.rotation.x=-Math.PI/2;w.position.y=wy;w.renderOrder=-1;scene.add(w);
    ring=[0,1,2].map(i=>{const m=new THREE.Mesh(new THREE.RingGeometry(.97,1,96),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=wy+.02;scene.add(m);return m;});
  }
  return {update(now){if(!ring)return;const t=now/1000;ring.forEach((m,i)=>{const u=((t*.12+i/3)%1),r=H.Rmax*(1.15+1.0*u);m.scale.setScalar(r);m.material.opacity=.32*Math.sin(Math.PI*u);});}};
})();

/* 3D grass: thousands of short instanced blades on the rim of rough. They sway a little downwind. */
const GRASS=(function(){
  const rn=(function(){let sd=5;return()=>{sd=(sd+0x6D2B79F5)|0;let t=Math.imul(sd^(sd>>>15),1|sd);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};})();
  /* one blade: 3 quads and a tip, 1 unit tall, bent forward, dark at the root and lighter at the tip */
  const lv=[[0,.34],[.34,.31],[.68,.27],[1,.23]],pos=[],col=[],idx=[],dk=[1,1,1],lt=[1,1,1];
  lv.forEach(([y,w],k)=>{const z=.35*y*y,c=dk.map((d,q)=>d+(lt[q]-d)*y);
    if(w>0){pos.push(-w,y,z,w,y,z);col.push(...c,...c);}else{pos.push(0,y,z);col.push(...c);}});
  idx.push(0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6);
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));bg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));bg.setIndex(idx);bg.computeVertexNormals();
  let per=0;for(let k=0;k<720;k++)per+=H.outline(k/720*TAU)*TAU/720;
  const nMain=Math.min(42000,Math.round(per*CW*36)),nCol=H.hazards.reduce((a,h)=>a+Math.round(TAU*Math.sqrt((h.aT*h.aT+h.aN*h.aN)/2)*CW*60),0),n=nMain+nCol,mat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,flatShading:true});
  const U={uT:{value:0},uWind:{value:new THREE.Vector2(H.wind.x,H.wind.z)},uK:{value:.025+.005*H.wind.mph}};
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uT=U.uT;sh.uniforms.uWind=U.uWind;sh.uniforms.uK=U.uK;
    sh.vertexShader=sh.vertexShader.replace('void main() {','uniform float uT;uniform vec2 uWind;uniform float uK;\nvoid main() {')
     .replace('#include <project_vertex>',`vec4 mvPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
      mvPosition=instanceMatrix*mvPosition;
      #endif
      float sw=position.y*position.y*uK*(.7+.5*sin(uT*2.3+mvPosition.x*.9+mvPosition.z*.7));
      mvPosition.xz+=uWind*sw;
      mvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;`);
  };
  const mesh=new THREE.InstancedMesh(bg,mat,n),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),ps=new THREE.Vector3(),ey=new THREE.Vector3(0,1,0),c=new THREE.Color();
  const PAL=[[.19,.385,.265],[.21,.42,.29],[.23,.455,.315]];
  let put=0;
  for(let t=0;t<nMain*3&&put<nMain;t++){
    const th=rn()*TAU,ro=H.outline(th),fe=.04+rn()*(CW-.04),r=ro-fe,x=Math.cos(th)*r,z=Math.sin(th)*r;
    if(H.hazards.some(h=>H.hq(h,x,z)<(h.ap+.15)*(h.ap+.15)))continue; /* no rim grass between the green and a hazard */
    const hgt=.16+rn()*.14; /* short: about 0.16 to 0.3 */
    q.setFromAxisAngle(ey,rn()*TAU);sc.set(hgt*.9,hgt*(.85+.3*fe/CW),hgt*.9);ps.set(x,yTop(x,z)-.01,z);
    m4.compose(ps,q,sc);mesh.setMatrixAt(put,m4);
    c.setRGB(...PAL[(rn()*3)|0]);mesh.setColorAt(put,c);put++; /* cartoon: one flat colour per blade, three tones */
  }
  /* grass wraps around each hazard instead: a collar following the edge of the sand or pond */
  for(const h of H.hazards){
    const cnt=Math.round(TAU*Math.sqrt((h.aT*h.aT+h.aN*h.aN)/2)*CW*60),rm=Math.sqrt(h.aT*h.aN);
    for(let t=0;t<cnt;t++){
      const f=rn()*TAU,w=1.07+rn()*CW/rm,wb=1+.07*Math.sin(3*f+h.ph)+.04*Math.sin(5*f+2*h.ph),u=Math.cos(f)*h.aT*wb*w,v=Math.sin(f)*h.aN*wb*w,x=h.cx+h.Tx*u+h.nx*v,z=h.cz+h.Tz*u+h.nz*v;
      if(H.inIsland(x,z)||Math.hypot(x,z)>H.vOutline(Math.atan2(z,x))-.12||H.hazards.some(o=>o!==h&&H.hq(o,x,z)<1.2))continue;
      const fe=(w-1.07)*rm,hgt=.16+rn()*.14;
      q.setFromAxisAngle(ey,rn()*TAU);sc.set(hgt*.9,hgt*(.85+.3*fe/CW),hgt*.9);ps.set(x,yTop(x,z)-.01,z);
      m4.compose(ps,q,sc);mesh.setMatrixAt(put,m4);c.setRGB(...PAL[(rn()*3)|0]);mesh.setColorAt(put,c);put++;
    }
  }
  mesh.count=put;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;
  scene.add(mesh);
  return {update(now){U.uT.value=now/1000;}};
})();

/* soft ground shadow under the island */
(function(){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,6,64,64,62);g.addColorStop(0,'rgba(0,0,0,.34)');g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(H.Rmax*3.1,H.Rmax*3.1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.y=-7.4;scene.add(m);
})();

/* pin and cup */
/* wind ribbons in three sizes (5 medium, 7 small): thin, tapered, soft-edged bands with a bright head and a long fading tail.
   Each sweeps downwind on one gentle curve, always turned to face the camera, over the island only, fading in and out.
   They show direction and strength only; the wind itself stays constant. */
const WFX=(function(){
  const M=28,W=H.wind,rx=-W.z,rz=W.x,sp0=.8+.32*W.mph,L0=2.2+.35*W.mph,out=[];
  const SIZES=[{c:11,ln:.91,wd:.385,h:[.9,2.8],life:[3.2,5],sp:1,op:.85,am:.7}];
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const onG=(x,z)=>H.inIsland(x,z)&&!H.inBunker(x,z);
  const vs='attribute float a;attribute float v;varying float vA;varying float vV;void main(){vA=a;vV=v;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const fs='uniform float uOp;varying float vA;varying float vV;void main(){float s=pow(max(0.,1.-abs(vV)),1.6);gl_FragColor=vec4(vec3(1.),vA*s*uOp);}';
  const idx=[];for(let i=0;i<M-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  const cx=new Float32Array(M),cy=new Float32Array(M),cz=new Float32Array(M);
  let slot=0;const total=SIZES.reduce((a,S)=>a+S.c,0);
  for(const S of SIZES)for(let n=0;n<S.c;n++){const si=slot++;
    const g=new THREE.BufferGeometry(),al=new Float32Array(M*2),vv=new Float32Array(M*2);
    for(let k=0;k<M;k++){const u=k/(M-1),a=Math.pow(Math.sin(Math.PI*Math.pow(1-u,.65)),1.2);al[k*2]=al[k*2+1]=a;vv[k*2]=-1;vv[k*2+1]=1;} /* u=1 is the leading tip, u=0 the far end of the tail: sharp head, long fade */
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(M*2*3),3));g.setAttribute('a',new THREE.BufferAttribute(al,1));g.setAttribute('v',new THREE.BufferAttribute(vv,1));g.setIndex(idx);
    const m=new THREE.ShaderMaterial({uniforms:{uOp:{value:0}},vertexShader:vs,fragmentShader:fs,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    const l=new THREE.Mesh(g,m);l.frustumCulled=false;l.renderOrder=2;scene.add(l);
    const o={S,g,m,x:0,z:0,tr:0,h:1,age:0,life:1,k:1,ln:1,amp:1,ph:0,wd:.3,cu:1};out.push(o);
    o.spawn=function(first){
      /* each ribbon always starts from its own home spot, on the upwind side and spread across the wind, with +-20% of the island radius of scatter */
      const R=H.Rmax,lat=(total>1?si/(total-1):.5)*1.6-.8,hx=-W.x*.5*R+rx*lat*R,hz=-W.z*.5*R+rz*lat*R;
      let ok=false;
      for(let t=0;t<25&&!ok;t++){o.x=hx+rnd(-.2,.2)*R;o.z=hz+rnd(-.2,.2)*R;ok=H.edgeR(o.x,o.z)>1&&onG(o.x,o.z);}
      for(let t=0;t<12&&!ok;t++){o.x*=.85;o.z*=.85;ok=H.edgeR(o.x,o.z)>1&&onG(o.x,o.z);} /* a home spot that falls off the island slides inward */
      o.h=rnd(S.h[0],S.h[1]);o.life=rnd(S.life[0],S.life[1]);o.age=first?rnd(0,o.life):0;o.k=S.sp*rnd(.9,1.15);o.ln=L0*S.ln*rnd(.85,1.15);
      o.amp=.5*S.am*rnd(.7,1.1)*(Math.random()<.5?-1:1);o.ph=rnd(0,6.28);o.wd=S.wd*rnd(.8,1.2);o.cu=rnd(.6,1.0);o.tr=0;
    };
    o.spawn(true);
  }
  return {update(dt,t){
    const C=cam.position;
    for(const o of out){
      o.age+=dt;if(o.age>=o.life)o.spawn(false);
      o.tr+=sp0*o.k*dt; /* how far the head has travelled along this ribbon's fixed path */
      const p=o.g.attributes.position.array;let edge=1;
      for(let k=0;k<M;k++){
        /* the S-curve is a fixed path in space and the ribbon slides along it, so every part of the body follows the head */
        const u=k/(M-1),s=o.tr-o.ln*(1-u),f=Math.PI*o.cu/o.ln*1.6,sw=Math.sin(s*f+o.ph)*o.amp;
        const x=o.x+W.x*s-W.z*sw,z=o.z+W.z*s+W.x*sw;
        cx[k]=x;cz[k]=z;cy[k]=yTop(x,z)+o.h+.35*o.amp*Math.sin(s*f+o.ph+1.1);
        if(k%5===0||k===M-1)edge=Math.min(edge,onG(x,z)?clamp(H.edgeR(x,z)/2.5,0,1):0);
      }
      for(let k=0;k<M;k++){ /* width runs across the view so the ribbon never turns edge-on */
        const a=Math.max(0,k-1),b=Math.min(M-1,k+1);
        let tx=cx[b]-cx[a],ty=cy[b]-cy[a],tz=cz[b]-cz[a];
        const ex=C.x-cx[k],ey=C.y-cy[k],ez=C.z-cz[k];
        let nx=ty*ez-tz*ey,ny=tz*ex-tx*ez,nz=tx*ey-ty*ex;const nl=Math.hypot(nx,ny,nz)||1;
        const u=k/(M-1),hw=o.wd*.5*Math.pow(Math.sin(Math.PI*Math.pow(u,.8)),.7)/nl;
        p[k*6]=cx[k]-nx*hw;p[k*6+1]=cy[k]-ny*hw;p[k*6+2]=cz[k]-nz*hw;p[k*6+3]=cx[k]+nx*hw;p[k*6+4]=cy[k]+ny*hw;p[k*6+5]=cz[k]+nz*hw;
      }
      o.g.attributes.position.needsUpdate=true;
      o.m.uniforms.uOp.value=.376*o.S.op*Math.sin(Math.PI*o.age/o.life)*edge; /* in, then out; gone at the rim */
    }
  }};
})();
let wfxT=0;
const pinG=new THREE.Group();let flagUpd=null;
(function(){
  const y=yTop(H.pin.x,H.pin.z);
  /* the cup: dark hole, a bright rim, and a soft bevel that dips toward it. All of it tilts with the green under the hole. */
  const R=CUPR,cupG=new THREE.Group(),gg=H.grad(H.pin.x,H.pin.z),nrm=new THREE.Vector3(-VE*gg[0],1,-VE*gg[1]).normalize();
  cupG.position.set(H.pin.x,y,H.pin.z);cupG.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),nrm);
  const po={polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2};
  const bev=new THREE.Mesh(new THREE.RingGeometry(R*.96,R*1.2,40),new THREE.MeshBasicMaterial(Object.assign({color:0x1c5236},po)));
  bev.rotation.x=-Math.PI/2;bev.position.y=.026;cupG.add(bev);
  const cup=new THREE.Mesh(new THREE.CircleGeometry(R,32),new THREE.MeshBasicMaterial(Object.assign({color:0x070a0b},po)));
  cup.rotation.x=-Math.PI/2;cup.position.y=.04;cupG.add(cup);
  pinG.add(cupG);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,2.8,8),new THREE.MeshLambertMaterial({color:0xf2f4f5}));
  pole.position.set(H.pin.x,y+1.4,H.pin.z);pinG.add(pole);
  /* a pennant of 16 slices along its length that ripples in the wind and streams downwind; the wind speed sets the flutter */
  const N=16,pos=new Float32Array((N+1)*2*3),col=new Float32Array((N+1)*2*3),idx=[];
  for(let i=0;i<=N;i++){const u=i/N,x=1.05*u;pos.set([x,.3*u,0,x,.6-.3*u,0],i*6);}
  for(let i=0;i<N;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.BufferAttribute(pos,3));fg.setAttribute('color',new THREE.BufferAttribute(col,3));fg.setIndex(idx);
  const flag=new THREE.Mesh(fg,new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide}));
  flag.position.set(H.pin.x,y+2.2,H.pin.z);flag.rotation.y=-Math.atan2(H.wind.z,H.wind.x);flag.frustumCulled=false;pinG.add(flag);
  const amp=.05+.014*H.wind.mph,spd=2.5+.55*H.wind.mph,base=[.91,.333,.231];
  flagUpd=function(now){
    const t=now/1000;
    for(let i=0;i<=N;i++){const u=i/N,x=1.05*u;
      for(let k=0;k<2;k++){
        const yy=k?.6-.3*u:.3*u,ph=u*6.5-t*spd+yy*1.8;
        pos[i*6+k*3+2]=amp*u*Math.sin(ph);
        pos[i*6+k*3+1]=yy-.04*u*u*(1+.2*Math.sin(t*spd*.7)); /* the free end droops a little between gusts */
        const sh=.78+.3*Math.cos(ph)*Math.min(1,.5+u); /* light and dark ripples */
        col.set([base[0]*sh,base[1]*sh,base[2]*sh],i*6+k*3);
      }}
    fg.attributes.position.needsUpdate=true;fg.attributes.color.needsUpdate=true;
  };
  flagUpd(0);
  scene.add(pinG);
})();

/* aim marker + landing ring */
const mAcc=()=>new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#5fd0e8');
const aimG=new THREE.Group();scene.add(aimG);
const aimMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95,depthTest:false});
const aimRing=new THREE.Mesh(new THREE.RingGeometry(.34,.5,40),aimMat);aimRing.rotation.x=-Math.PI/2;aimRing.renderOrder=6;aimG.add(aimRing);
const aimDot=new THREE.Mesh(new THREE.CircleGeometry(.1,16),aimMat);aimDot.rotation.x=-Math.PI/2;aimDot.renderOrder=6;aimG.add(aimDot);
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,2.4,6),aimMat);beam.position.y=1.2;beam.renderOrder=6;aimG.add(beam);
const ELL=72;
const ellGeo=new THREE.BufferGeometry();ellGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(ELL*3),3));
const ellMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthTest:false});
const ell=new THREE.LineLoop(ellGeo,ellMat);ell.renderOrder=5;ell.frustumCulled=false;ell.visible=false;scene.add(ell);

/* ball + trail */
const ball=new THREE.Mesh(new THREE.SphereGeometry(.22,20,14),new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x333333}));ball.visible=false;scene.add(ball);
const bshadow=new THREE.Mesh(new THREE.CircleGeometry(.3,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.35,depthWrite:false}));
bshadow.rotation.x=-Math.PI/2;bshadow.visible=false;scene.add(bshadow);
const TR=1600,trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(TR*3),3));trGeo.setDrawRange(0,0);
const trail=new THREE.Line(trGeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthTest:false}));trail.renderOrder=4;trail.frustumCulled=false;scene.add(trail);

/* ---------- surface texture ---------- */
const N=1024,PXM=N/(2*S);
const fHzK=new Uint8Array(N*N),fHzS=new Float32Array(N*N),fAp=new Uint8Array(N*N),fHgt=new Float32Array(N*N),fGx=new Float32Array(N*N),fGz=new Float32Array(N*N),fEdge=new Float32Array(N*N),fIn=new Uint8Array(N*N),fSand=new Float32Array(N*N);
(function(){
  for(let j=0;j<N;j++){const z=((j+.5)/N-.5)*2*S;for(let i=0;i<N;i++){
    const x=((i+.5)/N-.5)*2*S,p=j*N+i,r=Math.hypot(x,z),th0=Math.atan2(z,x),ro=H.outline(th0);
    if(r>ro){if(r<=H.vOutline(th0)){fIn[p]=1;fAp[p]=1;for(const h of H.hazards){const q=H.hq(h,x,z);if(q<1.2){fHzK[p]=h.kind==='sand'?3:4;fHzS[p]=Math.sqrt(q);break;}}}else fIn[p]=0;continue;}
    fIn[p]=1;fEdge[p]=ro-r;fHgt[p]=H.h(x,z);const g=H.grad(x,z);fGx[p]=g[0];fGz[p]=g[1];fSand[p]=2;
  }}
})();
const C={green:[44,108,76],fringe:[88,146,100],rough:[30,84,58],sand:[216,198,152],sandEdge:[186,164,118]};
const ramp=[[0,[44,108,76],0],[.35,[176,206,128],.42],[.7,[232,182,92],.6],[1,[218,110,76],.7]];
function slopeTint(t){
  for(let i=1;i<ramp.length;i++){if(t<=ramp[i][0]){const a=ramp[i-1],b=ramp[i],u=(t-a[0])/(b[0]-a[0]);return [lerp(a[1][0],b[1][0],u),lerp(a[1][1],b[1][1],u),lerp(a[1][2],b[1][2],u),lerp(a[2],b[2],u)];}}
  return [218,110,76,.7];
}
const heatStops=[[0,[238,248,160]],[.35,[64,170,160]],[1,[40,30,96]]];
function heatCol(t){
  for(let i=1;i<heatStops.length;i++){if(t<=heatStops[i][0]){const a=heatStops[i-1],b=heatStops[i],u=(t-a[0])/(b[0]-a[0]);return [lerp(a[1][0],b[1][0],u),lerp(a[1][1],b[1][1],u),lerp(a[1][2],b[1][2],u)];}}
  return heatStops[2][1];
}
const GSP=1.47,GW=.0195,GS=.026;
/* cheap integer hash for the grass texture: a stable pseudo-random 0..1 per texel */
const hsh=(x,y)=>{let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
/* the rim of rough: the texture is only a dark base under the 3D blades; slightly lighter next to the green */
function grassRGB(i,j,fe){
  const n=.9+.2*hsh(i>>2,j>>2),br=(.8+.3*clamp(fe/CW,0,1))*n;
  return [24*br,58*br,44*br];
}
function paint(){
  const ctx=canvas2.getContext('2d'),img=ctx.createImageData(N,N),d=img.data,heat=state.showHeat&&state.heat?state.heat:null;
    for(let j=0;j<N;j++){const z=((j+.5)/N-.5)*2*S;for(let i=0;i<N;i++){
    const p=j*N+i,o=p*4;
    if(!fIn[p]){d[o+3]=0;continue;}
    if(fAp[p]){
      let r=0,g=0,b=0;const k=fHzK[p];
      if(k===3){const s0=fHzS[p],e=clamp((s0-.8)/.2,0,1),m=clamp((1.0-s0)/.025+.5,0,1);
        r=lerp(226,196,e);g=lerp(207,174,e);b=lerp(152,122,e);const gr=grassRGB(i,j,CW*.5);r=lerp(gr[0],r,m);g=lerp(gr[1],g,m);b=lerp(gr[2],b,m);}
      else if(k===4){const s0=fHzS[p],e=clamp((s0-.7)/.3,0,1),m=clamp((1.0-s0)/.025+.5,0,1);
        r=lerp(30,52,e);g=lerp(112,150,e);b=lerp(150,178,e);const gr=grassRGB(i,j,CW*.5);r=lerp(gr[0],r,m);g=lerp(gr[1],g,m);b=lerp(gr[2],b,m);}
      else{const gr=grassRGB(i,j,CW*.5);r=gr[0];g=gr[1];b=gr[2];}
      d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=255;continue;}
    const x=((i+.5)/N-.5)*2*S;
    let r=C.green[0],g=C.green[1],b=C.green[2];
    const st=(Math.floor((z+S)/1.7)&1)?1.035:.97;r*=st;g*=st;b*=st;
    const gm=Math.hypot(fGx[p],fGz[p]);
    const sand=fSand[p]<1;
    if(sand){const e=clamp((1-fSand[p])*4,0,1);r=lerp(C.sandEdge[0],C.sand[0],e);g=lerp(C.sandEdge[1],C.sand[1],e);b=lerp(C.sandEdge[2],C.sand[2],e);}
    else{
      const fe=fEdge[p];
      const cm=(()=>{const u=clamp((CW-fe)/.06+.5,0,1);return u*u*(3-2*u);})();
      if(cm>0){const gr=grassRGB(i,j,fe);r=lerp(r,gr[0],cm);g=lerp(g,gr[1],cm);b=lerp(b,gr[2],cm);}
      if(state.slope&&cm<1){
        const t=slopeTint(clamp(gm*100/6,0,1)),ik=1-cm;
        /* the green itself stays plain; only the grid lines and streaks carry the slope colour */
        if(fe>CW+.05){
          const ax=Math.abs(((x/GSP)%1+1)%1-.5),az=Math.abs(((z/GSP)%1+1)%1-.5),dd=Math.min(.5-ax,.5-az)*GSP;
          const la=clamp(1-(dd-GW)/GS,0,1);
          if(la>0){const k=.95*la*Math.min(1,(fe-CW-.05)/.5);r=lerp(r,lerp(t[0],255,.12),k);g=lerp(g,lerp(t[1],255,.12),k);b=lerp(b,lerp(t[2],255,.12),k);}
        }
      }
    }
    if(heat){
      const fx=(x+heat.S)/heat.step,fz=(z+heat.S)/heat.step,ix=Math.floor(fx),iz=Math.floor(fz),ux=fx-ix,uz=fz-iz;
      let sw=0,sv=0;
      for(let q=0;q<4;q++){const qi=ix+(q&1),qj=iz+(q>>1);if(qi<0||qj<0||qi>=heat.nx||qj>=heat.nx)continue;const v=heat.vals[qj*heat.nx+qi];if(v!==v)continue;const w=((q&1)?ux:1-ux)*((q>>1)?uz:1-uz);sw+=w;sv+=w*v;}
      if(sw>.02){const t=clamp((sv/sw-heat.min)/.9,0,1),hc=heatCol(t);r=lerp(r,hc[0],.82);g=lerp(g,hc[1],.82);b=lerp(b,hc[2],.82);}
    }
    d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=255;
  }}
  ctx.putImageData(img,0,0);
  tex.needsUpdate=true;
}

