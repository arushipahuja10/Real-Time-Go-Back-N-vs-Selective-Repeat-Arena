/* Presentation-only adapter. Protocol files and the simulation engine are untouched. */
(function (global) {
  'use strict';
  const E = global.Engine;
  const paths = {
    play:'m5 3 8 5-8 5Z', pause:'M5 3v10M11 3v10',
    reset:'M3 6a5 5 0 1 1 0 4M3 2v4h4',
    mirror:'M2 4h4l4 8h4M2 12h4l4-8h4M12 2l2 2-2 2M12 10l2 2-2 2',
    demo:'M3 3h10v10H3ZM6 5l5 3-5 3Z', sound:'M2 6h3l4-3v10l-4-3H2ZM12 5q3 3 0 6',
    help:'M6 5a2 2 0 1 1 3 2q-1 1-1 2M8 12h.01M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1',
    screen:'M2 2h12v9H2ZM8 11v3M5 14h6',
    close:'m4 4 8 8M12 4l-8 8', next:'m3 3 7 5-7 5ZM12 3v10',
    download:'M8 2v8M5 7l3 3 3-3M2 11v3h12v-3',
    check:'m3 8 3 3 7-7', keys:'M1 4h14v9H1ZM4 7h.01M7 7h.01M10 7h.01M4 10h7'
  };
  function icon(name) { return '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="' + (paths[name] || paths.help) + '"/></svg>'; }
  function button(el, name, label) {
    if (!el) return;
    el.innerHTML = icon(name) + '<span>' + label + '</span>';
    el.setAttribute('aria-label', label);
  }
  const clean = s => s.replace(/\p{Extended_Pictographic}|\uFE0F|✓/gu, '').trim();
  const arenas = {};
  const lostSequences = {gbn:new Set(),sr:new Set()};
  let viewPending = false;
  function refresh() {
    for (const p of ['gbn','sr']) {
      const a = arenas[p];
      if (!a) continue;
      const time = E.SimClock.simTime;
      a.querySelectorAll('.packet-el[data-launch]').forEach(el => {
        if (el.matches('.pkt-dropped,.pkt-arrived,.pkt-discarded') || el.dataset.lost === 'true') return;
        const ack = el.dataset.kind === 'ack';
        const delay = ack ? E.SimConfig.ackDelay : E.SimConfig.propagationDelay;
        const t = E.clamp((time - Number(el.dataset.launch)) / delay, 0, 1);
        const width = el.parentElement.clientWidth;
        el.style.left = ((ack ? 1-t : t) * Math.max(0, width-el.offsetWidth)) + 'px';
        el.style.top = (ack ? Math.max(el.parentElement.clientHeight/2 + 4, el.parentElement.clientHeight-el.offsetHeight-4) : el.offsetHeight >= 48 ? 4 : 8) + 'px';
      });
      a.querySelectorAll('.window-readout').forEach(el => { el.textContent = E.SimConfig.windowSize; });
      a.querySelectorAll('.window-cell').forEach(el => el.classList.toggle('wc-lost',lostSequences[p].has(Number(el.dataset.seq))));
      const fill = a.querySelector('#gbn-timer-fill');
      if (fill) {
        const remaining = (parseFloat(fill.style.width) || 0) * E.SimConfig.timeoutDuration / 100;
        a.querySelector('#gbn-countdown').textContent = remaining > 0 ? 'T-' + remaining.toFixed(1) + 's' : 'T—idle';
      }
      if (PanelView.drawTimeline) PanelView.drawTimeline(p);
    }
    const state = document.getElementById('session-state');
    if (state) state.textContent = (PanelView.history?.gbn.done && PanelView.history?.sr.done ? 'COMPLETE' : E.SimClock._running ? 'LIVE' : E.SimClock.simTime > 0 ? 'HOLD' : 'IDLE') + ' / ' + E.SimClock.simTime.toFixed(1).padStart(4,'0') + ' s';
  }
  function scheduleRefresh() {
    if (viewPending) return;
    viewPending = true;
    queueMicrotask(() => { viewPending = false; refresh(); });
  }
  function reset() {
    if (PanelView.clearCounters) PanelView.clearCounters();
    lostSequences.gbn.clear(); lostSequences.sr.clear();
    for (const a of Object.values(arenas)) {
      const expected = a.querySelector('.expected-seq-value');
      if (expected) expected.textContent = '0';
      a.querySelectorAll('.cell-timer-progress').forEach(el => { el.style.width='0%'; el.className='cell-timer-progress'; });
      a.querySelector('.empty-state').classList.remove('hidden');
      a.querySelector('.arena-idle').textContent = 'CHANNEL READY / Awaiting transmission';
    }
    if (PanelView.resetTimelines) PanelView.resetTimelines();
    scheduleRefresh();
  }
  const counters = new Map();
  function count(el, target) {
    const existing = counters.get(el);
    if (existing && existing.target === target) return;
    if (existing) cancelAnimationFrame(existing.frame);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = target; return; }
    const start = performance.now();
    const from = parseFloat(el.textContent) || 0;
    const item = {target, frame:null};
    counters.set(el,item);
    const paint = now => {
      const progress = Math.min(1,(now-start)/400);
      el.textContent = Math.round(from+(target-from)*progress);
      if (progress < 1) item.frame = requestAnimationFrame(paint);
      else counters.delete(el);
    };
    item.frame = requestAnimationFrame(paint);
  }
  const PanelView = global.PanelView = { icon, button, clean, count, reset, refresh, arenas };
  PanelView.clearCounters = () => { counters.forEach(item => cancelAnimationFrame(item.frame)); counters.clear(); };
  PanelView.presentation = () => refresh();
  // Replaced with the canvas report painter in the result-sheet stage.
  PanelView.drawResult = () => {};
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-icon]').forEach(el => {
      const label = el.textContent;
      el.innerHTML = icon(el.dataset.icon) + '<span>' + label + '</span>';
    });
    for (const p of ['gbn','sr']) {
      const a = arenas[p] = document.getElementById('arena-' + p);
      E.EventBus.on(p + ':log', event => {
        const {message,type} = event;
        a.querySelector('.empty-state').classList.add('hidden');
        a.querySelector('.arena-idle').textContent = 'TRANSMISSION ACTIVE / Click a packet to inject loss';
        const sent = /(?:Sent|Resent) DATA\[(\d+)\]|Sent (?:duplicate )?(?:cumulative|individual) ACK\[(\d+)\]/.exec(message);
        if (sent) {
          const kind = sent[1] !== undefined ? 'data' : 'ack';
          const seq = sent[1] || sent[2];
          if (kind === 'data') lostSequences[p].delete(Number(seq));
          const nodes = a.querySelectorAll('.packet-el[data-kind="' + kind + '"][data-seq="' + seq + '"]');
          const el = nodes[nodes.length - 1];
          if (el) {
            el.dataset.launch = E.SimClock.simTime;
            el.tabIndex = 0;
            el.setAttribute('role','button');
            el.setAttribute('aria-label', kind.toUpperCase() + ' ' + seq + '. Activate to drop.');
            el.addEventListener('keydown', e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); el.click(); }
            });
          }
        }
        if (type === 'lost') {
          const match = /(DATA|ACK)\[(\d+)\]/.exec(message);
          if (match && match[1] === 'DATA') lostSequences[p].add(Number(match[2]));
          if (match) a.querySelectorAll('.packet-el[data-kind="' + match[1].toLowerCase() + '"][data-seq="' + match[2] + '"]').forEach(el => { el.dataset.lost = 'true'; el.tabIndex = -1; });
          const banner = a.querySelector('.arena-toast');
          banner.textContent = clean(message).replace(/^\[LOST\]\s*/, 'LST / ');
          banner.classList.remove('hidden');
        }
        scheduleRefresh();
      });
      // Legacy renderers supply text; sanitize only their text nodes, never SVG.
      const observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.target.closest && record.target.closest('.arena-toast')) {
            const el = record.target.closest('.arena-toast');
            const value = clean(el.textContent);
            if (value !== el.textContent) el.textContent = value;
          }
        }
        scheduleRefresh();
      });
      observer.observe(a.querySelector('.arena-toast'), {childList:true, characterData:true, subtree:true});
      const tags = {send:'SND',retx:'RTX',ack:'ACK',dupack:'DUP',lost:'LST',discard:'DSC',warn:'DSC',buffered:'BUF',deliver:'DLV',timeout:'TMO',success:'DLV',info:'SYS'};
      const log = a.querySelector('.arena-log');
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType !== 1 || !node.matches('.log-entry') || node.dataset.formatted) continue;
          node.dataset.formatted = 'true';
          const type = Object.keys(tags).find(t => node.classList.contains('log-'+t)) || 'info';
          const tag = document.createElement('span');
          tag.className = 'log-tag tag-'+tags[type].toLowerCase();
          tag.textContent = tags[type];
          node.insertBefore(tag,node.querySelector('.log-msg'));
          const msg = node.querySelector('.log-msg');
          msg.textContent = clean(msg.textContent).replace(/^\[[A-Z-]+\]\s*/, '');
          node.title = msg.textContent;
          const time = node.querySelector('.log-time');
          time.textContent = time.textContent.replace(/^t=/,'').replace(/s$/,'').padStart(5,'0');
        }
        while (log.children.length > 400) log.firstElementChild.remove();
        log.scrollTop = log.scrollHeight;
      }).observe(log,{childList:true});
    }
    E.SimClock.subscribe(scheduleRefresh);
    document.querySelectorAll('input[type="range"]').forEach(input => input.addEventListener('input',scheduleRefresh));
    document.getElementById('btn-presentation').addEventListener('click',scheduleRefresh);
    document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'p') scheduleRefresh(); });
    // Narration shares the reserved event strip; controls take one docked row.
    const narration = document.getElementById('demo-narration-text');
    const demoBar = document.getElementById('guided-narration-bar');
    const modes = document.querySelector('.modes');
    modes.querySelector('div').classList.add('mode-controls');
    modes.appendChild(demoBar);
    const syncDemo = () => {
      const active = !demoBar.classList.contains('hidden');
      modes.classList.toggle('demo-active',active);
      modes.querySelector('.micro').textContent = active ? 'GUIDED WALKTHROUGH' : 'MODE';
      for (const a of Object.values(arenas)) {
        a.querySelector('.event-strip').classList.toggle('demo-narration',active);
        const copy = a.querySelector('.demo-copy');
        copy.classList.toggle('hidden',!active);
        copy.textContent = narration.textContent;
      }
      document.getElementById('btn-guided-demo').setAttribute('aria-pressed',String(active));
    };
    new MutationObserver(syncDemo).observe(narration,{childList:true,subtree:true,characterData:true});
    new MutationObserver(syncDemo).observe(demoBar,{attributes:true,attributeFilter:['class']});
    refresh();
  });
})(window);

