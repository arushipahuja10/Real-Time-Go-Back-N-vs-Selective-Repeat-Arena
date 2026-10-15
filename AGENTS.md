# Project instructions

## Stack and execution
Vanilla HTML, CSS and JavaScript, global browser modules. No framework, build step,
or runtime package dependencies. Double-click `index.html` to run, including via
`file://`. The two requested Google Fonts are bundled in `assets/fonts` under
the OFL; no network connection is needed for the intended typography. Keep their
licenses and the Arial/Consolas fallbacks when updating assets.

## File roles
- `index.html`: instrument-panel layout, arenas, controls, dialogs and canvas hosts.
- `styles.css`: design tokens, responsive layout, packet states and reduced motion.
- `engine.js`: EventBus, SimConfig, SimClock, Packet, shared helpers and Web Audio.
- `gbn.js`: Go-Back-N state, cumulative ACKs, base timer, packet rendering.
- `sr.js`: Selective Repeat state, individual ACKs, per-packet timers and buffering.
- `main.js`: controls, shortcuts, guided demo, scoreboard, results and `runTests()`.
- `view.js`: presentation adapter, terminal formatting, linear packet rendering,
  event-driven space-time canvases, exports and accessible dialog behavior.
- `tests/qa.cjs`: optional Playwright development QA; not needed to run the app.
- `tests/audit.cjs`: font loading, banned-style, contrast, native-motion and offline QA.

## HARD RULE
Do not change protocol logic or simulation/timer code in `gbn.js`, `sr.js`, or
the simulation parts of `engine.js`. Change only presentation: HTML structure,
CSS, rendering/animation code, plus new view code. `runTests()` must still pass.
All shortcuts, guided demo, mirror drops and click-to-drop must keep working.
Any necessary logic hook must be additive and documented explicitly.

## Design contract
Flat network operations instrument panel. Instrument Sans UI and JetBrains Mono
numbers. No gradients, glass blur, resting glows, emoji icons, large radii, centered
hero, or panel entrance animations. Semantic colors distinguish DATA, ACK, loss,
retransmission and buffered state; protocol identities remain grayscale.

## Tests
Open `index.html`, run `runTests()` in the console, or press `?` and choose
Run Protocol Verification. All three results must pass. The runner resets the
interactive session. Run it after each presentation stage.

Optional browser QA: `node tests/qa.cjs`; requires Playwright installed locally or
`NODE_PATH` pointing at its package directory. `BROWSER_PATH` can select Chrome
or Edge. Screenshots and the QA report go to `docs/screenshots/`.
Set `QA_FULL=1` for the full interaction/resolution matrix. The default run is
the three protocol self-tests plus the idle layout check.
Check 1366×768 and 1920×1080, DATA and ACK loss, mirror on/off, guided demo,
window 1–7, speed 0.5×/2×, pause/resume, reset, presentation and PNG export.
Do not run git commands for this task.
