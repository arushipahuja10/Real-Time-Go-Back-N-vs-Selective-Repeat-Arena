const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function luminance(hex) {
 const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a,b) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error' && !m.text().includes('net::'))errors.push(m.text());});
 try {
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  const fonts=await page.evaluate(()=>[...document.fonts].map(f=>({family:f.family,status:f.status})));
  assert(fonts.some(f=>f.family==='Instrument Sans' && f.status==='loaded'),'Instrument Sans loads');
  assert(fonts.some(f=>f.family==='JetBrains Mono' && f.status==='loaded'),'JetBrains Mono loads');
  const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert(!/gradient|backdrop-filter|box-shadow|system-ui|Roboto|Poppins|Space Grotesk|\bInter\b/i.test(styles),'Banned CSS');
  for(const file of ['index.html','main.js','view.js']) {
   assert(!/\p{Extended_Pictographic}/u.test(fs.readFileSync(path.join(root,file),'utf8')),file+' emoji');
  }
  const css=await page.evaluate(()=>{
   const style=getComputedStyle(document.documentElement);
   const names=['base','panel','text','muted','subtle','data','ack','lost','retx','buffered','data-fill','ack-fill','lost-fill','retx-fill','buffer-fill','zebra','narration'];
   return Object.fromEntries(names.map(n=>[n,style.getPropertyValue('--'+n).trim()]));
  });
  const pairs=[['text','panel'],['muted','panel'],['subtle','panel'],['muted','base'],['subtle','zebra'],['text','narration'],['data','data-fill'],['ack','ack-fill'],['lost','lost-fill'],['retx','retx-fill'],['buffered','buffer-fill']];
  const contrasts=pairs.map(([a,b])=>({text:a,surface:b,ratio:Number(contrast(css[a],css[b]).toFixed(2))}));
  assert(contrasts.every(x=>x.ratio>=4.5),JSON.stringify(contrasts));
  // Verify the native frame loop independently of the virtual-clock interaction QA.
  await page.locator('#btn-play').click();
  await page.waitForTimeout(2100);
  const paint=await page.locator('.packet-el:not(.pkt-arrived):not(.pkt-dropped):not(.pkt-discarded)').evaluateAll(els=>els.map(el=>{
   const now=Engine.SimClock.simTime,ack=el.dataset.kind==='ack';
   const t=Engine.clamp((now-Number(el.dataset.launch))/(ack?Engine.SimConfig.ackDelay:Engine.SimConfig.propagationDelay),0,1);
   const expected=(ack?1-t:t)*(el.parentElement.clientWidth-el.offsetWidth);
   const rect=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();
   return {kind:el.dataset.kind,expected,actual:rect.x-parent.x,top:rect.y-parent.y,height:rect.height};
  }));
  assert(paint.every(p=>Math.abs(p.expected-p.actual)<1),'Native packet positions');
  const data=paint.filter(p=>p.kind==='data'),acks=paint.filter(p=>p.kind==='ack');
  assert(data.every(d=>acks.every(a=>d.top+d.height<=a.top)),'DATA and ACK lanes never overlap');
  await page.locator('#btn-play').click();
  await page.keyboard.press('r');
  const resetView=await page.locator('#arena-gbn .expected-seq-value').textContent();
  assert.equal(resetView,'0');
  // Offline operation still loads all local scripts and uses fallbacks.
  await page.context().setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  const offlineTests=await page.evaluate(()=>runTests());
  assert(offlineTests.every(t=>t.pass));
  await page.locator('#btn-play').click(); await page.waitForTimeout(500);
  assert(await page.locator('.packet-el').count()>0);
  assert.equal(errors.length,0,JSON.stringify(errors));
  const report={fonts,contrasts,nativePaint:paint,offlineTests,errors};
  fs.writeFileSync(path.join(root,'docs/screenshots/qa-audit.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({fonts,minimumContrast:Math.min(...contrasts.map(c=>c.ratio)),nativePackets:paint.length,offlineTests:offlineTests.length,errors},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
