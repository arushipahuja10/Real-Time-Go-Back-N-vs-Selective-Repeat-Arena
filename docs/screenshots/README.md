# Phase 5 visual QA

The browser runner refreshes idle, mid-loss, final-result and timeline PNGs at
1366×768 and 1920×1080. It also captures guided-paused and presentation states.
Exports contain the whole ladder diagram, including offscreen history.

- `qa-report.json`: full interaction matrix and runtime error report.
- `qa-captures.json`: most recent focused viewport/export refresh.
- `qa-audit.json`: text contrast, native packet motion, fonts and offline tests.
- `export-gbn-*.png`: single protocol timeline exports.
- `export-both-*.png`: combined timeline exports from the result sheet.

Future video placeholder: `guided-demo.webm`.
