import { useState } from "react";
import { VoidedBanner } from "./components/VoidedBanner";
import { Home } from "./home/Home";
import { SettingsContext, useCtdpState, useDeviceSettings, useSync } from "./hooks/useCtdp";
import { ChainsPage } from "./pages/ChainsPage";
import { ChunksPage } from "./pages/ChunksPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PrecedentsPage } from "./pages/PrecedentsPage";
import { SettingsPage } from "./pages/SettingsPage";

const MORE = [
  { key: "chains", label: "Chains" },
  { key: "chunks", label: "Chunks" },
  { key: "precedents", label: "Precedents" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
] as const;

type MoreKey = (typeof MORE)[number]["key"];
type View = "home" | MoreKey;

const isMore = (v: string | undefined): v is MoreKey => MORE.some((t) => t.key === v);

export function App() {
  const state = useCtdpState();
  const settings = useDeviceSettings();
  const sync = useSync();
  const [view, setView] = useState<View>("home");
  if (!state || !settings || !sync) return <div className="loading">Loading…</div>;

  return (
    <SettingsContext.Provider value={settings}>
      <div className={view === "home" ? "app app-home" : "app"}>
        <header className="topbar">
          {view === "home" ? (
            <>
              <span className="brand">CTDP</span>
              <button className="ghost small" onClick={() => setView("chains")}>
                More
              </button>
            </>
          ) : (
            <>
              <button className="ghost small back" onClick={() => setView("home")}>
                ‹ Back
              </button>
              <nav className="tabs" role="tablist">
                {MORE.map((t) => (
                  <button key={t.key} role="tab" aria-selected={view === t.key} className={view === t.key ? "tab active" : "tab"} onClick={() => setView(t.key)}>
                    {t.label}
                  </button>
                ))}
              </nav>
            </>
          )}
        </header>
        <VoidedBanner view={sync} />
        <main className={view === "home" ? "home" : "page"}>
          {view === "home" && <Home state={state} onMore={(tab) => setView(isMore(tab) ? tab : "chains")} />}
          {view === "chains" && <ChainsPage state={state} />}
          {view === "chunks" && <ChunksPage state={state} />}
          {view === "precedents" && <PrecedentsPage state={state} />}
          {view === "history" && <HistoryPage state={state} sync={sync} />}
          {view === "settings" && <SettingsPage state={state} sync={sync} />}
        </main>
      </div>
    </SettingsContext.Provider>
  );
}
