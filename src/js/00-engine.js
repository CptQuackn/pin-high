/*ENGINE_START*/
const YD=1.09361, FT=3.28084, G=9.81, K=5/7, VE=5, TH=.48, PB=2.6;
let SG=1.6, FRM=.5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(r){let u=0;while(u===0)u=r();const v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v);}

/* Club data: stock carry (yd), roll-out speed after landing (m/s), extra back-spin check (m/s). Placeholder numbers, to be calibrated. */
/* y = stock carry (yd), rel/back = roll and backspin pullback (hand-tuned, no source), la = launch angle, ld = landing angle,
   h = peak height (yd), sp = spin (rpm). la/ld/h/sp for 4i to PW are PGA Tour averages from TrackMan; GW, SW and LW have no
   published launch data, so theirs are estimates continuing the trend (est:true). */
const CLUBS=[
  {n:'4i',y:206,rel:3.66,back:0.23,la:11.0,ld:48,h:28,sp:4836},
  {n:'5i',y:195,rel:3.43,back:0.38,la:12.1,ld:49,h:31,sp:5361},{n:'6i',y:183,rel:3.22,back:0.63,la:14.1,ld:50,h:30,sp:6231},
  {n:'7i',y:172,rel:3.01,back:1.35,la:16.3,ld:50,h:32,sp:7097},{n:'8i',y:158,rel:2.84,back:2.10,la:18.1,ld:50,h:31,sp:7998},
  {n:'9i',y:142,rel:2.65,back:2.35,la:20.4,ld:51,h:30,sp:8647},{n:'PW',y:128,rel:2.46,back:2.52,la:24.2,ld:52,h:29,sp:9304},
  {n:'GW',y:110,rel:2.35,back:2.70,la:27,ld:53,h:29,sp:9800,est:true},{n:'SW',y:92,rel:2.24,back:2.84,la:30,ld:54,h:29,sp:10300,est:true},
  {n:'LW',y:74,rel:1.92,back:2.87,la:33,ld:55,h:29,sp:10800,est:true}
];
const SPIN=[{n:'Low',m:1.3,b:0,d:1.12,w:.9,wh:.75},{n:'Standard',m:1,b:0,d:1,w:1,wh:1},{n:'High',m:.45,b:1,d:1.28,w:1.15,wh:1.3}];
/* s is how hard it curves (negative = draw side). Without wind every shape finishes on the aim spot; shape only changes the flight path,
   how much a crosswind moves it, and how much it releases (draws run out, fades stop). A lefty's draw bends right, so HAND mirrors the bend. */
const SHAPE=[{n:'Hard draw',s:-2},{n:'Draw',s:-1},{n:'Neutral',s:0},{n:'Fade',s:1},{n:'Hard fade',s:2}];
const NEU=2;let HAND='R';
const handSign=sel=>((sel&&sel.hand)||HAND)==='L'?-1:1;
/* Expected putts by distance (ft). Approximate tour-style curve, to be replaced by sourced data. */
const PUTT=[[0,1],[1,1],[2,1.01],[3,1.04],[4,1.13],[5,1.23],[6,1.34],[7,1.42],[8,1.5],[9,1.56],[10,1.61],[15,1.78],[20,1.87],[30,1.98],[40,2.06],[50,2.14],[60,2.21],[90,2.35],[200,2.6]];
const WATER_EV=3.6;
let DANGER=true;
let DISP=0; /* no random spread: a good swing lands exactly where the physics says (wind, shape, spin, slope) */
const CW=1.5, COLLAR=2.5, PRO_RISK=1.3; /* collar (dark rough) width in m, extra friction there, and how much wider the pro assumes its own spread is */

let H=null;
const GR=[0,0];

