import { useEffect, useState } from "react";
import { levelMark, type CtdpState, type DeviceSettings } from "../../../shared/ctdp";
import type { DataResult, SyncView } from "../../../shared/ipc";
import { SyncSection } from "../components/SyncSection";
import { dispatch, useSettings } from "../hooks/useCtdp";

function Categories({ state }: { state: CtdpState }) {
  const [name, setName] = useState("");
  const add = () => void dispatch({ type: "saveCategory", categoryId: null, name }).then(() => setName(""));
  return (
    <section className="card">
      <h2>Categories</h2>
      <ul className="list">
        {state.categories.map((c) => (
          <li key={c.id}>
            <input
              className="grow"
              defaultValue={c.name}
              onBlur={(e) => e.target.value !== c.name && void dispatch({ type: "saveCategory", categoryId: c.id, name: e.target.value })}
            />
            <button className="ghost small danger" onClick={() => void dispatch({ type: "deleteCategory", categoryId: c.id })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input className="grow" value={name} placeholder="New category" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="secondary small" disabled={!name.trim()} onClick={add}>
          Add
        </button>
      </div>
    </section>
  );
}

function DataSection() {
  const [file, setFile] = useState("");
  const [result, setResult] = useState<DataResult | null>(null);
  useEffect(() => {
    void window.ctdp.dataFile().then(setFile);
  }, []);
  const run = (op: () => Promise<DataResult>) => void op().then((r) => setResult(r.message ? r : null));

  return (
    <section className="card">
      <h2>Data</h2>
      <p className="hint">Everything is stored in one file on this computer:</p>
      <p className="path">{file}</p>
      <p className="hint">
        To move to another computer, export here and import there, or copy this file into the same folder on the new computer while CTDP is
        not running.
      </p>
      <div className="row">
        <button className="ghost small" onClick={() => window.ctdp.revealData()}>
          Show in folder
        </button>
        <button className="secondary small" onClick={() => run(window.ctdp.exportData)}>
          Export…
        </button>
        <button className="secondary small" onClick={() => run(window.ctdp.importData)}>
          Import…
        </button>
      </div>
      {result && <p className={result.ok ? "notice ok" : "notice"}>{result.message}</p>}
    </section>
  );
}

export function SettingsPage({ state, sync }: { state: CtdpState; sync: SyncView }) {
  const [draft, setDraft] = useState<DeviceSettings>(useSettings());
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  return (
    <>
      <section className="card">
        <h2>This device</h2>
        <p className="hint">These preferences stay on this computer and are not shared with your other devices.</p>
        <div className="grid2">
          <label className="field">
            <span>Reserve shortcut (primary chain)</span>
            <input value={draft.reserveShortcut} onChange={(e) => set("reserveShortcut", e.target.value)} />
          </label>
          <label className="field">
            <span>Sit-down shortcut (primary chain)</span>
            <input value={draft.startShortcut} onChange={(e) => set("startShortcut", e.target.value)} />
          </label>
        </div>
        <p className="hint">Format like CommandOrControl+Alt+R. A shortcut taken by another app will not work.</p>
        <label className="field">
          <span>Chunk the sit-down shortcut starts</span>
          <select value={draft.quickStartChunkId ?? ""} onChange={(e) => set("quickStartChunkId", e.target.value || null)}>
            <option value="">Ad-hoc 60-minute unit</option>
            {state.chunks.map((c) => (
              <option key={c.id} value={c.id}>
                {levelMark(c.level)} {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={draft.showMiniWindow} onChange={(e) => set("showMiniWindow", e.target.checked)} />
          Show the always-on-top mini window while seated or reserved
        </label>
        <label className="check">
          <input type="checkbox" checked={draft.notifications} onChange={(e) => set("notifications", e.target.checked)} />
          Show notifications on this device
        </label>
        <div className="row">
          <button className="primary" onClick={() => void window.ctdp.updateSettings(draft).then(() => setSaved(true))}>
            Save
          </button>
          {saved && <span className="notice ok inline">Saved</span>}
        </div>
      </section>
      <SyncSection view={sync} />
      <Categories state={state} />
      <DataSection />
    </>
  );
}
