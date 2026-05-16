import { Menu, PanelLeft, PanelRight, Pickaxe, Settings, Tag } from "lucide-react";

export default function AppHeader({ mode, setMode, setItemPage, mobileMenuOpen, setMobileMenuOpen, leftSidebarOpen, setLeftSidebarOpen, rightSidebarOpen, setRightSidebarOpen, configId, setConfigId, allConfigEntries, selectedConfigEntry }) {
  function switchMode(next) {
    setMode(next);
    setItemPage("");
    setMobileMenuOpen(false);
  }

  return (
    <header className="app-header">
      <div className="brand compact">
        <div className="brand-mark"><Pickaxe size={19} /></div>
        <div><h1>CraftCodex</h1></div>
      </div>
      <button className="mobile-menu-button settings-button icon-only" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Open navigation menu" aria-expanded={mobileMenuOpen}>
        <Menu size={18} />
      </button>
      <button className="mobile-sidebar-button settings-button icon-only" onClick={() => setLeftSidebarOpen((v) => !v)} aria-label={leftSidebarOpen ? "Hide item drawer" : "Show item drawer"} aria-expanded={leftSidebarOpen}>
        <PanelLeft size={18} />
      </button>
      <div className="mode-toggle" aria-label="App mode">
        <button className={mode === "planner" ? "active" : ""} onClick={() => switchMode("planner")}>Collection Planner</button>
        <button className={mode === "browser" ? "active" : ""} onClick={() => switchMode("browser")}>Item Browser</button>
        <button className={mode === "builder" ? "active" : ""} onClick={() => switchMode("builder")}>Recipe Builder</button>
      </div>
      <div className={`header-tools ${mobileMenuOpen ? "open" : ""}`}>
        <label className="version-select">
          <Tag size={14} />
          <span>Version</span>
          <strong className="version-value">{selectedConfigEntry?.name || "Select"}</strong>
          <select value={configId} onChange={(e) => setConfigId(e.target.value)}>
            {allConfigEntries.map((entry) => (
              <option value={entry.id} key={entry.id}>{entry.name}</option>
            ))}
          </select>
        </label>
        <button className="settings-button icon-only" onClick={() => setLeftSidebarOpen((v) => !v)} aria-label={leftSidebarOpen ? "Hide left sidebar" : "Show left sidebar"} title={leftSidebarOpen ? "Hide left sidebar" : "Show left sidebar"}>
          <PanelLeft size={16} />
        </button>
        <button className="settings-button icon-only" onClick={() => setRightSidebarOpen((v) => !v)} aria-label={rightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"} title={rightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"}>
          <PanelRight size={16} />
        </button>
        <button className={`settings-button ${mode === "settings" ? "active" : ""}`} onClick={() => switchMode("settings")}>
          <Settings size={16} /> Settings
        </button>
      </div>
    </header>
  );
}