/* Space-time recording listens only to the existing protocol event bus.
   The text adapter is kept here because the protocols currently publish log events,
   not structured packet-lifecycle events. It never writes protocol state. */
(function (global) {
  'use strict';
  const V = global.PanelView, E = global.Engine;
  const history = V.history = {
    gbn:{flights:[],marks:[],end:0,done:false,follow:true,view:'lane'},
    sr:{flights:[],marks:[],end:0,done:false,follow:true,view:'lane'}
  };
  const color = name => getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim();
  function lastData(h,seq) { return h.flights.findLast(f => f.kind === 'data' && f.seq === seq && !f.lost); }
  function receive(p,{message,type}) {
    const h = history[p], now = E.SimClock.simTime;
    h.end = Math.max(h.end,now);
    let m = /(?:Sent|Resent) DATA\[(\d+)\]/.exec(message);
    if (m) {
      h.flights.push({kind:'data',seq:Number(m[1]),start:now,end:now+E.SimConfig.propagationDelay,retx:type==='retx',lost:false,arrived:false});
      return;
    }
    m = /Sent (?:duplicate )?(?:cumulative|individual) ACK\[(\d+)\]/.exec(message);
    if (m) {
      const seq = Number(m[1]);
      h.flights.push({kind:'ack',seq,start:now,end:now+E.SimConfig.ackDelay,lost:false,arrived:false});
      if (p === 'sr') {
        const data = lastData(h,seq);
        if (data && !data.arrived) { data.end = now; data.arrived = true; }
      }
      return;
    }
    if (type === 'lost') {
      m = /(DATA|ACK)\[(\d+)\]/.exec(message);
      if (!m) return;
      const kind = m[1].toLowerCase(), seq = Number(m[2]);
      const candidates = h.flights.filter(f => f.kind === kind && f.seq === seq && !f.lost && !f.arrived && f.end >= now);
      const f = kind === 'data' ? candidates[candidates.length-1] : candidates[0];
      if (f) { f.lost = true; f.lossTime = now; }
      return;
    }
    m = /Received (?:duplicate )?ACK\[(\d+)\]/.exec(message);
    if (m) {
      const f = h.flights.find(f => f.kind === 'ack' && f.seq === Number(m[1]) && !f.lost && !f.arrived);
      if (f) { f.end = now; f.arrived = true; }
      return;
    }
    m = /(?:Received|Delivered) DATA\[(\d+)\]/.exec(message);
    if (m) {
      const f = lastData(h,Number(m[1]));
      if (f && type !== 'deliver') { f.end = now; f.arrived = true; }
      const tag = {buffered:'BUF',discard:'DSC',warn:'DSC',deliver:'DLV',ack:'DLV',dupack:'DUP'}[type];
      if (tag) h.marks.push({time:now,side:'rx',tag,seq:Number(m[1])});
    }
    if (type === 'timeout') {
      const seq = /packet (\d+)/.exec(message);
      h.marks.push({time:now,side:'tx',tag:'TMO',seq:seq ? Number(seq[1]) : null});
    }
  }
  V.resetTimelines = () => {
    for (const p of ['gbn','sr']) {
      Object.assign(history[p],{flights:[],marks:[],end:0,done:false,follow:true});
      const scroll = document.getElementById('timeline-'+p);
      if (scroll) { scroll.scrollTop = 0; V.drawTimeline(p,true); }
    }
  };
  function arrow(ctx,x0,y0,x,y) {
    const angle = Math.atan2(y-y0,x-x0);
    ctx.beginPath(); ctx.moveTo(x,y);
    ctx.lineTo(x-5*Math.cos(angle-.5),y-5*Math.sin(angle-.5));
    ctx.moveTo(x,y); ctx.lineTo(x-5*Math.cos(angle+.5),y-5*Math.sin(angle+.5)); ctx.stroke();
  }
  function draw(p,canvas,width,now,scale=1) {
    const h = history[p];
    const seconds = Math.max(h.end,now,4);
    const pixelsPerSecond = Math.min(32,16000/Math.max(1,seconds));
    const height = Math.max(192,Math.ceil(seconds*pixelsPerSecond+80));
    canvas.width = Math.ceil(width*scale); canvas.height = Math.ceil(height*scale);
    canvas.style.width = width+'px'; canvas.style.height = height+'px';
    const ctx = canvas.getContext('2d'); ctx.scale(scale,scale);
    const left = 80, right = width-80, y = t => 48+t*pixelsPerSecond;
    ctx.fillStyle = color('base'); ctx.fillRect(0,0,width,height);
    ctx.font = '11px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = color('subtle'); ctx.fillText('SENDER',left-20,20); ctx.fillText('RECEIVER',right-36,20);
    ctx.fillStyle = color('muted'); ctx.fillText('t / s ↓',8,20);
    ctx.strokeStyle = color('line'); ctx.lineWidth = 1;
    const interval = Math.max(1,Math.ceil(seconds/500));
    for (let t=0;t<=seconds;t+=interval) {
      ctx.beginPath(); ctx.moveTo(left,y(t)); ctx.lineTo(right,y(t)); ctx.stroke();
      ctx.fillText(t.toFixed(0),8,y(t)+4);
    }
    ctx.strokeStyle = color('subtle');
    for (const x of [left,right]) { ctx.beginPath(); ctx.moveTo(x,32); ctx.lineTo(x,height-16); ctx.stroke(); }
    for (const f of h.flights) {
      const total = f.end-f.start || 1;
      const time = f.lost ? f.lossTime : Math.min(f.end,now);
      const progress = E.clamp((time-f.start)/total,0,1);
      const x0 = f.kind === 'data' ? left : right;
      const x1 = f.kind === 'data' ? right : left;
      const x = x0+(x1-x0)*progress;
      ctx.strokeStyle = color(f.retx ? 'retx' : f.kind === 'data' ? 'data' : 'ack');
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.moveTo(x0,y(f.start)); ctx.lineTo(x,y(time)); ctx.stroke();
      if (progress > .02) arrow(ctx,x0,y(f.start),x,y(time));
      ctx.fillStyle = ctx.strokeStyle;
      const label = (f.retx ? 'R' : f.kind === 'data' ? 'D' : 'A')+String(f.seq).padStart(2,'0');
      ctx.fillText(label,x0+(x-x0)*.5+(f.kind === 'data' ? -8 : 8),y(f.start)+(y(time)-y(f.start))*.5-4);
      if (f.lost) {
        ctx.strokeStyle = color('lost'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x-4,y(time)-4); ctx.lineTo(x+4,y(time)+4);
        ctx.moveTo(x-4,y(time)+4); ctx.lineTo(x+4,y(time)-4); ctx.stroke();
      }
    }
    const offsets = new Map();
    for (const m of h.marks) {
      const x = m.side === 'tx' ? left : right, yy=y(m.time);
      const key = m.side+Math.round(yy/8);
      const offset = offsets.get(key) || 0; offsets.set(key,offset+1);
      ctx.strokeStyle = color(m.tag === 'BUF' ? 'buffered' : m.tag === 'DSC' ? 'lost' : m.tag === 'TMO' ? 'retx' : 'ack');
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x-4,yy); ctx.lineTo(x+4,yy); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(m.tag+(m.seq === null ? '' : ' '+m.seq),m.side === 'tx' ? left+8 : right+8,yy+4+offset*12);
    }
    return height;
  }
  V.drawTimeline = (p,force=false) => {
    const scroll = document.getElementById('timeline-'+p);
    if (!scroll || (!force && scroll.classList.contains('hidden'))) return;
    const width = scroll.parentElement.clientWidth;
    if (width <= 0) return;
    const h = history[p];
    const now = h.done ? h.end : E.SimClock.simTime;
    // Canvas redraws are limited to 30 Hz; the recording itself is never sampled.
    const key = width+':'+Math.floor(now*30)+':'+h.flights.length+':'+h.marks.length;
    if (!force && h.paintKey === key) return;
    h.paintKey = key;
    const follow = h.follow && E.SimClock._running;
    draw(p,scroll.querySelector('canvas'),width,now,Math.min(2,devicePixelRatio||1));
    if (follow) scroll.scrollTop = scroll.scrollHeight;
  };
  function select(p,view) {
    const a = V.arenas[p], h = history[p];
    h.view = view;
    a.querySelectorAll('[data-view]').forEach(tab => {
      const selected = tab.dataset.view === view;
      tab.setAttribute('aria-selected',String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    document.getElementById('lane-'+p).classList.toggle('hidden',view !== 'lane');
    document.getElementById('timeline-'+p).classList.toggle('hidden',view !== 'timeline');
    a.querySelector('[data-export]').classList.toggle('hidden',view !== 'timeline');
    a.querySelector('.channel-caption').classList.toggle('hidden',view === 'timeline');
    if (view === 'timeline') V.drawTimeline(p,true);
  }
  V.presentation = active => {
    for (const p of ['gbn','sr']) {
      const h=history[p];
      if (active) { h.previousView=h.view; select(p,'lane'); }
      else select(p,h.previousView || 'lane');
    }
    V.refresh();
  };
  function exportCanvas(p) {
    const canvas=document.createElement('canvas'),h=history[p];
    draw(p,canvas,720,h.done ? h.end : E.SimClock.simTime,1);
    return canvas;
  }
  V.exportData = p => exportCanvas(p).toDataURL('image/png');
  V.downloadTimeline = p => {
    let canvas;
    if (p) canvas=exportCanvas(p);
    else {
      const g=exportCanvas('gbn'),s=exportCanvas('sr');
      canvas=document.createElement('canvas'); canvas.width=1472; canvas.height=Math.max(g.height,s.height)+64;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle=color('base'); ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.font='18px "JetBrains Mono", Consolas, monospace'; ctx.fillStyle=color('text');
      ctx.fillText('GBN / SPACE-TIME',16,32); ctx.fillText('SR / SPACE-TIME',752,32);
      ctx.drawImage(g,16,48); ctx.drawImage(s,752,48);
    }
    const link=document.createElement('a');
    link.href=canvas.toDataURL('image/png'); link.download=(p || 'gbn-sr')+'-timeline.png';
    document.body.appendChild(link); link.click(); link.remove();
  };
  document.addEventListener('DOMContentLoaded',() => {
    for (const p of ['gbn','sr']) {
      E.EventBus.on(p+':log',event => receive(p,event));
      E.EventBus.on(p+':done',data => { history[p].done=true; history[p].end=data.completionTime; V.drawTimeline(p,true); });
      const a=V.arenas[p];
      a.querySelectorAll('[data-view]').forEach(tab => {
        tab.tabIndex=tab.dataset.view === 'lane' ? 0 : -1;
        tab.addEventListener('click',() => select(p,tab.dataset.view));
        tab.addEventListener('keydown',e => {
          if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
          e.preventDefault();
          const view=['ArrowRight','End'].includes(e.key) ? 'timeline' : 'lane';
          select(p,view); a.querySelector('[data-view="'+view+'"]').focus();
        });
      });
      const scroll=document.getElementById('timeline-'+p);
      scroll.addEventListener('scroll',() => { history[p].follow=scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-24; });
      a.querySelector('[data-export]').addEventListener('click',() => V.downloadTimeline(p));
      new ResizeObserver(() => V.drawTimeline(p,true)).observe(a.querySelector('.channel-wrapper'));
    }
    document.getElementById('btn-download-timelines').addEventListener('click',() => V.downloadTimeline());
    document.fonts.ready.then(() => { for (const p of ['gbn','sr']) V.drawTimeline(p,true); });
  });
})(window);

/* Result sheet and keyboard-safe dialogs. */
(function(global) {
  'use strict';
  const V=global.PanelView;
  let report=null;
  function paintReport() {
    const canvas=document.getElementById('result-canvas');
    if (!report || canvas.closest('.hidden')) return;
    const width=canvas.parentElement.clientWidth, height=224, scale=Math.min(2,devicePixelRatio||1);
    canvas.width=width*scale; canvas.height=height*scale;
    canvas.style.width=width+'px'; canvas.style.height=height+'px';
    const ctx=canvas.getContext('2d'); ctx.scale(scale,scale);
    const style=getComputedStyle(document.documentElement);
    const c=n => style.getPropertyValue('--'+n).trim();
    ctx.fillStyle=c('panel'); ctx.fillRect(0,0,width,height);
    const [g,s]=report;
    const groups=[
      {title:'TRANSMISSIONS',gv:g.sent,sv:s.sent,unit:'',y:24},
      {title:'COMPLETION TIME / SIM SECONDS',gv:g.completionTime,sv:s.completionTime,unit:'s',y:136}
    ];
    for (const group of groups) {
      ctx.font='11px "JetBrains Mono", Consolas, monospace'; ctx.fillStyle=c('muted'); ctx.fillText(group.title,0,group.y);
      const max=Math.max(group.gv,group.sv,1), left=48, usable=Math.max(24,width-left-72);
      ctx.strokeStyle=c('line'); ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(left,group.y+12); ctx.lineTo(left,group.y+76); ctx.stroke();
      for (const [label,value,i] of [['GBN',group.gv,0],['SR',group.sv,1]]) {
        const yy=group.y+24+i*32;
        ctx.fillStyle=c('subtle'); ctx.font='12px "JetBrains Mono", Consolas, monospace'; ctx.fillText(label,0,yy+12);
        const bar=usable*value/max;
        ctx.fillStyle=c(i===0 ? 'subtle' : 'text'); ctx.fillRect(left,yy,bar,16);
        ctx.fillStyle=c('text'); ctx.fillText((group.unit ? Number(value).toFixed(1) : value)+group.unit,left+bar+8,yy+12);
      }
    }
  }
  V.drawResult=(g,s) => { report=[g,s]; requestAnimationFrame(paintReport); };
  document.addEventListener('DOMContentLoaded',() => {
    let current=null,previous=null;
    const wrapper=document.querySelector('.page-wrapper');
    const dialogs=[...document.querySelectorAll('.modal-backdrop')];
    const focusable=dialog => [...dialog.querySelectorAll('button,[href],input,select,textarea,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    function syncDialogs() {
      const open=dialogs.find(el => !el.classList.contains('hidden')) || null;
      wrapper.inert=!!open;
      if (open !== current) {
        if (open) {
          previous=document.activeElement; current=open;
          const targets=focusable(open); if (targets[0]) targets[0].focus();
          if (open.id === 'comparison-modal') paintReport();
        } else {
          current=null; if (previous && previous.isConnected) previous.focus(); previous=null;
        }
      }
    }
    const observer=new MutationObserver(syncDialogs);
    dialogs.forEach(dialog => observer.observe(dialog,{attributes:true,attributeFilter:['class']}));
    document.addEventListener('keydown',e => {
      if (!current || e.key !== 'Tab') return;
      const targets=focusable(current),first=targets[0],last=targets[targets.length-1];
      if (e.shiftKey && (document.activeElement===first || !current.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement===last || !current.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    });
    new ResizeObserver(paintReport).observe(document.querySelector('.result-chart'));
    document.fonts.ready.then(paintReport);
  });
})(window);
