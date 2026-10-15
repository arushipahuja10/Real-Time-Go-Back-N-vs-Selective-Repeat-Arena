/**
 * main.js  –  Wiring, Live Scoreboard, Guided Demo & Presentation Layer
 * =====================================================================
 * Computer Networks  •  Module 3: Data Link Layer Sliding Window Protocols
 * Author: Arushi Pahuja (Roll No: 10)
 *
 * Responsibilities:
 *  1. Protocol lifecycle: init, play/pause, reset, slider bindings.
 *  2. Mirror Drops toggle: synchronized cross-arena loss.
 *  3. Live Comparison Scoreboard: side-by-side counters, SVG winner checks,
 *     dynamic one-line verdicts, and canvas comparison charts.
 *  4. Final Result Sheet: comprehensive metrics breakdown & "Run Again".
 *  5. Guided Auto-Demo Mode: deterministic 7-step narrated scenario with
 *     Pause / Next / Exit controls.
 *  6. Presentation Mode (Key: P), Web Audio sound effects (Key: S),
 *     theory explainer modal, shortcuts help overlay (Key: ?).
 *  7. In-browser self-tests: window.runTests() verification suite.
 */

(function (global) {
  'use strict';

  /* Shorthand */
  const E = () => global.Engine;

  /* =========================================================
   * STUDENT / PROJECT METADATA (editable placeholders)
   * ========================================================= */
  const STUDENT_INFO = {
    name: 'Arushi Pahuja',
    rollNo: '10',
    course: 'Computer Networks (Module 3)',
    topic: 'Sliding Window Protocols (GBN vs SR)',
  };

  /* =========================================================
   * APPLICATION STATE
   * ========================================================= */
  let isRunning = false;
  let gbnDone = false;
  let srDone = false;
  let resultTimerId = null;
  let resumeFrameId = null;

  let lastGbnStats = { sent: 0, retransmissions: 0, acks: 0, timeouts: 0, lost: 0, wasted: 0, efficiency: '0.0%', completionTime: null };
  let lastSrStats  = { sent: 0, retransmissions: 0, acks: 0, timeouts: 0, lost: 0, wasted: 0, efficiency: '0.0%', completionTime: null };

  /* Guided Demo State */
  let demoActive = false;
  let demoStep = 0;
  let demoPaused = false;
  let demoTimerId = null;
  let demoTimerRemaining = 0;
  let demoTimerDue = 0;

  /* =========================================================
   * DOM REFERENCES
   * ========================================================= */
  let dom = {};

  function grabDom() {
    dom = {
      // Main Controls
      playBtn:         document.getElementById('btn-play'),
      resetBtn:        document.getElementById('btn-reset'),
      windowSlider:    document.getElementById('slider-window'),
      windowVal:       document.getElementById('val-window'),
      speedSlider:     document.getElementById('slider-speed'),
      speedVal:        document.getElementById('val-speed'),
      timeoutSlider:   document.getElementById('slider-timeout'),
      timeoutVal:      document.getElementById('val-timeout'),
      totalSlider:     document.getElementById('slider-total'),
      totalVal:        document.getElementById('val-total'),
      mirrorToggle:    document.getElementById('toggle-mirror'),

      // Arenas
      gbnArena:        document.getElementById('arena-gbn'),
      srArena:         document.getElementById('arena-sr'),

      // Header Actions
      btnGuidedDemo:   document.getElementById('btn-guided-demo'),
      btnExplainer:    document.getElementById('btn-explainer'),
      btnPresentation: document.getElementById('btn-presentation'),
      btnSound:        document.getElementById('btn-sound'),
      btnShortcuts:    document.getElementById('btn-shortcuts'),

      // Guided Demo Bar
      demoBar:         document.getElementById('guided-narration-bar'),
      demoStepNum:     document.getElementById('demo-step-num'),
      demoText:        document.getElementById('demo-narration-text'),
      btnDemoPause:    document.getElementById('btn-demo-pause'),
      btnDemoNext:     document.getElementById('btn-demo-next'),
      btnDemoExit:     document.getElementById('btn-demo-exit'),

      // Live Scoreboard
      liveScoreboard:  document.getElementById('live-scoreboard'),
      verdictText:     document.getElementById('verdict-text'),

      scGbnSent:       document.getElementById('sc-gbn-sent'),
      scSrSent:        document.getElementById('sc-sr-sent'),
      crGbnSent:       document.getElementById('cr-gbn-sent'),
      crSrSent:        document.getElementById('cr-sr-sent'),
      diffSent:        document.getElementById('diff-sent'),

      scGbnRetx:       document.getElementById('sc-gbn-retx'),
      scSrRetx:        document.getElementById('sc-sr-retx'),
      crGbnRetx:       document.getElementById('cr-gbn-retx'),
      crSrRetx:        document.getElementById('cr-sr-retx'),
      diffRetx:        document.getElementById('diff-retx'),

      scGbnWasted:     document.getElementById('sc-gbn-wasted'),
      scSrWasted:      document.getElementById('sc-sr-wasted'),
      crGbnWasted:     document.getElementById('cr-gbn-wasted'),
      crSrWasted:      document.getElementById('cr-sr-wasted'),
      diffWasted:      document.getElementById('diff-wasted'),

      scGbnTime:       document.getElementById('sc-gbn-time'),
      scSrTime:        document.getElementById('sc-sr-time'),
      crGbnTime:       document.getElementById('cr-gbn-time'),
      crSrTime:        document.getElementById('cr-sr-time'),
      diffTime:        document.getElementById('diff-time'),

      scGbnEff:        document.getElementById('sc-gbn-eff'),
      scSrEff:         document.getElementById('sc-sr-eff'),
      crGbnEff:        document.getElementById('cr-gbn-eff'),
      crSrEff:         document.getElementById('cr-sr-eff'),
      diffEff:         document.getElementById('diff-eff'),

      scGbnLost:       document.getElementById('sc-gbn-lost'),
      scSrLost:        document.getElementById('sc-sr-lost'),
      crGbnLost:       document.getElementById('cr-gbn-lost'),
      crSrLost:        document.getElementById('cr-sr-lost'),
      diffLost:        document.getElementById('diff-lost'),

      // Modals
      compModal:       document.getElementById('comparison-modal'),
      compClose:       document.getElementById('modal-close'),
      compTbody:       document.getElementById('comp-tbody'),
      btnRunAgain:     document.getElementById('btn-run-again'),
      winnerHeading:   document.getElementById('winner-heading'),
      winnerSub:       document.getElementById('winner-sub'),

      explainerModal:  document.getElementById('explainer-modal'),
      explainerClose:  document.getElementById('explainer-close'),
      shortcutsModal:  document.getElementById('shortcuts-modal'),
      shortcutsClose:  document.getElementById('shortcuts-close'),

      // Self-test button & output
      btnRunTests:     document.getElementById('btn-run-tests'),
      selfTestOutput:  document.getElementById('self-test-output'),

      // Student footer placeholders
      studentName:     document.getElementById('student-name'),
      studentRoll:     document.getElementById('student-roll'),
      studentCourse:   document.getElementById('student-course'),
    };
  }

  /* =========================================================
   * INITIALIZE PROTOCOLS & STUDENT FOOTER
   * ========================================================= */
  function initProtocols() {
    if (!dom.gbnArena || !dom.srArena) {
      return;
    }
    global.GBN.init(dom.gbnArena);
    global.SR.init(dom.srArena);

    // Populate student footer info
    if (dom.studentName)   dom.studentName.textContent   = STUDENT_INFO.name;
    if (dom.studentRoll)   dom.studentRoll.textContent   = STUDENT_INFO.rollNo;
    if (dom.studentCourse) dom.studentCourse.textContent = STUDENT_INFO.course;
  }

  /* =========================================================
   * PLAY / PAUSE
   * ========================================================= */
  function togglePlay() {

    if (isRunning) {
      cancelAnimationFrame(resumeFrameId);
      E().SimClock.pause();
      isRunning = false;
      if (dom.playBtn) {
        global.PanelView.button(dom.playBtn, 'play', 'Play');
        dom.playBtn.classList.remove('btn-pause');
        dom.playBtn.classList.add('btn-play');
      }
      if (demoActive) {
        demoTimerRemaining = Math.max(0, demoTimerDue - performance.now());
        clearTimeout(demoTimerId);
        demoPaused = true;
        if (dom.btnDemoPause) global.PanelView.button(dom.btnDemoPause, 'play', 'Resume');
      }
    } else {
      global.GBN.start();
      global.SR.start();
      isRunning = true;
      // Let any previously queued clock frame observe pause before resuming.
      resumeFrameId = requestAnimationFrame(() => {
        if (isRunning) E().SimClock.start();
      });
      if (dom.playBtn) {
        global.PanelView.button(dom.playBtn, 'pause', 'Pause');
        dom.playBtn.classList.remove('btn-play');
        dom.playBtn.classList.add('btn-pause');
      }
      if (demoActive) {
        demoPaused = false;
        if (dom.btnDemoPause) global.PanelView.button(dom.btnDemoPause, 'pause', 'Pause');
        if (demoTimerRemaining > 0 && demoStep < DEMO_SCRIPT.length) scheduleDemoStep(demoTimerRemaining);
      }
    }
    dom.totalSlider.disabled = isRunning;
    global.PanelView.refresh();
  }

  /* =========================================================
   * RESET
   * ========================================================= */
  function resetAll() {
    exitGuidedDemo(false);
    clearTimeout(resultTimerId);
    cancelAnimationFrame(resumeFrameId);

    // Stop clock first
    E().SimClock.pause();
    E().SimClock.reset();
    isRunning = false;
    dom.totalSlider.disabled = false;
    gbnDone = false;
    srDone = false;

    lastGbnStats = { sent: 0, retransmissions: 0, acks: 0, timeouts: 0, lost: 0, wasted: 0, efficiency: '0.0%', completionTime: null };
    lastSrStats  = { sent: 0, retransmissions: 0, acks: 0, timeouts: 0, lost: 0, wasted: 0, efficiency: '0.0%', completionTime: null };

    // Reset both protocols
    global.GBN.reset();
    global.SR.reset();

    // Reset button label
    if (dom.playBtn) {
      global.PanelView.button(dom.playBtn, 'play', 'Play');
      dom.playBtn.classList.remove('btn-pause');
      dom.playBtn.classList.add('btn-play');
    }

    // Reset scoreboard
    resetScoreboard();

    // Hide comparison modal
    if (dom.compModal) dom.compModal.classList.add('hidden');
    if (global.PanelView) global.PanelView.reset();
  }

  /* =========================================================
   * SLIDER & TOGGLE WIRING
   * ========================================================= */
  function wireSliders() {
    const cfg = E().SimConfig;

    /* Window Size */
    dom.windowSlider.addEventListener('input', () => {
      const n = parseInt(dom.windowSlider.value, 10);
      cfg.windowSize = n;
      dom.windowVal.textContent = n;
      global.GBN.setWindowSize(n);
      global.SR.setWindowSize(n);
    });
    dom.windowVal.textContent = dom.windowSlider.value;

    /* Speed */
    dom.speedSlider.addEventListener('input', () => {
      const x = parseFloat(dom.speedSlider.value);
      cfg.speed = x;
      dom.speedVal.textContent = x.toFixed(1) + 'x';
      global.GBN.setSpeed(x);
      global.SR.setSpeed(x);
    });
    dom.speedVal.textContent = parseFloat(dom.speedSlider.value).toFixed(1) + 'x';

    /* Timeout */
    dom.timeoutSlider.addEventListener('input', () => {
      const t = parseFloat(dom.timeoutSlider.value);
      cfg.timeoutDuration = t;
      dom.timeoutVal.textContent = t.toFixed(1) + 's';
    });
    dom.timeoutVal.textContent = parseFloat(dom.timeoutSlider.value).toFixed(1) + 's';

    /* Total Packets */
    dom.totalSlider.addEventListener('input', () => {
      const n = parseInt(dom.totalSlider.value, 10);
      cfg.totalPackets = n;
      dom.totalVal.textContent = n;
      // Packet count defines the protocol fixture, so resize via a clean session.
      resetAll();
    });
    dom.totalVal.textContent = dom.totalSlider.value;

    /* Mirror Drops Toggle (Default: Checked) */
    cfg.mirrorDrops = dom.mirrorToggle ? dom.mirrorToggle.checked : true;
    if (dom.mirrorToggle) {
      dom.mirrorToggle.addEventListener('change', () => {
        cfg.mirrorDrops = dom.mirrorToggle.checked;
      });
    }
  }

  /* =========================================================
   * LIVE SCOREBOARD CONTROLLER
   * ========================================================= */
  function wireScoreboard() {
    E().EventBus.on('gbn:stat', (data) => {
      lastGbnStats = Object.assign({}, lastGbnStats, data);
      updateScoreboard();
    });

    E().EventBus.on('sr:stat', (data) => {
      lastSrStats = Object.assign({}, lastSrStats, data);
      updateScoreboard();
    });

    // Real-time completion time ticker during run
    E().SimClock.subscribe((simTime) => {
      if (!isRunning) return;
      if (!gbnDone && dom.scGbnTime) dom.scGbnTime.textContent = simTime.toFixed(1) + 's';
      if (!srDone  && dom.scSrTime)  dom.scSrTime.textContent  = simTime.toFixed(1) + 's';
    });
  }

  function resetScoreboard() {
    const defaultZeros = [
      dom.scGbnSent, dom.scSrSent,
      dom.scGbnRetx, dom.scSrRetx,
      dom.scGbnWasted, dom.scSrWasted,
      dom.scGbnLost, dom.scSrLost
    ];
    defaultZeros.forEach(el => { if (el) el.textContent = '0'; });

    if (dom.scGbnTime) dom.scGbnTime.textContent = '0.0s';
    if (dom.scSrTime)  dom.scSrTime.textContent  = '0.0s';
    if (dom.scGbnEff)  dom.scGbnEff.textContent  = '–';
    if (dom.scSrEff)   dom.scSrEff.textContent   = '–';

    const crowns = [
      dom.crGbnSent, dom.crSrSent,
      dom.crGbnRetx, dom.crSrRetx,
      dom.crGbnWasted, dom.crSrWasted,
      dom.crGbnTime, dom.crSrTime,
      dom.crGbnEff, dom.crSrEff,
      dom.crGbnLost, dom.crSrLost
    ];
    crowns.forEach(c => { if (c) c.classList.add('hidden'); });

    const diffs = [dom.diffSent, dom.diffRetx, dom.diffWasted, dom.diffTime, dom.diffEff, dom.diffLost];
    diffs.forEach(d => { if (d) d.textContent = '–'; });

    if (dom.verdictText) {
      dom.verdictText.textContent = 'Start a transmission, then introduce loss to compare recovery.';
    }
  }

  function updateScoreboard() {
    const g = lastGbnStats;
    const s = lastSrStats;

    // 1. Sent
    if (dom.scGbnSent) global.PanelView.count(dom.scGbnSent, g.sent);
    if (dom.scSrSent)  global.PanelView.count(dom.scSrSent, s.sent);
    _applyWinner(g.sent, s.sent, 'lower', dom.crGbnSent, dom.crSrSent, dom.diffSent, 'saved by');

    // 2. Retransmissions
    if (dom.scGbnRetx) global.PanelView.count(dom.scGbnRetx, g.retransmissions);
    if (dom.scSrRetx)  global.PanelView.count(dom.scSrRetx, s.retransmissions);
    _applyWinner(g.retransmissions, s.retransmissions, 'lower', dom.crGbnRetx, dom.crSrRetx, dom.diffRetx, 'fewer in');

    // 3. Wasted Bandwidth
    const gWaste = g.wasted || 0;
    const sWaste = s.wasted || 0;
    if (dom.scGbnWasted) global.PanelView.count(dom.scGbnWasted, gWaste);
    if (dom.scSrWasted)  global.PanelView.count(dom.scSrWasted, sWaste);
    _applyWinner(gWaste, sWaste, 'lower', dom.crGbnWasted, dom.crSrWasted, dom.diffWasted, 'wasted in');

    // 4. Completion Time
    if (g.completionTime !== null && dom.scGbnTime) dom.scGbnTime.textContent = g.completionTime.toFixed(1) + 's';
    if (s.completionTime !== null && dom.scSrTime)  dom.scSrTime.textContent  = s.completionTime.toFixed(1) + 's';
    if (gbnDone && srDone) {
      _applyWinner(g.completionTime, s.completionTime, 'lower', dom.crGbnTime, dom.crSrTime, dom.diffTime, 'faster in', 's');
    }

    // 5. Channel Efficiency
    const gEffNum = parseFloat(g.efficiency) || 0;
    const sEffNum = parseFloat(s.efficiency) || 0;
    if (dom.scGbnEff) dom.scGbnEff.textContent = g.efficiency || '–';
    if (dom.scSrEff)  dom.scSrEff.textContent  = s.efficiency || '–';
    if (g.sent > 0 || s.sent > 0) {
      _applyWinner(gEffNum, sEffNum, 'higher', dom.crGbnEff, dom.crSrEff, dom.diffEff, 'higher in', '%');
    }

    // 6. Lost Packets
    if (dom.scGbnLost) global.PanelView.count(dom.scGbnLost, g.lost);
    if (dom.scSrLost)  global.PanelView.count(dom.scSrLost, s.lost);
    if (g.lost === s.lost) {
      if (dom.diffLost) dom.diffLost.textContent = '0';
      if (dom.crGbnLost) dom.crGbnLost.classList.add('hidden');
      if (dom.crSrLost)  dom.crSrLost.classList.add('hidden');
    } else {
      _applyWinner(g.lost, s.lost, 'lower', dom.crGbnLost, dom.crSrLost, dom.diffLost, 'fewer lost in');
    }

    // Dynamic Live Verdict Line
    _updateLiveVerdict(g, s);
  }

  function _applyWinner(valGbn, valSr, mode, crownGbn, crownSr, diffEl, label = '', suffix = '') {
    if (valGbn === undefined || valSr === undefined) return;
    if (valGbn === null || valSr === null) return;

    if (crownGbn) crownGbn.classList.add('hidden');
    if (crownSr)  crownSr.classList.add('hidden');

    const diff = Math.abs(valGbn - valSr);

    if (diff === 0) {
      if (diffEl) diffEl.textContent = '0';
      return;
    }

    const gbnWins = (mode === 'lower' && valGbn < valSr) || (mode === 'higher' && valGbn > valSr);
    const srWins  = (mode === 'lower' && valSr < valGbn) || (mode === 'higher' && valSr > valGbn);

    if (gbnWins) {
      if (crownGbn) crownGbn.classList.remove('hidden');
      if (diffEl) diffEl.textContent = diff.toFixed(suffix ? 1 : 0) + suffix;
    } else if (srWins) {
      if (crownSr) crownSr.classList.remove('hidden');
      if (diffEl) diffEl.textContent = diff.toFixed(suffix ? 1 : 0) + suffix;
    }
  }

  function _updateLiveVerdict(g, s) {
    if (!dom.verdictText) return;

    const diffRetx = (g.retransmissions || 0) - (s.retransmissions || 0);
    const gWaste = g.wasted || 0;

    if (g.lost === 0 && s.lost === 0) {
      dom.verdictText.textContent = 'No loss injected. Click DATA or ACK to compare recovery costs.';
    } else if (diffRetx > 0) {
      const pctSaved = g.sent > 0 ? Math.round((diffRetx / g.sent) * 100) : 0;
      dom.verdictText.textContent = `Selective Repeat saved ${diffRetx} transmission(s) (-${pctSaved}% link overhead) vs. Go-Back-N.`;
    } else if (gWaste > 0) {
      dom.verdictText.textContent = `GBN discarded ${gWaste} out-of-order packets; SR buffered them in memory without wasting bandwidth.`;
    } else if (s.retransmissions === g.retransmissions && g.lost > 0) {
      dom.verdictText.textContent = `Packet loss registered. Go-Back-N resends entire window on timeout; SR resends only lost packet.`;
    }
  }

  /* =========================================================
   * PROTOCOL DONE EVENTS & FINAL RESULT MODAL
   * ========================================================= */
  function wireDoneEvents() {
    E().EventBus.on('gbn:done', (data) => {
      gbnDone = true;
      if (data && data.stats) lastGbnStats = Object.assign({}, lastGbnStats, data.stats, { completionTime: data.completionTime });
      _checkBothDone();
    });

    E().EventBus.on('sr:done', (data) => {
      srDone = true;
      if (data && data.stats) lastSrStats = Object.assign({}, lastSrStats, data.stats, { completionTime: data.completionTime });
      _checkBothDone();
    });
  }

  function _checkBothDone() {
    if (!gbnDone || !srDone) return;

    E().SimClock.pause();
    isRunning = false;
    dom.totalSlider.disabled = false;
    updateScoreboard();
    global.PanelView.refresh();
    clearTimeout(resultTimerId);
    resultTimerId = setTimeout(() => {
      if (!gbnDone || !srDone) return;
      _showFinalResultModal();
      isRunning = false;
      global.PanelView.button(dom.playBtn, 'play', 'Play');
      dom.playBtn.classList.remove('btn-pause');
      dom.playBtn.classList.add('btn-play');
    }, 700);
  }

  function _showFinalResultModal() {
    if (!dom.compModal) return;

    const g = lastGbnStats;
    const s = lastSrStats;
    const total = E().SimConfig.totalPackets;

    // 1. Determine Overall Winner
    const gTx = g.sent || 0;
    const sTx = s.sent || 0;
    const savedTx = gTx - sTx;

    if (savedTx > 0) {
      if (dom.winnerHeading) dom.winnerHeading.textContent = 'Selective Repeat leads';
      if (dom.winnerSub) {
        dom.winnerSub.textContent = `SR saved ${savedTx} transmission(s) and avoided discarding out-of-order packets through receiver buffering.`;
      }
    } else if (g.lost === 0 && s.lost === 0) {
      if (dom.winnerHeading) dom.winnerHeading.textContent = 'Tied Performance (Lossless Channel)';
      if (dom.winnerSub) {
        dom.winnerSub.textContent = `Under ideal zero-loss conditions, both sliding-window protocols transmit with identical 100% efficiency.`;
      }
    } else {
      if (dom.winnerHeading) dom.winnerHeading.textContent = 'Transfer Completed!';
      if (dom.winnerSub) {
        dom.winnerSub.textContent = `Both protocols successfully recovered from simulated packet drops.`;
      }
    }

    // Winner per metric; the view draws the direct-labelled canvas chart.
    const metrics = [
      ['Transmissions', gTx, sTx, 'lower', ''],
      ['Retransmissions', g.retransmissions || 0, s.retransmissions || 0, 'lower', ''],
      ['Discarded / redundant', g.wasted || 0, s.wasted || 0, 'lower', ''],
      ['Completion time', g.completionTime, s.completionTime, 'lower', 's'],
      ['Channel efficiency', parseFloat(g.efficiency) || 0, parseFloat(s.efficiency) || 0, 'higher', '%'],
      ['Injected loss', g.lost || 0, s.lost || 0, 'lower', '']
    ];
    const format = (n, unit) => (unit ? Number(n).toFixed(1) : n) + unit;
    if (dom.compTbody) {
      dom.compTbody.innerHTML = metrics.map(([label, gv, sv, mode, unit]) => {
        const winner = gv === sv ? 'Equal' : ((mode === 'lower' ? gv < sv : gv > sv) ? 'GBN' : 'SR');
        return '<tr><td>' + label + '</td><td>' + format(gv, unit) + '</td><td>' + format(sv, unit) + '</td><td class="comp-adv">' + winner + (winner === 'Equal' ? '' : ' / ' + format(Math.abs(gv-sv), unit)) + '</td></tr>';
      }).join('');
    }
    global.PanelView.drawResult(g, s);
    dom.compModal.classList.remove('hidden');
  }

  /* =========================================================
   * GUIDED AUTO-DEMO MODE CONTROLLER
   * Scripted, narrated, deterministic 7-step scenario
   * ========================================================= */
  const DEMO_SCRIPT = [
    {
      stepNum: 1,
      title: 'Step 1 / 7: Initial Window Transmission',
      narration: 'Initial transmission / W=4. Both senders fill the link with DATA 0–3, using the same injection spacing and propagation delay.',
      action: () => {
        // Setup initial demo state
        E().SimConfig.windowSize = 4;
        dom.windowSlider.value = 4;
        dom.windowVal.textContent = '4';
        global.GBN.setWindowSize(4);
        global.SR.setWindowSize(4);

        E().SimConfig.totalPackets = 12;
        dom.totalSlider.value = 12;
        dom.totalVal.textContent = '12';

        E().SimConfig.mirrorDrops = true;
        if (dom.mirrorToggle) dom.mirrorToggle.checked = true;

        E().SimConfig.speed = 1.0;
        dom.speedSlider.value = 1.0;
        dom.speedVal.textContent = '1.0x';
        global.GBN.setSpeed(1.0);
        global.SR.setSpeed(1.0);

        E().SimConfig.timeoutDuration = 3.0;
        dom.timeoutSlider.value = 3.0;
        dom.timeoutVal.textContent = '3.0s';

        // Play
        if (!isRunning) togglePlay();
      },
      nextDelay: 1200
    },
    {
      stepNum: 2,
      title: 'Step 2 / 7: Loss In Flight (Mirrored)',
      narration: 'Packet DATA[1] is lost in flight! Because Mirror Drops is ON, the exact same loss strikes both Go-Back-N and Selective Repeat.',
      action: () => {
        // Drop DATA packet 1 (mirrored across both arenas)
        global.GBN.dropPacket(1, 'data');
      },
      nextDelay: 1600
    },
    {
      stepNum: 3,
      title: 'Step 3 / 7: Receiver Handling of Out-of-Order Packets',
      narration: 'Key Difference: Packets 2 & 3 reach the receivers! GBN discards them because it only accepts in-order packets. SR saves them in its receive buffer!',
      action: () => {
        // Observers watch discard alert in GBN and buffer slots in SR
      },
      nextDelay: 1800
    },
    {
      stepNum: 4,
      title: 'Step 4 / 7: Timeout & Retransmission Recovery',
      narration: 'SR’s packet-1 timer expires first. GBN’s base timer later triggers recovery of every outstanding packet; SR resends only packet 1.',
      action: () => {
        // Observers watch timeout toast and selective retransmit
      },
      nextDelay: 3200
    },
    {
      stepNum: 5,
      title: 'Step 5 / 7: Second Loss Event (Packet 6)',
      narration: 'Dropping DATA[6]! Watch how GBN will once again discard intact future packets, while SR buffers them and preserves bandwidth.',
      action: () => {
        global.GBN.scheduleDrop(6);
        global.SR.scheduleDrop(6);
      },
      nextDelay: 3500
    },
    {
      stepNum: 6,
      title: 'Step 6 / 7: ACK Loss Resilience',
      narration: 'Dropping an ACK in flight! In Go-Back-N, cumulative ACKs make lost ACKs harmless if a subsequent ACK arrives safely before timeout.',
      action: () => {
        // Drop in-flight ACK if available
        global.GBN.dropPacket(undefined, 'ack');
      },
      nextDelay: 4000
    },
    {
      stepNum: 7,
      title: 'Step 7 / 7: Demo Complete & Verdict',
      narration: 'Read the final report: receiver buffering reduces retransmission work under these DATA losses. Compare the final metrics.',
      action: () => {
        // Allow transfers to finish naturally and present final scoreboard
      },
      nextDelay: 0
    }
  ];

  function startGuidedDemo() {
    // Configure the fixture before resetting per-packet records.
    Object.assign(E().SimConfig, {windowSize:4,totalPackets:12,speed:1,timeoutDuration:3,mirrorDrops:true});
    resetAll();

    demoActive = true;
    demoStep = 0;
    demoPaused = false;

    if (dom.demoBar) dom.demoBar.classList.remove('hidden');
    if (dom.btnDemoPause) global.PanelView.button(dom.btnDemoPause, 'pause', 'Pause');

    advanceDemoStep();
  }

  function advanceDemoStep() {
    if (!demoActive || demoStep >= DEMO_SCRIPT.length) return;

    clearTimeout(demoTimerId);
    demoTimerRemaining = 0;
    const step = DEMO_SCRIPT[demoStep];

    if (dom.demoStepNum) dom.demoStepNum.textContent = `Step ${step.stepNum} / ${DEMO_SCRIPT.length}`;
    if (dom.demoText)    dom.demoText.textContent    = step.narration;

    try {
      step.action();
    } catch (e) {
      console.error('Demo step error:', e);
    }

    demoStep++;

    if (step.nextDelay > 0 && demoStep < DEMO_SCRIPT.length) {
      scheduleDemoStep(step.nextDelay);
    }
  }

  function scheduleDemoStep(delay) {
    clearTimeout(demoTimerId);
    demoTimerRemaining = delay;
    demoTimerDue = performance.now() + delay;
    if (demoPaused) return;
    demoTimerId = setTimeout(() => {
      if (demoActive && !demoPaused) advanceDemoStep();
    }, delay);
  }

  function pauseGuidedDemo() {
    if (!demoActive) return;
    togglePlay();
  }

  function exitGuidedDemo(keepRunning = true) {
    if (!demoActive) return;

    demoActive = false;
    clearTimeout(demoTimerId);
    demoTimerRemaining = 0;
    if (dom.demoBar) dom.demoBar.classList.add('hidden');

    if (!keepRunning && isRunning) {
      togglePlay();
    }
  }

  /* =========================================================
   * PRESENTATION MODE & SOUND TOGGLE
   * ========================================================= */
  function togglePresentationMode() {
    const isPresenting = document.body.classList.toggle('presentation-mode');
    if (dom.btnPresentation) {
      dom.btnPresentation.classList.toggle('active', isPresenting);
      dom.btnPresentation.setAttribute('aria-pressed', String(isPresenting));
      global.PanelView.presentation(isPresenting);
    }
  }

  function toggleSound() {
    const enabled = E().Sound ? E().Sound.toggle() : false;
    if (dom.btnSound) {
      global.PanelView.button(dom.btnSound, 'sound', enabled ? 'Sound on' : 'Sound');
      dom.btnSound.setAttribute('aria-pressed', String(enabled));
      dom.btnSound.classList.toggle('active', enabled);
    }
  }

  /* =========================================================
   * MODALS & SHORTCUTS HELP
   * ========================================================= */
  function wireModals() {
    // Explainer Modal
    if (dom.btnExplainer && dom.explainerModal) {
      dom.btnExplainer.addEventListener('click', () => {
        dom.explainerModal.classList.remove('hidden');
      });
    }
    if (dom.explainerClose && dom.explainerModal) {
      dom.explainerClose.addEventListener('click', () => {
        dom.explainerModal.classList.add('hidden');
      });
    }

    // Shortcuts Modal
    if (dom.btnShortcuts && dom.shortcutsModal) {
      dom.btnShortcuts.addEventListener('click', () => {
        dom.shortcutsModal.classList.remove('hidden');
      });
    }
    if (dom.shortcutsClose && dom.shortcutsModal) {
      dom.shortcutsClose.addEventListener('click', () => {
        dom.shortcutsModal.classList.add('hidden');
      });
    }

    // Final Result Sheet Close & Run Again
    if (dom.compClose && dom.compModal) {
      dom.compClose.addEventListener('click', () => {
        dom.compModal.classList.add('hidden');
      });
    }
    if (dom.btnRunAgain) {
      dom.btnRunAgain.addEventListener('click', () => {
        resetAll();
        togglePlay();
      });
    }

    // Close on backdrop click
    [dom.compModal, dom.explainerModal, dom.shortcutsModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.add('hidden');
        });
      }
    });


  }

  /* =========================================================
   * KEYBOARD SHORTCUTS
   * Space: Play/Pause | R: Reset | D: Demo | M: Mirror |
   * P: Presentation | S: Sound | ?: Shortcuts | Esc: Close
   * ========================================================= */
  function wireKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing inside input fields (if any exist)
      if (e.target && (e.target.tagName === 'INPUT' && e.target.type === 'text')) return;
      if (document.querySelector('.modal-backdrop:not(.hidden)') && e.key !== 'Escape') return;
      if (e.key === ' ' && e.target.matches('button,input,a')) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;

        case 'r':
        case 'R':
          e.preventDefault();
          resetAll();
          break;

        case 'd':
        case 'D':
          e.preventDefault();
          if (demoActive) exitGuidedDemo();
          else startGuidedDemo();
          break;

        case 'm':
        case 'M':
          if (dom.mirrorToggle) {
            dom.mirrorToggle.checked = !dom.mirrorToggle.checked;
            E().SimConfig.mirrorDrops = dom.mirrorToggle.checked;
          }
          break;

        case 'p':
        case 'P':
          e.preventDefault();
          togglePresentationMode();
          break;

        case 's':
        case 'S':
          e.preventDefault();
          toggleSound();
          break;

        case '?':
          if (dom.shortcutsModal) {
            dom.shortcutsModal.classList.toggle('hidden');
          }
          break;

        case 'Escape':
          if (dom.compModal && !dom.compModal.classList.contains('hidden')) {
            dom.compModal.classList.add('hidden');
          } else if (dom.explainerModal && !dom.explainerModal.classList.contains('hidden')) {
            dom.explainerModal.classList.add('hidden');
          } else if (dom.shortcutsModal && !dom.shortcutsModal.classList.contains('hidden')) {
            dom.shortcutsModal.classList.add('hidden');
          } else if (demoActive) {
            exitGuidedDemo();
          }
          break;
      }
    });
  }

  /* =========================================================
   * BUTTON WIRING
   * ========================================================= */
  function wireButtons() {
    dom.playBtn.addEventListener('click', togglePlay);
    dom.resetBtn.addEventListener('click', resetAll);

    if (dom.btnGuidedDemo) dom.btnGuidedDemo.addEventListener('click', startGuidedDemo);
    if (dom.btnPresentation) dom.btnPresentation.addEventListener('click', togglePresentationMode);
    if (dom.btnSound) dom.btnSound.addEventListener('click', toggleSound);

    // Guided Demo Bar Controls
    if (dom.btnDemoPause) dom.btnDemoPause.addEventListener('click', pauseGuidedDemo);
    if (dom.btnDemoNext)  dom.btnDemoNext.addEventListener('click', advanceDemoStep);
    if (dom.btnDemoExit)  dom.btnDemoExit.addEventListener('click', () => exitGuidedDemo(true));

    // Self Test Button in Shortcuts Modal
    if (dom.btnRunTests) {
      dom.btnRunTests.addEventListener('click', () => {
        const results = runTests();
        if (dom.selfTestOutput) {
          dom.selfTestOutput.classList.remove('hidden');
          dom.selfTestOutput.innerHTML = results.map(r => `
            <div class="test-row ${r.pass ? 'pass' : 'fail'}">
              <span>${r.pass ? ' PASS' : ' FAIL'}: ${r.name}</span>
              <span class="test-meta">${r.detail}</span>
            </div>
          `).join('');
        }
      });
    }
  }

  /* =========================================================
   * IN-BROWSER LIGHTWEIGHT SELF-TESTS (window.runTests)
   * Deterministic headless verification of GBN and SR logic.
   * ========================================================= */
  function runTests() {
    console.log('%c Running CN Arena Protocol Verification Tests...', 'color:#4f9cf9;font-weight:bold;font-size:14px');

    const results = [];

    // Helper to mock a headless container fixture
    function createMockArena(id) {
      const arena = document.createElement('div');
      arena.id = id;
      arena.innerHTML = `
        <div class="sender-box"><div class="sender-window"></div><div id="${id}-timer-fill"></div></div>
        <div class="channel" style="width:800px"><div class="channel-edge left"></div><div class="channel-edge right"></div></div>
        <div class="receiver-box">
          <span class="expected-seq-value">0</span>
          <div class="buffer-array"></div>
          <div class="delivered-strip"></div>
          <div class="discard-alert hidden"></div>
        </div>
        <div class="arena-log"></div>
        <div class="arena-toast hidden"></div>
        <div class="done-overlay hidden"></div>
      `;
      return arena;
    }

    // Save previous user configuration
    const savedCfg = Object.assign({}, E().SimConfig);
    const wasRunning = isRunning;
    if (isRunning) togglePlay();

    try {
      /* ──────────────────────────────────────────────────────────
       * TEST 1: Drop seq 1 under Window = 4, Total = 4
       * Expected: GBN resends 3 packets (window [1..3]); SR resends 1 packet (seq 1).
       * ────────────────────────────────────────────────────────── */
      E().SimConfig.windowSize = 4;
      E().SimConfig.totalPackets = 4;
      E().SimConfig.speed = 1.0;
      E().SimConfig.timeoutDuration = 3.0;
      E().SimConfig.mirrorDrops = false;

      // 1A. GBN Test
      const gbnMock = createMockArena('arena-gbn-mock');
      global.GBN.init(gbnMock);
      let gbnRetx = 0;
      let gbnWasted = 0;
      const offGbn = E().EventBus.on('gbn:stat', s => {
        gbnRetx = s.retransmissions;
        gbnWasted = s.wasted || 0;
      });
      global.GBN.start();

      let gbnDropped = false;
      for (let f = 0; f < 300; f++) {
        const simTime = f * 0.03;
        E().SimClock.simTime = simTime;
        E().SimClock._subscribers.forEach(fn => fn(simTime, 0.03));
        if (!gbnDropped && simTime >= 0.5) {
          global.GBN.dropPacket(1, 'data');
          gbnDropped = true;
        }
      }
      offGbn();
      global.GBN.reset();

      // 1B. SR Test
      const srMock = createMockArena('arena-sr-mock');
      global.SR.init(srMock);
      let srRetx = 0;
      let srWasted = 0;
      const offSr = E().EventBus.on('sr:stat', s => {
        srRetx = s.retransmissions;
        srWasted = s.wasted || 0;
      });
      global.SR.start();

      let srDropped = false;
      for (let f = 0; f < 300; f++) {
        const simTime = f * 0.03;
        E().SimClock.simTime = simTime;
        E().SimClock._subscribers.forEach(fn => fn(simTime, 0.03));
        if (!srDropped && simTime >= 0.5) {
          global.SR.dropPacket(1, 'data');
          srDropped = true;
        }
      }
      offSr();
      global.SR.reset();

      const test1Pass = (gbnRetx === 3 && srRetx === 1);
      results.push({
        name: 'Drop Seq 1 Recovery Scope (W=4)',
        pass: test1Pass,
        detail: `GBN resent ${gbnRetx} pkts (expected 3); SR resent ${srRetx} pkt (expected 1).`
      });

      /* ──────────────────────────────────────────────────────────
       * TEST 2: GBN Out-of-Order Discard vs SR Buffer Retention
       * ────────────────────────────────────────────────────────── */
      const test2Pass = (gbnWasted >= 2 && srWasted === 0);
      results.push({
        name: 'Wasted Bandwidth & Receiver Buffering',
        pass: test2Pass,
        detail: `GBN discarded ${gbnWasted} out-of-order packets; SR buffered intact arrivals (0 wasted).`
      });

      /* ──────────────────────────────────────────────────────────
       * TEST 3: Cumulative ACK Tolerance in GBN
       * Dropping ACK 0 while ACK 1 succeeds must advance base without timeout
       * ────────────────────────────────────────────────────────── */
      E().SimConfig.timeoutDuration = 4.5;
      global.GBN.init(gbnMock);
      global.GBN.start();
      let gbnTimeouts = 0;
      const offGbnAck = E().EventBus.on('gbn:stat', s => { gbnTimeouts = s.timeouts; });

      let droppedAck0 = false;
      for (let f = 0; f < 130; f++) {
        const simTime = f * 0.03;
        E().SimClock.simTime = simTime;
        E().SimClock._subscribers.forEach(fn => fn(simTime, 0.03));
        if (!droppedAck0 && simTime >= 2.1 && simTime <= 2.8) {
          global.GBN.dropPacket(0, 'ack');
          droppedAck0 = true;
        }
      }
      offGbnAck();
      global.GBN.reset();

      const test3Pass = (gbnTimeouts === 0 && droppedAck0);
      results.push({
        name: 'GBN Cumulative ACK Resilience',
        pass: test3Pass,
        detail: `Dropped ACK[0] safely superseded by cumulative ACK[1] (0 timeouts incurred).`
      });

    } catch (err) {
      results.push({
        name: 'Test Execution Exception',
        pass: false,
        detail: err.message
      });
      console.error(err);
    } finally {
      // Restore user state
      Object.assign(E().SimConfig, savedCfg);
      initProtocols();
      resetAll();
      if (wasRunning) togglePlay();
    }

    // Print summary to console
    results.forEach(r => {
      const color = r.pass ? 'color:#10b981;font-weight:bold' : 'color:#ef4444;font-weight:bold';
      console.log(`%c[${r.pass ? 'PASS' : 'FAIL'}] ${r.name} — ${r.detail}`, color);
    });

    return results;
  }

  // Expose runTests onto window for browser console access
  global.runTests = runTests;

  /* =========================================================
   * BOOTSTRAP ON DOM READY
   * ========================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    grabDom();
    initProtocols();
    wireSliders();
    wireScoreboard();
    wireDoneEvents();
    wireModals();
    wireButtons();
    wireKeyboardShortcuts();

    console.log('%c CN Arena (Instrument Panel) Ready. Press Space to play, D for Guided Demo.', 'color:#4f9cf9;font-weight:bold;font-size:14px');
  });

})(window);
