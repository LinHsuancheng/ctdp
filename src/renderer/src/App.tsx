import { useState } from "react";
import { ChainHeader } from "./components/ChainHeader";
import { useCtdpState } from "./hooks/useCtdp";
import { FocusPage } from "./pages/FocusPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PrecedentsPage } from "./pages/PrecedentsPage";
import { SettingsPage } from "./pages/SettingsPage";

const TABS = [
  { key: "focus", label: "专注" },
  { key: "precedents", label: "判例" },
  { key: "history", label: "记录" },
  { key: "settings", label: "设置" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function App() {
  const state = useCtdpState();
  const [tab, setTab] = useState<TabKey>("focus");
  if (!state) return <div className="loading">加载中…</div>;

  return (
    <div className="app">
      <ChainHeader state={state} />
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "precedents" && state.precedents.length > 0 && (
              <span className="badge">{state.precedents.length}</span>
            )}
          </button>
        ))}
      </nav>
      <main className="page">
        {tab === "focus" && <FocusPage state={state} />}
        {tab === "precedents" && <PrecedentsPage state={state} />}
        {tab === "history" && <HistoryPage state={state} />}
        {tab === "settings" && <SettingsPage settings={state.settings} />}
      </main>
    </div>
  );
}
