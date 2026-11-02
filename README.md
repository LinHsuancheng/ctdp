# CTDP desktop

A Windows desktop tool for edmond's Chained Time-Delay Protocol: sacred seat, precedent rule, auxiliary (reservation) track, recursive chunks with virtual nodes.

## Model

- **Chain** = a sacred-seat trigger + a **main track** + an **auxiliary track**, each with its own precedents. One chain is the **primary**; when its main track is lost, any chain can take over.
- **Chunk** = a reusable template. A Unit (`#`) is one sitting with a minimum duration; higher levels (`##` Block … `#####` Week) are ordered lower-level chunks.
- Starting a chunk adds **virtual nodes** at every level. A unit may be kept after its minimum; a composite after enough parts are kept. Not keeping a node, leaving early, or a violation judged as a break loses the whole main track.
- The **auxiliary track** follows the original answer: signal, then sit within the window; a miss is judged by the precedent rule.

## Data

Shared data lives in `ctdp-state.json` in Electron's userData folder. It holds a snapshot plus the **action log**: every action that changed something, with its device and time. The state shown is always the replay of that log, which is what lets several devices share one history (see `src/shared/ctdp/log.ts`). Next to it, `ctdp-device.json` holds this device's id and preferences (shortcuts, mini window, quick-start chunk, notifications); it is never shared.

| OS | Path |
|----|------|
| Windows | `%APPDATA%\CTDP\ctdp-state.json` (e.g. `C:\Users\<you>\AppData\Roaming\CTDP\`) |
| Linux (dev) | `~/.config/CTDP/ctdp-state.json` |

Settings → Data shows the exact path and offers **Show in folder**, **Export…** and **Import…**. Import checks the file, asks for confirmation, and saves the current data as `ctdp-state.json.before-import-<time>` first. An unreadable data file is moved aside as `ctdp-state.json.corrupt-<time>` instead of being overwritten.

To move to another computer: export on the old one and import on the new one, or quit CTDP (tray → Quit) and copy `ctdp-state.json` into the same folder on the new computer. Do not copy `ctdp-device.json`: two devices with the same id would collide once syncing exists. A version-2 file from before the action log is upgraded on start (kept as `ctdp-state.json.v2-backup`), and its settings move to the device file.

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
