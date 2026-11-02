import { useState } from "react";
import { ChainHeader } from "./components/ChainHeader";
import { SettingsContext, useCtdpState, useDeviceSettings } from "./hooks/useCtdp";
import { ChainsPage } from "./pages/ChainsPage";
import { ChunksPage } from "./pages/ChunksPage";
import { FocusPage } from "./pages/FocusPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PrecedentsPage } from "./pages/PrecedentsPage";
import { SettingsPage } from "./pages/SettingsPage";

const TABS = [
  { key: "focus", label: "Focus" },
  { key: "chains", label: "Chains" },
  { key: "chunks", label: "Chunks" },
  { key: "precedents", label: "Precedents" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function App() {
  const state = useCtdpState();
  const settings = useDeviceSettings();
  const [tab, setTab] = useState<TabKey>("focus");
  if (!state || !settings) return <div className="loading">Loading…</div>;

  return (
    <SettingsContext.Provider value={settings}>
    <div className="app">
      <ChainHeader state={state} />
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "tab active" : "tab"} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="page">
        {tab === "focus" && <FocusPage state={state} />}
        {tab === "chains" && <ChainsPage state={state} />}
        {tab === "chunks" && <ChunksPage state={state} />}
        {tab === "precedents" && <PrecedentsPage state={state} />}
        {tab === "history" && <HistoryPage state={state} />}
        {tab === "settings" && <SettingsPage state={state} />}
      </main>
    </div>
    </SettingsContext.Provider>
  );
}