const ARCH=['Classic','Redan','Eden','Biarritz','Punchbowl','Double plateau','Road','Tiers','Spine','False front','Kidney','Two-lobe','Three-lobe','Boomerang'];
const TAU2=Math.PI*2;
function makeHole(dateStr){
  const r=mulberry32(hashStr('pinhigh:'+dateStr));
  const U=(a,b)=>a+r()*(b-a),sgn=()=>r()<.5?-1:1,sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  const type=ARCH[(r()*ARCH.length)|0],mir=sgn(); /* mir flips the whole hole left to right */
  const E=[],spec=[];let tx=0,tz=0,feat=null,waterAround=false;
  const ell=(x,z,a,b,rot)=>E.push({x:x*mir,z,a,b,rot:(rot||0)*mir});
  const hzs=(kind,deg,aT,aN)=>spec.push({kind,th:(mir>0?deg:180-deg)*Math.PI/180,aT,aN});
  /* Sizes are metres. Shapes and features follow published template holes (Redan, Eden, Biarritz, punchbowl, double plateau, island, cape, road, postage stamp);
     the exact sizes and slopes are my tuning, kept near the figures I found: greens of 2,700 to 6,000 sq ft and pin areas of about 3% or less. */
  const gauss=(x,z,cx,cz,sg)=>Math.exp(-((x-cx)*(x-cx)+(z-cz)*(z-cz))/(2*sg*sg));
  switch(type){
    case 'Classic':{ell(0,0,U(10.5,12),U(9.5,11),U(-.4,.4));{const sd=sgn();ell(sd*U(6,7.5),-U(2.5,4),U(6.2,7.4),U(5.6,6.8),U(-.5,.5));} /* a pear: a big body with a smaller lobe off one shoulder */
      tx=U(-.014,.014);tz=-U(.006,.02);
      const m1=[U(-5,5),U(-5,5),U(2.6,3.4),U(.14,.24)*sgn()],m2=[U(-6,6),U(-6,6),U(2.4,3.2),U(.12,.2)*sgn()];
      feat=(x,z)=>m1[3]*gauss(x,z,m1[0],m1[1],m1[2])+m2[3]*gauss(x,z,m2[0],m2[1],m2[2]);break;}
    case 'Redan':{ell(0,0,U(9,10.5),U(12.5,14.5),-.35);ell(U(4,5.5),U(8.5,10.5),U(5.2,6.2),U(4.4,5.4),.5); /* a long diagonal body with a tongue at the front */
      tz=U(.018,.026);tx=mir*U(.012,.018);
      const zs=U(-3,0),d=U(.14,.22);feat=(x,z)=>-d*sm(zs-3,zs+4,z)*(.5+.5*Math.sin(x*.25)); /* the front drops away toward the player */
      break;}
    case 'Eden':{{const a0=U(0,6.283),d=U(3.4,4.2),rr=U(9,10);for(let k=0;k<3;k++){const a=a0+k*TAU2/3;ell(Math.cos(a)*d*mir,Math.sin(a)*d,rr,rr*U(.92,1.04),a);}} /* a rounded triangle */
      tz=-U(.024,.034);tx=U(-.008,.008);
      const hx=U(-4,4),hz=U(-5,-1),hh=U(.2,.3);feat=(x,z)=>hh*gauss(x,z,hx,hz,3.2);break;}
    case 'Biarritz':{ell(0,0,U(6.5,7.5),U(18,21));tz=-U(.006,.012);tx=U(-.006,.006);
      const zs=U(-2.5,2.5),d=U(.34,.46),sg=U(2.4,3);feat=(x,z)=>-d*Math.exp(-(z-zs)*(z-zs)/(2*sg*sg)); /* a deep swale across the middle */
      break;}
    case 'Punchbowl':{ell(0,0,U(11.5,13),U(11,12.5));tz=-U(.002,.008);tx=U(-.006,.006);
      const k=U(.0018,.0026),rd=U(.14,.2);feat=(x,z,fe)=>k*(x*x+z*z)+rd*sm(2.8,.4,fe);break;}
    case 'Double plateau':{ell(-U(3,4),U(2.5,3.5),U(8,9),U(7,8),.3);ell(U(3,4),-U(2.5,3.5),U(8,9),U(7,8),.3);tz=-U(.002,.008);tx=U(-.005,.005);
      const hA=U(.3,.42),hB=U(.1,.18);feat=(x,z)=>{let v=0;for(let i=0;i<2;i++){const e=E[i],dx=x-e.x,dz=z-e.z,c=Math.cos(e.rot),sn=Math.sin(e.rot),u=(dx*c+dz*sn)/e.a,w=(-dx*sn+dz*c)/e.b,f=u*u+w*w;v+=(i?hB:hA)*sm(1.5,.5,f);}return v;};break;}
    case 'Road':{ell(0,0,U(7.5,8.5),U(16,18),U(.45,.6));tz=-U(.012,.02);tx=U(-.012,.012);
      const zs=U(-3,3),d=U(.12,.2);feat=(x,z)=>-d*sm(zs-2.5,zs+2.5,z)-.1*Math.sin(z*.35);break;}
    case 'Tiers':{ell(0,0,U(12,13.5),U(10.5,12),U(-.3,.3));tz=-U(.002,.006);tx=U(-.006,.006);
      const zc=U(-2,2),st=U(.3,.42);feat=(x,z)=>st*sm(zc+1.6,zc-1.6,z); /* a clear step: high back tier, low front tier */
      break;}
    case 'Spine':{ell(0,0,U(8.5,9.5),U(14,16),U(-.12,.12));tz=-U(.004,.01);tx=U(-.006,.006);
      const h0=U(.3,.42),sg=U(2.3,3),off=U(-1,1);feat=(x,z)=>h0*Math.exp(-(x-off)*(x-off)/(2*sg*sg)); /* a ridge down the middle that sheds the ball to both sides */
      break;}
    case 'False front':{ell(0,0,U(11,12.5),U(11,12.5),U(-.3,.3));tz=-U(.014,.022);tx=U(-.008,.008);
      const zf=U(2,3.5),dr=U(.42,.58);feat=(x,z)=>-dr*sm(zf,zf+4.8,z); /* the front falls back toward the player */
      break;}
    case 'Kidney':case 'Two-lobe':case 'Three-lobe':{
      /* an elongated body with round lobes off its sides, as in the classic green-shape drawings */
      const al=U(.95,1.35),ux=Math.cos(al),uz=Math.sin(al),vx=-uz,vz=ux,A=U(9.5,10.5),B=U(6,7),sd=sgn();
      ell(0,0,A,B,al);
      const L=type==='Kidney'?[[.8,1]]:type==='Two-lobe'?[[.82,1],[-.6,-1]]:[[.85,1],[.02,-1],[-.8,1]],mnd=[];
      for(const [t,sg] of L){const cx=ux*A*t+vx*sg*sd*B*.62,cz=uz*A*t+vz*sg*sd*B*.62,rr=U(3.9,4.7);ell(cx,cz,rr,rr*U(.92,1.05),0);mnd.push([cx,cz]);}
      tz=-U(.004,.012);tx=U(-.008,.008);const hh=U(.2,.3);
      feat=(x,z)=>hh*mnd.reduce((a,c)=>a+gauss(x,z,c[0]*mir,c[1],2.8),0);break;}
    case 'Clover':{const a0=U(0,6.283),d=U(4.4,5.4),rr=U(6.8,7.8),hh=U(.2,.3),cs=[];
      for(let k=0;k<3;k++){const a=a0+k*TAU2/3,cx=Math.cos(a)*d,cz=Math.sin(a)*d;cs.push([cx,cz]);ell(cx*mir,cz,rr,rr*U(.92,1.05),a);}
      tz=-U(.002,.008);tx=U(-.006,.006);feat=(x,z)=>hh*cs.reduce((a,c)=>a+gauss(x,z,c[0]*mir,c[1],2.8),0);break;}
    default:{const a1=U(-.2,.2),sp=U(2.0,2.4),a2=a1+sp,L=U(7.2,8.2),A=U(10,11),B=U(4.8,5.4);
      ell(Math.cos(a1)*L,Math.sin(a1)*L,A,B,a1);ell(Math.cos(a2)*L,Math.sin(a2)*L,A,B,a2);tz=-U(.002,.008);tx=U(-.006,.006);
      const k=U(.0015,.0022);feat=(x,z)=>k*(x*x+z*z)-.12*gauss(x,z,0,0,3);break;} /* Boomerang: a bent green, bowl at the elbow */
  }
  const DRAMA=.6; /* how bold the contours are: 1 was too dramatic */
  if(feat){const F0=feat;feat=(x,z,fe)=>DRAMA*F0(x,z,fe);}
  tx*=.85;tz*=.85;
  const inside=(x,z)=>{for(const e of E){const dx=x-e.x,dz=z-e.z,c=Math.cos(e.rot),s=Math.sin(e.rot),u=(dx*c+dz*s)/e.a,v=(-dx*s+dz*c)/e.b;if(u*u+v*v<1)return true;}return false;};
  /* outline: march a ray from the middle to the edge of the union of ellipses, smooth the notches, then add a little wobble */
  const OTN=1440,OT=new Float32Array(OTN);
  for(let i=0;i<OTN;i++){const th=(i+.5)/OTN*TAU2-Math.PI,c=Math.cos(th),s=Math.sin(th);let t=0;while(t<60&&inside(c*t,s*t))t+=.1;let lo=Math.max(0,t-.1),hi=t;for(let k=0;k<7;k++){const m=(lo+hi)/2;if(inside(c*m,s*m))lo=m;else hi=m;}OT[i]=lo;}
  /* soft joins without blobby lobes: blur a copy hard, keep the larger of the two (this fills the notches between lobes but leaves the lobes at full size), then ease the seams */
  {const O0=OT.slice(),B=OT.slice();
   for(let pass=0;pass<14;pass++){const c=B.slice();for(let i=0;i<OTN;i++){let a=0;for(let k=-10;k<=10;k++)a+=c[(i+k+OTN)%OTN];B[i]=a/21;}}
   for(let i=0;i<OTN;i++)OT[i]=Math.max(O0[i],B[i]);
   for(let pass=0;pass<5;pass++){const c=OT.slice();for(let i=0;i<OTN;i++){let a=0;for(let k=-5;k<=5;k++)a+=c[(i+k+OTN)%OTN];OT[i]=a/11;}}}
  const lobes=[[3,U(.015,.04),U(0,6.283)],[5,U(.008,.02),U(0,6.283)],[7,U(.004,.012),U(0,6.283)]];
  for(let i=0;i<OTN;i++){const th=(i+.5)/OTN*TAU2-Math.PI;let s=1;for(const l of lobes)s+=l[1]*Math.sin(l[0]*th+l[2]);OT[i]*=s;}
  const outline=th=>{const f=((th+Math.PI)/TAU2%1+1)%1*OTN-.5,i=Math.floor(f),u=f-i;return OT[(i+OTN)%OTN]*(1-u)+OT[(i+1+OTN)%OTN]*u;};
  let Rmax=0,area=0;for(let i=0;i<OTN;i++){Rmax=Math.max(Rmax,OT[i]);area+=.5*OT[i]*OT[i]*TAU2/OTN;}
  let S=Rmax*1.04;
  const inIsland=(x,z)=>x*x+z*z<OT[((Math.atan2(z,x)+Math.PI)/TAU2*OTN)|0]**2;
  const edgeR=(x,z)=>OT[((Math.atan2(z,x)+Math.PI)/TAU2*OTN)|0]-Math.hypot(x,z);
  /* hazards sit beside the green, outside its edge, never on it */
  const hazards=[];
  const HAZ_ON=false; /* bunkers and ponds are switched off for now: flip to true to bring them back */
  for(const sp of (HAZ_ON?spec:[])){
    const R0=outline(sp.th),p0={x:Math.cos(sp.th)*R0,z:Math.sin(sp.th)*R0},e=.02;
    const pa=[Math.cos(sp.th-e)*outline(sp.th-e),Math.sin(sp.th-e)*outline(sp.th-e)],pb=[Math.cos(sp.th+e)*outline(sp.th+e),Math.sin(sp.th+e)*outline(sp.th+e)];
    let Tx=pb[0]-pa[0],Tz=pb[1]-pa[1];const tl=Math.hypot(Tx,Tz)||1;Tx/=tl;Tz/=tl;
    let nx=Tz,nz=-Tx;if(nx*p0.x+nz*p0.z<0){nx=-nx;nz=-nz;}
    const ph=U(0,6.283),hz={ap:sp.kind==='water'?1.18:1.3,kind:sp.kind,aT:sp.aT,aN:sp.aN,Tx,Tz,nx,nz,ph,d:sp.kind==='water'?.12:U(.16,.21),cx:0,cz:0};
    let gap=.25,ok=false;
    for(let k=0;k<16&&!ok;k++){
      hz.cx=p0.x+nx*(gap+sp.aN);hz.cz=p0.z+nz*(gap+sp.aN);ok=true;
      for(let a=0;a<40;a++){const f=a/40*TAU2,u=Math.cos(f)*sp.aT*1.02,v=Math.sin(f)*sp.aN*1.02,x=hz.cx+Tx*u+nx*v,z=hz.cz+Tz*u+nz*v;if(inIsland(x,z)){ok=false;break;}}
      if(!ok)gap+=.3;
    }
    if(!ok)continue;
    if(hazards.some(o=>Math.hypot(o.cx-hz.cx,o.cz-hz.cz)<.8*(o.aT+hz.aT)))continue;
    hazards.push(hz);
  }
  const hq=(h,x,z)=>{const dx=x-h.cx,dz=z-h.cz,u=(dx*h.Tx+dz*h.Tz)/h.aT,v=(dx*h.nx+dz*h.nz)/h.aN,f=Math.atan2(v,u),w=1+.07*Math.sin(3*f+h.ph)+.04*Math.sin(5*f+2*h.ph);return (u*u+v*v)/(w*w);};
  const inKind=(k,x,z)=>{for(const h of hazards)if(h.kind===k&&hq(h,x,z)<1)return true;return false;};
  const inSand=(x,z)=>inKind('sand',x,z),inWater=(x,z)=>inKind('water',x,z);
  const inApron=(x,z)=>{for(const h of hazards)if(hq(h,x,z)<h.ap*h.ap)return true;return false;};
  const inBunker=(x,z)=>!inWater(x,z)&&inApron(x,z); /* the sand and the dark ground around it: all one penalty area, all part of the same landmass */
  /* the drawn landmass: the green plus the ground around each hazard, as one smooth outline */
  const OV=OT.slice();
  for(let i=0;i<OTN;i++){const th=(i+.5)/OTN*TAU2-Math.PI,c=Math.cos(th),sn=Math.sin(th);let t=OT[i];for(let u=OT[i]+.1;u<OT[i]+14;u+=.1){if(inApron(c*u,sn*u)){t=u;}else if(u-t>.8)break;}OV[i]=t;}
  for(let pass=0;pass<4;pass++){const c=OV.slice();for(let i=0;i<OTN;i++){let a=0;for(let k=-6;k<=6;k++)a+=c[(i+k+OTN)%OTN];OV[i]=Math.max(OT[i],a/13);}}
  const vOutline=th=>{const f=((th+Math.PI)/TAU2%1+1)%1*OTN-.5,i=Math.floor(f),u=f-i;return OV[(i+OTN)%OTN]*(1-u)+OV[(i+1+OTN)%OTN]*u;};
  let vRmax=0;for(let i=0;i<OTN;i++)vRmax=Math.max(vRmax,OV[i]);S=Math.max(S,vRmax*1.04);
  const dip=(x,z)=>{let v=0;for(const h of hazards){const q=hq(h,x,z);if(q<1.6){const t=1-q/1.6;v-=h.d*t*t*(3-2*t);}}return v;};
  /* contour: a gentle tilt, a few soft bumps, and the archetype's own feature; sampled once onto a fine grid so the physics stays fast */
  const bumps=[];const nb=1+(r()<.5?1:0)+(r()<.3?1:0);
  for(let i=0;i<nb;i++){const a=r()*6.283,d=r()*.5*Math.min(Rmax,14);bumps.push({x:Math.cos(a)*d,z:Math.sin(a)*d,s:U(3.4,6),a:sgn()*U(.05,.12)});}
  const raw=(x,z)=>{let v=tx*x+tz*z;for(const b of bumps){const dx=x-b.x,dz=z-b.z;v+=b.a*Math.exp(-(dx*dx+dz*dz)/(2*b.s*b.s));}if(feat)v+=feat(x,z,edgeR(x,z));return v;};
  let ext=Rmax+2;for(const h of hazards)ext=Math.max(ext,Math.abs(h.cx)+h.aT*1.4+1,Math.abs(h.cz)+h.aT*1.4+1);
  /* what the camera should frame: the green and its hazards together */
  const vp=[];for(let i=0;i<OTN;i+=20){const th=(i+.5)/OTN*TAU2-Math.PI;vp.push([Math.cos(th)*OT[i],Math.sin(th)*OT[i]]);}
  for(const h of hazards)for(let a=0;a<24;a++){const f=a/24*TAU2,u=Math.cos(f)*h.aT*1.15,v=Math.sin(f)*h.aN*1.15;vp.push([h.cx+h.Tx*u+h.nx*v,h.cz+h.Tz*u+h.nz*v]);}
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of vp){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}
  const vcx=(x0+x1)/2,vcz=(z0+z1)/2;let Rview=0;for(const q of vp)Rview=Math.max(Rview,Math.hypot(q[0]-vcx,q[1]-vcz));
  const GS=.15,GN=Math.ceil(2*ext/GS)+1,hg=new Float32Array(GN*GN);
  let mn=1e9;for(let j=0;j<GN;j++)for(let i=0;i<GN;i++){const x=-ext+i*GS,z=-ext+j*GS,v=raw(x,z);hg[j*GN+i]=v;if(inIsland(x,z)&&v<mn)mn=v;}
  for(let k=0;k<hg.length;k++)hg[k]-=mn;
  const gxg=new Float32Array(GN*GN),gzg=new Float32Array(GN*GN);
  for(let j=1;j<GN-1;j++)for(let i=1;i<GN-1;i++){gxg[j*GN+i]=(hg[j*GN+i+1]-hg[j*GN+i-1])/(2*GS);gzg[j*GN+i]=(hg[(j+1)*GN+i]-hg[(j-1)*GN+i])/(2*GS);}
  const bil=(A,x,z)=>{let fx=(x+ext)/GS,fz=(z+ext)/GS;fx=fx<0?0:fx>GN-1.001?GN-1.001:fx;fz=fz<0?0:fz>GN-1.001?GN-1.001:fz;const i=fx|0,j=fz|0,u=fx-i,v=fz-j,o=j*GN+i;return (A[o]*(1-u)+A[o+1]*u)*(1-v)+(A[o+GN]*(1-u)+A[o+GN+1]*u)*v;};
  const h=(x,z)=>bil(hg,x,z),grad=(x,z)=>{GR[0]=bil(gxg,x,z);GR[1]=bil(gzg,x,z);return GR;};
  const hv=(x,z)=>h(x,z)+dip(x,z);
  /* the pin: on a slope of 3% or less, clear of the edge, and often tucked near a hazard */
  const hzDist=(x,z)=>{let m=1e9;for(const hz of hazards)for(let a=0;a<24;a++){const f=a/24*TAU2,u=Math.cos(f)*hz.aT,v=Math.sin(f)*hz.aN;m=Math.min(m,Math.hypot(x-(hz.cx+hz.Tx*u+hz.nx*v),z-(hz.cz+hz.Tz*u+hz.nz*v)));}return m;};
  const wantNear=hazards.length&&r()<.65;let pin=null;
  for(let n=0;n<500&&!pin;n++){
    const a=r()*6.283,ff=.08+r()*.8,ro=outline(a),x=Math.cos(a)*ro*ff,z=Math.sin(a)*ro*ff;
    if(!inside(x,z)&&!inIsland(x,z))continue;
    const eo=edgeR(x,z),g=grad(x,z),sl=Math.hypot(g[0],g[1]),slMax=n<300?.032:.045;
    if(eo<(n<400?3.6:2.8)||sl>slMax)continue;
    if(wantNear&&n<300){const dh=hzDist(x,z);if(dh<3.5||dh>8.5)continue;}
    pin={x,z};
  }
  if(!pin)pin={x:0,z:0};
  /* every club gets its turn: one club is picked evenly, then the pin sits 82% to 95% of its stock carry away, so it is always reachable */
  const cu=r()*CLUBS.length,ck=Math.min(CLUBS.length-1,Math.floor(cu)),pinYd=Math.round(CLUBS[ck].y*(.82+.13*(cu-ck))),pinM=pinYd/YD;
  const D=pin.z+Math.sqrt(Math.max(1,pinM*pinM-pin.x*pin.x));
  const stimp=Math.round((9.5+r()*2.5)*2)/2;
  const wmph=Math.round(5+15*Math.pow(r(),1.5)),wang=r()*6.283,wind={mph:wmph,x:Math.cos(wang),z:Math.sin(wang)};
  return {type,waterAround,vOutline,inSand,R:Math.sqrt(area/Math.PI),area,Rmax,Rview,vcx,vcz,S,outline,h,hv,grad,inIsland,inBunker,inWater,hazards,hq,pin,edgeR,P:{x:0,z:D},pinYd,stimp,wind,af:5.5/stimp};
}

