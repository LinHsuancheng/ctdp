import { useEffect, useState } from "react";
import type { CtdpState } from "../../../shared/ctdp";
import type { DataResult, SyncView } from "../../../shared/ipc";
import { PhoneNotifications } from "../components/PhoneNotifications";
import { ShortcutRecorder } from "../components/ShortcutRecorder";
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
  const web = window.ctdp.platform === "web";
  const [file, setFile] = useState("");
  const [result, setResult] = useState<DataResult | null>(null);
  useEffect(() => {
    void window.ctdp.dataFile().then(setFile);
  }, []);
  const run = (op: () => Promise<DataResult>) => void op().then((r) => setResult(r.message ? r : null));

  return (
    <section className="card">
      <h2>Data</h2>
      {web ? (
        <p className="hint">Everything is stored in this browser on this phone, and on your sync server when connected.</p>
      ) : (
        <>
          <p className="hint">Everything is stored in one file on this computer:</p>
          <p className="path">{file}</p>
          <p className="hint">
            To move to another computer, export here and import there, or copy this file into the same folder on the new computer while CTDP
            is not running.
          </p>
        </>
      )}
      <div className="row">
        {!web && (
          <button className="ghost small" onClick={() => window.ctdp.revealData()}>
            Show in folder
          </button>
        )}
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

/** Shortcut, mini window and local notifications of a computer. */
function DesktopSettings() {
  const settings = useSettings();
  const toggle = (key: "showMiniWindow" | "notifications") => void window.ctdp.updateSettings({ [key]: !settings[key] });
  return (
    <section className="card">
      <h2>This computer</h2>
      <ShortcutRecorder value={settings.summonShortcut} />
      <label className="check">
        <input type="checkbox" checked={settings.showMiniWindow} onChange={() => toggle("showMiniWindow")} />
        Corner card while reserved or seated (the main window steps aside)
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.notifications} onChange={() => toggle("notifications")} />
        Show notifications on this computer
      </label>
      <p className="hint">These stay on this computer and are not shared with your other devices.</p>
    </section>
  );
}

export function SettingsPage({ state, sync }: { state: CtdpState; sync: SyncView }) {
  const push = window.ctdp.push;
  return (
    <>
      {push ? <PhoneNotifications push={push} /> : <DesktopSettings />}
      <SyncSection view={sync} />
      <Categories state={state} />
      <DataSection />
    </>
  );
}
