/* synthesised sound effects, no files */
const SFX=(function(){
  let ac=null,on=true;try{if(localStorage.getItem('pinhigh:snd')==='0')on=false;}catch(e){}
  const api={get on(){return on;},set(v){on=v;try{localStorage.setItem('pinhigh:snd',v?'1':'0');}catch(e){}}};
  function ctx(){if(!on)return null;if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}if(ac.state==='suspended')ac.resume();return ac;}
  function noise(c,dur,type,f0,f1,vol){
    const n=Math.max(1,Math.floor(c.sampleRate*dur)),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
    const s=c.createBufferSource();s.buffer=b;const f=c.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(f0,c.currentTime);f.frequency.exponentialRampToValueAtTime(f1,c.currentTime+dur);
    const g=c.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(c.destination);s.start();
  }
  function tone(c,fr,t0,dur,vol,type){
    const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.value=fr;const t=c.currentTime+t0;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+.02);
  }
  api.unlock=function(){ctx();};
  api.strike=function(){const c=ctx();if(!c)return;noise(c,.09,'bandpass',2600,900,.5);tone(c,150,0,.12,.35,'triangle');};
  api.land=function(sand){const c=ctx();if(!c)return;noise(c,sand?.22:.14,'lowpass',sand?1400:900,200,sand?.45:.35);tone(c,sand?90:110,0,.12,.25,'sine');};
  api.splash=function(){const c=ctx();if(!c)return;noise(c,.55,'bandpass',2400,500,.55);tone(c,200,0,.25,.12,'sine');};
  api.cup=function(){const c=ctx();if(!c)return;tone(c,1200,0,.08,.25,'triangle');tone(c,880,.07,.1,.2,'triangle');noise(c,.1,'highpass',3000,5000,.2);};
  api.tick=function(u){const c=ctx();if(!c)return;tone(c,420+u*620,0,.04,.06,'square');};
  api.reveal=function(cls,top){const c=ctx();if(!c)return;
    const sets={3:[523,659,784,1047],2:[440,554,659],1:[330,262]};const ns=sets[cls]||sets[2];
    ns.forEach((f,i)=>tone(c,f,i*.09,.32,.16,'triangle'));if(top){tone(c,1319,ns.length*.09,.5,.14,'sine');}};
  return api;
})();
/* confetti */
const FXC=(function(){
  const cv=$('fx'),g=cv.getContext('2d');let P=[],run=false,W=0,Hh=0;
  function size(){const d=Math.min(2,window.devicePixelRatio||1);W=cv.width=innerWidth*d;Hh=cv.height=innerHeight*d;}
  function loop(){
    g.clearRect(0,0,W,Hh);const d=Math.min(2,window.devicePixelRatio||1);
    P=P.filter(p=>p.y<Hh+40&&p.a>0);
    for(const p of P){p.vy+=.35*d;p.vx*=.992;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.a-=.004;g.save();g.globalAlpha=Math.max(0,Math.min(1,p.a));g.translate(p.x,p.y);g.rotate(p.r);g.fillStyle=p.c;g.fillRect(-p.w/2,-p.h/2,p.w,p.h);g.restore();}
    if(P.length)requestAnimationFrame(loop);else{run=false;g.clearRect(0,0,W,Hh);}
  }
  return {burst(n,palette){
    if(reduced)return;size();const d=Math.min(2,window.devicePixelRatio||1);
    for(let i=0;i<n;i++){const side=i%2?1:-1;P.push({x:W/2+side*W*.18+(Math.random()-.5)*W*.1,y:Hh*.38,vx:(Math.random()*9+3)*(Math.random()<.5?-1:1)*d*.6+side*2*d,vy:-(Math.random()*13+7)*d,
      w:(5+Math.random()*5)*d,h:(3+Math.random()*4)*d,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:palette[i%palette.length],a:1.2});}
    if(!run){run=true;requestAnimationFrame(loop);}
  }};
})();