/* The carry is set by the aim spot. The club only decides whether it is reachable and how hard you must swing:
   pressing past ~92% or hitting very soft widens the miss. Out of reach lands short. */
function geom(sel,aim){
  const c=CLUBS[sel.club];
  const dx=aim.x-H.P.x,dz=aim.z-H.P.z,dist=Math.hypot(dx,dz)||1;
  const ux=dx/dist,uz=dz/dist,rx=-uz,rz=ux,sw=SPIN[sel.spin].w,swh=SPIN[sel.spin].wh;
  /* wind: headwind adds ~1% of distance per mph, tailwind removes ~0.5% per mph (Golf Monthly rule of thumb); crosswind drift is a placeholder 0.35% of distance per mph (no source found). High spin feels it more. */
  const W=H.wind,head=-(W.x*ux+W.z*uz)*W.mph,cross=(W.x*rx+W.z*rz)*W.mph;
  /* a shot that curves into the crosswind holds its line (-25% drift), one that curves with it is pushed more (+25%); placeholder size */
  const ls=SHAPE[sel.shape].s*handSign(sel); /* + = the ball bends right, - = bends left */
  const sf=1+.15*ls*Math.sign(cross),curve=ls*.045*dist; /* flight bow only: 4.5% of the distance per step (placeholder); it does not move the landing spot */
  const wf=1+(head>=0?.01:.005)*head*swh,wdrift=cross*.0035*dist*sw*sf,drift=wdrift;
  const need=dist*YD*wf,swing=need/c.y,carry=Math.min(need,c.y)/YD,land=carry/wf;
  const df=1+1.5*Math.max(0,swing-.95)+3.5*Math.max(0,.9-swing);
  return {ux,uz,rx,rz,dist,carry,land,wf,drift,wdrift,curve,head,cross,swing,still:Math.min(dist*YD,c.y)/YD-dist,sw0:dist*YD/c.y,sa:DISP*.028*carry*df*SPIN[sel.spin].d,sl:DISP*.024*carry*df*Math.sqrt(SPIN[sel.spin].d)};
}
function landFrom(g,aim,g1,g2){
  const a=g.land-g.dist+g1*g.sa,l=g2*g.sl+g.drift;
  return {x:aim.x+g.ux*a+g.rx*l,z:aim.z+g.uz*a+g.rz*l,ux:g.ux,uz:g.uz,rx:g.rx,rz:g.rz};
}
const CUPR=.408,BEV=CUPR*1.25; /* the drawn cup and the capture radius are the same circle (0.41 m, 20% bigger than before); the bevel ring around it funnels slow balls in */
let FINE=false; /* analysis rolls coarsely, then re-checks its best candidates and your own shot at the animation's fine step so both agree */
function roll(x,z,vx,vz,rec){
  const fine=rec||FINE,dt=fine?.016:.06,af0=H.af*FRM,pin=H.pin,max=fine?1400:250;
  let af=af0,near=null; /* near = closest pass of the cup that did not drop, and how fast the ball was going */
  if(rec)rec.push(x,z);
  for(let i=0;i<max;i++){
    af=H.edgeR(x,z)<CW?af0*COLLAR:af0;
    const g=H.grad(x,z);let ax=-K*G*SG*g[0],az=-K*G*SG*g[1];
    {const bx=pin.x-x,bz=pin.z-z,bd=Math.hypot(bx,bz);if(bd<BEV&&bd>1e-6){const w=K*G*SG*.12*(1-bd/BEV)/bd;ax+=w*bx;az+=w*bz;}}
    const nx=vx+ax*dt,nz=vz+az*dt,s2=Math.hypot(nx,nz);
    if(s2<=af*dt){if(Math.hypot(ax,az)<=af){vx=0;vz=0;break;}vx=nx;vz=nz;}
    else{const f=1-af*dt/s2;vx=nx*f;vz=nz*f;}
    const ox=x,oz=z;x+=vx*dt;z+=vz*dt;
    /* swept cup check: closest approach of this step to the hole; slower balls and centred balls drop */
    {const sx=x-ox,sz=z-oz,sl=sx*sx+sz*sz,t=sl>0?clamp(((pin.x-ox)*sx+(pin.z-oz)*sz)/sl,0,1):0,d=Math.hypot(ox+sx*t-pin.x,oz+sz*t-pin.z);
     if(d<CUPR&&Math.hypot(vx,vz)<1.75*Math.sqrt(1-(d/CUPR)*(d/CUPR))+.15){if(rec)rec.push(pin.x,pin.z);return {s:'holed',x:pin.x,z:pin.z};}
     if(d<CUPR*1.8&&(!near||d<near.d))near={d,v:Math.hypot(vx,vz)};}
    if(rec)rec.push(x,z);
    if(!H.inIsland(x,z))return H.inBunker(x,z)?{s:'bunker',x,z}:{s:'water',x,z}; /* sand is beside the green; anywhere else off the edge is lost */
  }
  return {s:'green',x,z,near};
}
function outcomeAt(sel,L,rec){
  if(!H.inIsland(L.x,L.z))return H.inBunker(L.x,L.z)?{s:'bunker',x:L.x,z:L.z}:{s:'water',x:L.x,z:L.z};
  const c=CLUBS[sel.club],sp=SPIN[sel.spin],sh=SHAPE[sel.shape];
  /* shape: a draw lands flatter and releases (+12% roll per step), a fade lands steeper and checks (-12% roll, +12% backspin bite); direction matches TrackMan's driver sample (draw 28.8° / 2,643 rpm vs fade 42.9° / 3,768 rpm), size is a placeholder. */
  /* slope at the landing spot: into the slope the ball checks up harder, down the slope it releases and backspin bites less;
     a side slope kicks the ball downhill. */
  const gg=H.grad(L.x,L.z),sa=gg[0]*L.ux+gg[1]*L.uz,cs=gg[0]*L.rx+gg[1]*L.rz;
  const fr=clamp(1-9*sa,.55,1.7),bk=clamp(1+14*sa,.3,2);
  const v=(c.rel*sp.m*fr*(1-.12*sh.s)-c.back*sp.b*bk*(1+.12*sh.s))*Math.sqrt(FRM),lat=(.35*sh.s*handSign(sel)-1.5*cs)*Math.sqrt(FRM);
  return roll(L.x,L.z,L.ux*v+L.rx*lat,L.uz*v+L.rz*lat,rec);
}
function puttEV(x,z,dm,dft){
  let e=PUTT[PUTT.length-1][1];
  for(let i=1;i<PUTT.length;i++){if(dft<=PUTT[i][0]){const a=PUTT[i-1],b=PUTT[i];e=lerp(a[1],b[1],(dft-a[0])/(b[0]-a[0]));break;}}
  e+=.03+.0025*Math.min(dft,60);
  if(dm>.3){
    const lx=(H.pin.x-x)/dm,lz=(H.pin.z-z)/dm,g=H.grad((x+H.pin.x)/2,(z+H.pin.z)/2);
    const along=g[0]*lx+g[1]*lz,cross=Math.abs(g[0]*lz-g[1]*lx);
    let adj=(along>0?-1.5*along:-6*along)+4.5*cross;
    adj=clamp(adj,-.12,.4)*Math.min(1,dft/8);
    e+=adj;
    /* danger around the hole (my tuning, no published data): a putt that can run past the pin off the green or into the sand,
       and a pin on a slope where a short putt rolls back. Both grow with putt length; short putts barely matter. */
    if(!DANGER)return e;
    const dd=Math.min(1,dft/10),pa=H.grad(H.pin.x,H.pin.z),aPin=pa[0]*lx+pa[1]*lz;
    const reach=(.9+.03*dft)*(1+10*Math.max(0,-aPin));
    let dE=6;for(let t=.3;t<=6;t+=.3){const px=H.pin.x+lx*t,pz=H.pin.z+lz*t;if(!H.inIsland(px,pz)||H.inBunker(px,pz)||H.edgeR(px,pz)<CW){dE=t;break;}}
    e+=dd*clamp(1-dE/reach,0,1)*(.5+14*Math.max(0,-aPin))*.22;
    const pn=H.grad(H.pin.x-lx*1.2,H.pin.z-lz*1.2),aNear=pn[0]*lx+pn[1]*lz;
    e+=dd*clamp(10*(aNear-.012),0,.1);
  }
  return e;
}
function evOf(o){
  if(o.s==='holed')return 0;
  if(o.s==='water')return WATER_EV;
  const dm=Math.hypot(o.x-H.pin.x,o.z-H.pin.z),dft=dm*FT;
  if(o.s==='bunker')return 2.45+.006*Math.min(dft,80);
  return puttEV(o.x,o.z,dm,dft);
}
function makeZ(n,seed){const r=mulberry32(seed),a=[],b=[];for(let i=0;i<n;i++){a.push(gauss(r));b.push(gauss(r));}return {g1:a,g2:b};}
function evChoice(sel,aim,Z){
  const g=geom(sel,aim);let s=0;const n=Z.g1.length;
  for(let i=0;i<n;i++)s+=evOf(outcomeAt(sel,landFrom(g,aim,Z.g1[i],Z.g2[i]),null));
  return s/n;
}
/* Looks for the best aim spot, club, spin and shape on this green, and prices the player's own choice.
   For each spot it tries the clubs that reach it with a comfortable swing (72% to 102% of stock). */
