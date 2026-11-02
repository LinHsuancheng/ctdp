# CTDP desktop

A Windows desktop tool for edmond's Chained Time-Delay Protocol: sacred seat, precedent rule, auxiliary (reservation) track, recursive chunks with virtual nodes.

## Model

- **Chain** = a sacred-seat trigger + a **main track** + an **auxiliary track**, each with its own precedents. One chain is the **primary**; when its main track is lost, any chain can take over.
- **Chunk** = a reusable template. A Unit (`#`) is one sitting with a minimum duration; higher levels (`##` Block … `#####` Week) are ordered lower-level chunks.
- Starting a chunk adds **virtual nodes** at every level. A unit may be kept after its minimum; a composite after enough parts are kept. Not keeping a node, leaving early, or a violation judged as a break loses the whole main track.
- The **auxiliary track** follows the original answer: signal, then sit within the window; a miss is judged by the precedent rule.

## Daily use

The app lives in the tray and stays out of the way:

- **Shift+Alt+Z** (recordable in Settings) brings the window up; pressing it again while the window is in front puts it away.
- The window shows the chain's length and two buttons: **Reserve** and **Action**. Everything else (chain, chunk, minutes, task) is folded into **Options**; Action repeats the last sitting's settings on the primary chain.
- Either button first dims the window and shows the one requirement (the reserve signal, or the sacred seat); **Done** starts the countdown or the sitting.
- While reserved or seated the window steps aside for a **corner card** with the time and the next step (Action, Finish).
- **Finish** opens the signature: the chain's precedents are listed, then *Nothing else — sign*, *Something to allow forever…* (recorded as a precedent, then signed), or *It was a violation* (breaks the chain, no reason asked).
- Anything that breaks a chain needs a 2-second hold and then a confirmation dialog.
- **More** holds Chains, Chunks, Precedents, History and Settings. On Chunks, **Add with JSON** takes categories and chunks as JSON (for example written by an agent), previews every change, and applies it; chains cannot be changed that way. **Copy current as JSON** exports the library in the same format.

## Data

Shared data lives in `ctdp-state.json` in Electron's userData folder. It holds a snapshot plus the **action log**: every action that changed something, with its device and time. The state shown is always the replay of that log, which is what lets several devices share one history (see `src/shared/ctdp/log.ts`). Next to it, `ctdp-device.json` holds this device's id and preferences (summon shortcut, corner card, the last sitting's settings, notifications); it is never shared.

| OS | Path |
|----|------|
| Windows | `%APPDATA%\CTDP\ctdp-state.json` (e.g. `C:\Users\<you>\AppData\Roaming\CTDP\`) |
| Linux (dev) | `~/.config/CTDP/ctdp-state.json` |

Settings → Data shows the exact path and offers **Show in folder**, **Export…** and **Import…**. Import checks the file, asks for confirmation, and saves the current data as `ctdp-state.json.before-import-<time>` first. An unreadable data file is moved aside as `ctdp-state.json.corrupt-<time>` instead of being overwritten.

To move to another computer: export on the old one and import on the new one, or quit CTDP (tray → Quit) and copy `ctdp-state.json` into the same folder on the new computer. Do not copy `ctdp-device.json`: two devices with the same id would collide once syncing exists. A version-2 file from before the action log is upgraded on start (kept as `ctdp-state.json.v2-backup`), and its settings move to the device file.

## Sync server

`server/` is a small Node service (built-in SQLite, Web Push) that stores the shared action log for all devices and sends reminders to phones. Computers connect from Settings → Sync with the server address and token. Deployment: [server/DEPLOY.md](server/DEPLOY.md).

## Phone web app

`src/web/` is the phone client: the same React UI and the same engine and sync client (`src/shared/runtime/`), running in the page with data in IndexedDB instead of Electron's main process. The sync server serves it at its site root, so a phone opens `https://<server>/`, adds it to the Home Screen and enters only the token. It works offline after the first visit (`sw.js`) and gets reminders by Web Push. `npm run build:web` builds it into `dist/web/`.

## Layout

```
src/shared/ctdp/   pure domain: types, reducer (mainTrack, auxiliary, library), tree helpers, action log, library JSON
src/shared/runtime/ engine (timer + state), sync client, device record; shared by Electron and the web app
src/main/          Electron main: store, windows, tray, shortcuts, notifier, smoke check
src/web/           phone web app: in-page host of window.ctdp (IndexedDB, push), PWA manifest and service worker
src/preload/       contextBridge API (window.ctdp)
src/renderer/      React UI: home/ (Reserve, Action, sitting, signature), pages/ behind More, the corner card (MiniApp),
                   components/kit/ (hold button, confirm dialog, dimmed prompt), styles/base.css + kit.css (design tokens)
server/            sync server (own package.json): API, SQLite store, reminders, deployment notes
tests/             vitest unit tests for the domain
```

## Commands

```
npm install          # Electron binary comes from the mirror in .npmrc
npm test             # domain unit tests
npm run typecheck
npm run build:web    # phone web app into dist/web/
npm run smoke        # builds app, web app and server, starts the server, drives the desktop app and the
                     # phone web app (390x844 window) headless under Xvfb; CTDP_SMOKE_SHOTS=dir saves screenshots
npm run dist:win     # release/CTDP-<version>-win.zip (unzip and run CTDP.exe)
```
