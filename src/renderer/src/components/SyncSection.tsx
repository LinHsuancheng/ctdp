import { useState } from "react";
import { formatClock } from "../../../shared/ctdp";
import type { SyncView } from "../../../shared/ipc";

function statusText(view: SyncView): string {
  switch (view.state) {
    case "off":
      return "Not connected. Data stays on this computer.";
    case "syncing":
      return "Syncing…";
    case "error":
      return `Sync failed: ${view.error}`;
    default:
      return view.lastSync ? `Synced at ${formatClock(view.lastSync)}` : "Connected";
  }
}

/** Connects this device to the sync server shared with the phone. */
export function SyncSection({ view }: { view: SyncView }) {
  const [url, setUrl] = useState(view.url ?? "");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = () => {
    setBusy(true);
    void window.ctdp.syncConnect(url, token).then((r) => {
      setBusy(false);
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) setToken("");
    });
  };

  return (
    <section className="card">
      <h2>Sync</h2>
      <p className="hint">Share chains, chunks, precedents and history with your other devices through your sync server.</p>
      <p className={view.state === "error" ? "notice" : "hint"}>{statusText(view)}</p>
      {view.url ? (
        <>
          <p className="path">{view.url}</p>
          <div className="row">
            <button className="secondary small" onClick={() => void window.ctdp.syncNow()}>
              Sync now
            </button>
            <button className="ghost small danger" onClick={() => void window.ctdp.syncDisconnect().then(() => setMessage(null))}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid2">
            <label className="field">
              <span>Server address</span>
              <input value={url} placeholder="https://ctdp.example.org" onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="field">
              <span>Token</span>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
          </div>
          <div className="row">
            <button className="primary small" disabled={busy || !url.trim() || !token.trim()} onClick={connect}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </div>
        </>
      )}
      {message && <p className={message.ok ? "notice ok" : "notice"}>{message.text}</p>}
      <p className="hint">This device: {view.deviceId}</p>
    </section>
  );
}
