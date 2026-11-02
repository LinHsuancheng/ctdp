import { useState } from "react";

/** First run on the phone: the page comes from the sync server, so only the token is needed. */
export function ConnectScreen() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = () => {
    setBusy(true);
    setError(null);
    void window.ctdp.syncConnect(location.origin, token).then((r) => {
      setBusy(false);
      if (!r.ok) setError(r.message);
    });
  };

  return (
    <div className="app connect">
      <section className="card">
        <h2>Connect CTDP</h2>
        <p className="hint">
          Enter the token of your sync server (<code>CTDP_TOKEN</code> in its settings). This phone then uses the same chains, chunks, precedents and
          history as your computer.
        </p>
        <label className="field">
          <span>Token</span>
          <input type="password" autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && token.trim() && connect()} />
        </label>
        <div className="row">
          <button className="primary" disabled={busy || !token.trim()} onClick={connect}>
            {busy ? "Connecting…" : "Connect"}
          </button>
        </div>
        {error && <p className="notice">{error}</p>}
        <p className="hint">On iPhone, add this page to the Home Screen (Share → Add to Home Screen) to use it like an app and get notifications.</p>
      </section>
    </div>
  );
}
