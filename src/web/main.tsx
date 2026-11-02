import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../renderer/src/App";
import { useSync } from "../renderer/src/hooks/useCtdp";
import "../renderer/src/styles/base.css";
import "../renderer/src/styles/app.css";
import "../renderer/src/styles/kit.css";
import "../renderer/src/styles/home.css";
import { ConnectScreen } from "./ConnectScreen";
import { createWebHost } from "./host";

function WebRoot() {
  const sync = useSync();
  if (!sync) return <div className="loading">Loading…</div>;
  return sync.url ? <App /> : <ConnectScreen />;
}

const root = createRoot(document.getElementById("root")!);

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js").catch((err: unknown) => console.error("service worker:", err));
}

createWebHost().then(
  (api) => {
    window.ctdp = api;
    root.render(
      <StrictMode>
        <WebRoot />
      </StrictMode>,
    );
  },
  (err: unknown) => root.render(<div className="loading">CTDP cannot open its storage in this browser: {String(err)}</div>),
);