function hazOf(sel,aim,Z){
  const g=geom(sel,aim),n=Z.g1.length;let sand=0,water=0,holed=0,ft=0,m=0;
  for(let i=0;i<n;i++){const o=outcomeAt(sel,landFrom(g,aim,Z.g1[i],Z.g2[i]),null);
    if(o.s==='water'){water++;continue;}if(o.s==='bunker')sand++;if(o.s==='holed')holed++;
    ft+=Math.hypot(o.x-H.pin.x,o.z-H.pin.z)*FT;m++;}
  return {sand:sand/n,water:water/n,holed:holed/n,ft:m?ft/m:0};
}
const Z0={g1:[0],g2:[0]};
const PRO_FLOOR=1.0; /* a tap-in is one putt, so even a perfect shot cannot score below this */
function* analyze(sel,aim){
  /* Every aim spot, club, spin and shape is evaluated once with a perfect swing. The tour pro is the best of those
     that a pro would swing at 80% to 100% of stock distance. */
  const step=1.0,S=H.S;
  const nx=Math.floor(2*S/step)+1,vals=new Float32Array(nx*nx).fill(NaN);
  let best=null,done=0;const cand=[];
  for(let j=0;j<nx;j++)for(let i=0;i<nx;i++){
    const x=-S+i*step,z=-S+j*step,ro=H.outline(Math.atan2(z,x));
    if(Math.hypot(x,z)>ro-.5)continue;
    const A={x,z};let bp=9;
    for(let k=0;k<CLUBS.length;k++)for(let sp=0;sp<3;sp++)for(let sh=0;sh<SHAPE.length;sh++){
      const s0={club:k,spin:sp,shape:sh},g=geom(s0,A);
      if(g.swing<.8||g.swing>1.0)continue;
      const ev=evChoice(s0,A,Z0);
      if(ev<bp)bp=ev;
      cand.push({ev,sel:s0,aim:A});if(cand.length>150){cand.sort((a,b)=>a.ev-b.ev);cand.length=40;}
    }
    if(bp<9)vals[j*nx+i]=bp;
    if((++done)%6===0)yield done;
  }
  cand.sort((a,b)=>a.ev-b.ev);cand.length=Math.min(cand.length,40);
  FINE=true;
  for(const c of cand){c.ev=evChoice(c.sel,c.aim,Z0);if(!best||c.ev<best.ev)best=c;}
  if(!best){best={ev:evChoice(sel,aim,Z0),sel,aim};}
  best.ev2=Math.max(PRO_FLOOR,best.ev);
  const mine=evChoice(sel,aim,Z0),hz={you:hazOf(sel,aim,Z0),best:hazOf(best.sel,best.aim,Z0)};
  FINE=false;
  let mn=1e9;for(const v of vals)if(v===v&&v<mn)mn=v;
  return {best,pro:best,mine,heat:{vals,nx,step,S,min:mn},hz};
}
/*ENGINE_END*/
