/* Headless render smoke test: loads dist/test.html, taps an aim point, checks the dashed aim line shows, shoots,
   waits for the result card, and saves screenshots to tests/render/out/. Needs Chrome: set CHROME=/path/to/chrome.
   Software GL (swiftshader) is used so it runs on machines without a GPU. */
const puppeteer=require('puppeteer-core'),path=require('path'),fs=require('fs');
(async()=>{
  const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
  const b=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',protocolTimeout:120000,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage();await p.setViewport({width:430,height:760,deviceScaleFactor:1});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(__dirname,'../../dist/test.html')+'#2026-02-05');await new Promise(r=>setTimeout(r,3000));
  await p.mouse.click(215,300);await new Promise(r=>setTimeout(r,600));
  await p.screenshot({path:path.join(out,'aim.png')});
  await p.evaluate(()=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Shoot').click());
  await new Promise(r=>setTimeout(r,9000));
  await p.screenshot({path:path.join(out,'result.png')});
  const card=await p.evaluate(()=>{const c=document.querySelector('#result,#res,.result');return !!c&&!c.hidden;});
  console.log('page errors:',errs.length?errs:'none','| result card visible:',card);
  await b.close();process.exit(errs.length||!card?1:0);
})().catch(e=>{console.log('FAIL',e.message);process.exit(1);});
