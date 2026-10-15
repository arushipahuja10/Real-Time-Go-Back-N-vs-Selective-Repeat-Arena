const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');

async function fullQA(page,errors) {
  const report={screenshots:[],scenarios:[],errors};
  const out=path.join(root,'docs/screenshots');
  const check=async name => {
    const layout=await page.evaluate(() => {
      const d=document.documentElement;
      const boxes=[...document.querySelectorAll('.arena,.controls-bar,.scoreboard,.endpoint-box')];
      return {page:[d.scrollWidth,d.scrollHeight],viewport:[innerWidth,innerHeight],overflow:boxes.filter(el => el.scrollHeight>el.clientHeight+1 || el.scrollWidth>el.clientWidth+1).map(el=>({class:el.className,size:[el.clientWidth,el.clientHeight],scroll:[el.scrollWidth,el.scrollHeight]}))};
    });
    assert.deepEqual(layout.page,layout.viewport,name+' page overflow');
    assert.deepEqual(layout.overflow,[],name+' panel overflow '+JSON.stringify(layout.overflow));
  };
  const capture=async name => {
    await check(name);
    await page.screenshot({path:path.join(out,name+'.png')});
    report.screenshots.push(name+'.png');
  };
  const range=async (id,value) => page.evaluate(([id,value]) => { const el=document.getElementById('slider-'+id); el.value=value; el.dispatchEvent(new Event('input',{bubbles:true})); },[id,value]);
  const reset=async () => {
    await page.keyboard.press('Escape');
    await page.keyboard.press('r');
    await page.clock.runFor(100);
  };
  const start=async () => { await page.locator('#btn-play').click(); await page.clock.runFor(64); };
  const finish=async (budget=60000) => {
    for(let elapsed=0;elapsed<budget;elapsed+=1000) {
      assert.equal(errors.length,0,errors[0]);
      if(await page.evaluate(() => PanelView.history.gbn.done && PanelView.history.sr.done)) { await page.clock.runFor(800); return; }
      await page.clock.runFor(1000);
    }
    throw new Error('Transfer did not complete within simulated wall-time budget');
  };
  const delivered=async total => {
    for(const p of ['gbn','sr']) {
      const values=await page.locator('#arena-'+p+' .delivered-chip').allTextContents();
      assert.deepEqual(values.map(Number),Array.from({length:total},(_,i)=>i),p+' exactly-once ordered delivery');
    }
  };
  try {
    for(const [width,height] of [[1366,768],[1920,1080]]) {
      await page.setViewportSize({width,height}); await reset();
      await capture('idle-'+width);
      await start(); await page.clock.runFor(520);
      await page.locator('#arena-gbn .pkt-data[data-seq="1"]:not(.pkt-dropped)').click();
      assert.equal(await page.locator('#arena-gbn .stat-lost').textContent(),'1');
      assert.equal(await page.locator('#arena-sr .stat-lost').textContent(),'1');
      await page.clock.runFor(3000);
      await capture('mid-loss-'+width);
      const geometry=await page.locator('.packet-el:not(.pkt-arrived):not(.pkt-dropped):not(.pkt-discarded)').evaluateAll(els=>els.map(el=>({left:parseFloat(el.style.left),actual:el.getBoundingClientRect().x-el.parentElement.getBoundingClientRect().x})));
      assert(geometry.every(g=>Math.abs(g.left-g.actual)<1),'Packet paint follows linear simulation positions');
      assert((await page.locator('#arena-sr .buf-filled').count())>=2,'SR visibly buffers packets');
      await finish(); await delivered(12);
      await capture('final-result-'+width);
      const combinedPromise=page.waitForEvent('download');
      await page.locator('#btn-download-timelines').click();
      const combined=await combinedPromise;
      assert.equal(combined.suggestedFilename(),'gbn-sr-timeline.png');
      await combined.saveAs(path.join(out,'export-both-'+width+'.png'));
      assert(Number(await page.locator('#arena-gbn .stat-retransmissions').textContent())>1);
      assert.equal(await page.locator('#arena-sr .stat-retransmissions').textContent(),'1');
      await page.keyboard.press('Escape');
      await page.locator('#arena-gbn [data-view="timeline"]').click();
      await page.locator('#arena-sr [data-view="timeline"]').click();
      await capture('timeline-'+width);
      const history=await page.evaluate(() => ({
        g:PanelView.history.gbn.flights.filter(f=>f.lost).length,
        s:PanelView.history.sr.flights.filter(f=>f.lost).length,
        t:PanelView.history.gbn.marks.some(m=>m.tag==='TMO'),
        b:PanelView.history.sr.marks.some(m=>m.tag==='BUF'),
        png:PanelView.exportData('gbn').slice(0,22)
      }));
      assert.deepEqual(history,{g:1,s:1,t:true,b:true,png:'data:image/png;base64,'});
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#arena-gbn [data-export]').click();
      const download=await downloadPromise;
      assert.equal(download.suggestedFilename(),'gbn-timeline.png');
      await download.saveAs(path.join(out,'export-gbn-'+width+'.png'));
      report.scenarios.push(width+' idle/loss/recovery/timeline/export');
      console.log('QA: completed captures at '+width+'x'+height);
      // Return to lane for subsequent runs.
      await page.locator('#arena-gbn [data-view="lane"]').click();
      await page.locator('#arena-sr [data-view="lane"]').click();
    }
    await page.setViewportSize({width:1366,height:768});
    if (process.env.QA_CAPTURE_ONLY === '1') {
      await reset(); await page.keyboard.press('d'); await page.clock.runFor(600);
      await page.locator('#btn-demo-pause').click(); await capture('guided-paused-1366');
      await page.keyboard.press('p'); await capture('guided-presentation-1366');
      await page.keyboard.press('p'); await reset(); await page.keyboard.press('p');
      await start(); await page.clock.runFor(1800); await capture('presentation-1366');
      await page.keyboard.press('p'); await reset();
      report.scenarios.push('Bundled-font guided/presentation layout refresh');
      return;
    }
    for(const speed of [.5,2]) for(let w=1;w<=7;w++) {
      await reset(); await range('window',w); await range('speed',speed); await range('total',8);
      await start(); await finish(90000); await delivered(8);
      assert.equal(await page.locator('#arena-gbn .stat-lost').textContent(),'0');
      assert.equal(await page.locator('#arena-sr .stat-lost').textContent(),'0');
      report.scenarios.push('W='+w+' / '+speed+'x ordered delivery');
    }
    console.log('QA: window/speed matrix complete');
    await reset(); await range('window',7); await range('speed',2); await range('total',20);
    await start(); await finish(); await delivered(20); await page.keyboard.press('Escape'); await check('20-packet ruler');
    await reset(); await range('window',4); await range('speed',1); await range('total',8);
    await page.keyboard.press('m'); // Mirror off.
    await start(); await page.clock.runFor(500);
    await page.locator('#arena-sr .pkt-data[data-seq="1"]:not(.pkt-dropped)').click();
    assert.equal(await page.locator('#arena-gbn .stat-lost').textContent(),'0');
    assert.equal(await page.locator('#arena-sr .stat-lost').textContent(),'1');
    await finish(); await delivered(8);
    report.scenarios.push('Mirror off: independent SR DATA loss');
    await reset(); await page.keyboard.press('m'); // Mirror on; ACKs remain independent.
    await range('timeout',4.5);
    await start(); await page.clock.runFor(1800);
    await page.locator('#arena-gbn .pkt-ack[data-seq="0"]:not(.pkt-arrived):not(.pkt-dropped)').click();
    assert.equal(await page.locator('#arena-sr .stat-lost').textContent(),'0');
    await page.locator('#arena-sr .pkt-ack[data-seq="0"]:not(.pkt-arrived):not(.pkt-dropped)').click();
    await finish(); await delivered(8);
    assert.equal(await page.locator('#arena-gbn .stat-timeouts').textContent(),'0');
    assert(Number(await page.locator('#arena-sr .stat-timeouts').textContent())>=1);
    report.scenarios.push('ACK drop: GBN cumulative resilience / SR selective recovery');
    await reset(); await start(); await page.clock.runFor(800);
    for(let i=0;i<8;i++) {
      await page.locator('#btn-play').click();
      const time=await page.evaluate(()=>Engine.SimClock.simTime);
      await page.clock.runFor(200);
      assert.equal(await page.evaluate(()=>Engine.SimClock.simTime),time,'Pause freezes clock');
      await page.locator('#btn-play').click(); await page.clock.runFor(100);
    }
    await reset();
    assert.equal(await page.locator('.packet-el').count(),0);
    assert.equal(await page.locator('.delivered-chip').count(),0);
    assert.equal(await page.locator('.log-entry').count(),0);
    assert.equal(await page.evaluate(()=>PanelView.history.gbn.flights.length+PanelView.history.sr.flights.length),0);
    const baseline=await page.locator('*').count();
    const subscribers=await page.evaluate(()=>Engine.SimClock._subscribers.length);
    for(let i=0;i<6;i++) { await start(); await page.clock.runFor(650); await reset(); }
    assert.equal(await page.locator('*').count(),baseline,'Reset returns to baseline DOM');
    assert.equal(await page.evaluate(()=>Engine.SimClock._subscribers.length),subscribers,'No subscription leaks');
    report.scenarios.push('Repeated pause/resume and mid-run reset / DOM + subscription baseline');
    await page.keyboard.press('d'); await page.clock.runFor(600);
    await page.locator('#btn-demo-pause').click();
    const step=await page.locator('#demo-step-num').textContent();
    await page.clock.runFor(2000);
    assert.equal(await page.locator('#demo-step-num').textContent(),step);
    await capture('guided-paused-1366');
    await page.locator('#btn-demo-pause').click(); await page.clock.runFor(18000);
    assert.equal(await page.locator('#demo-step-num').textContent(),'Step 7 / 7');
    await finish(); await delivered(12);
    assert.equal(await page.locator('#arena-gbn .stat-lost').textContent(),'3');
    assert.equal(await page.locator('#arena-sr .stat-lost').textContent(),'2');
    report.scenarios.push('Guided demo end to end / pause resumes remaining narration delay');
    await reset(); await page.keyboard.press('d'); await page.clock.runFor(1500);
    await page.locator('#btn-demo-next').click();
    await page.locator('#btn-demo-exit').click();
    assert(await page.locator('#guided-narration-bar').evaluate(el=>el.classList.contains('hidden')));
    report.scenarios.push('Demo Next / Exit and D shortcut');
    await reset(); await page.keyboard.press('p'); await start(); await page.clock.runFor(1800);
    assert.equal(await page.locator('#arena-gbn .packet-el').first().evaluate(el=>el.offsetWidth),48);
    await capture('presentation-1366');
    await page.keyboard.press('p'); await reset();
    await page.keyboard.press('?');
    await page.locator('#shortcuts-close').focus();
    await page.keyboard.press('Shift+Tab');
    assert(await page.evaluate(()=>document.activeElement.closest('#shortcuts-modal')!==null),'Dialog traps focus');
    await page.keyboard.press('Escape');
    await page.locator('#btn-explainer').click(); await page.keyboard.press('Escape');
    await page.keyboard.press('s'); await page.keyboard.press('s');
    report.scenarios.push('Presentation, help, focus trap and sound shortcuts');
    assert.equal(errors.length,0,JSON.stringify(errors));
    const hashes=await page.evaluate(() => ({
      fonts:[...document.fonts].map(font=>({family:font.family,status:font.status})),
      nodes:document.querySelectorAll('*').length
    }));
    report.environment=hashes;
    console.log('QA: all '+report.scenarios.length+' scenarios passed');
  } finally {
    fs.writeFileSync(path.join(out,process.env.QA_CAPTURE_ONLY === '1' ? 'qa-captures.json' : 'qa-report.json'),JSON.stringify(report,null,2));
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  if (process.env.QA_FULL === '1') {
    await page.clock.install({time:new Date('2026-10-12T00:00:00Z')});
    await page.clock.pauseAt('2026-10-12T00:00:01Z');
  }
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('net::') && !errors.includes(m.text())) errors.push(m.text()); });
  try {
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    const results = await page.evaluate(() => runTests());
    assert.equal(results.length, 3);
    assert(results.every(r => r.pass), JSON.stringify(results));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    fs.mkdirSync(path.join(root,'docs/screenshots'),{recursive:true});
    await page.screenshot({path:path.join(root,'docs/screenshots/idle-1366.png')});
    console.log(await page.evaluate(() => ({
      width:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight,
      rail:[document.querySelector('.scoreboard').clientHeight,document.querySelector('.scoreboard').scrollHeight],
      arena:[document.querySelector('.arena').clientHeight,document.querySelector('.arena').scrollHeight],
      dock:[document.querySelector('.controls-bar').clientWidth,document.querySelector('.controls-bar').scrollWidth]
    })));
    console.log(JSON.stringify({ stage: process.env.QA_STAGE || 'shell', results, errors }, null, 2));
    if (process.env.QA_FULL === '1') await fullQA(page,errors);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
