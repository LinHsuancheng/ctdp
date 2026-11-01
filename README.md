# CTDP desktop

A Windows desktop tool for edmond's Chained Time-Delay Protocol: sacred seat, precedent rule, auxiliary (reservation) track, recursive chunks with virtual nodes.

## Model

- **Chain** = a sacred-seat trigger + a **main track** + an **auxiliary track**, each with its own precedents. One chain is the **primary**; when its main track is lost, any chain can take over.
- **Chunk** = a reusable template. A Unit (`#`) is one sitting with a minimum duration; higher levels (`##` Block … `#####` Week) are ordered lower-level chunks.
- Starting a chunk adds **virtual nodes** at every level. A unit may be kept after its minimum; a composite after enough parts are kept. Not keeping a node, leaving early, or a violation judged as a break loses the whole main track.
- The **auxiliary track** follows the original answer: signal, then sit within the window; a miss is judged by the precedent rule.

## Layout

```
src/shared/ctdp/   pure domain: types, reducer (mainTrack, auxiliary, library), tree helpers
src/main/          Electron main: engine (timer + state), store, windows, tray, shortcuts, notifier, smoke check
src/preload/       contextBridge API (window.ctdp)
src/renderer/      React UI: main window pages and the always-on-top mini window
tests/             vitest unit tests for the domain
```

## Commands

```
npm install          # Electron binary comes from the mirror in .npmrc
npm test             # domain unit tests
npm run typecheck
npm run smoke        # builds, then drives the real app headless under Xvfb
npm run dist:win     # release/CTDP-<version>-win.zip (unzip and run CTDP.exe)
```
