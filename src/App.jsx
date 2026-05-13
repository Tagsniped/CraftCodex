import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  Hammer,
  Info,
  Menu,
  PanelLeft,
  PanelRight,
  Pickaxe,
  Plus,
  Search,
  Settings,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { BUILT_IN_CONFIGS, STARTING_GOALS, loadConfigFile } from "./lib/config.js";
import { isTagIngredient, tagKey, tagChoices } from "./lib/utils.js";
import { recipesByOutput, recipesUsingItem, scaleIngredients, computePlan, addQty } from "./lib/plan.js";
import { spriteFor, playerHeadDataUrl } from "./lib/sprite.js";
import { minecraftZipToConfig } from "./lib/minecraft.js";
import ItemIcon from "./components/ItemIcon.jsx";
import RecipeGrid from "./components/RecipeGrid.jsx";
import ItemInfoModal from "./components/ItemInfoModal.jsx";
import ItemInspector from "./components/ItemInspector.jsx";
import ItemPage from "./components/ItemPage.jsx";
import ConfigEditor from "./components/ConfigEditor.jsx";

export default function App() {
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState(() => localStorage.getItem("craftpath.configId") || "minecraft-26.1.2");
  const [customConfigs, setCustomConfigs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("craftpath.configs") || "[]");
    } catch {
      return [];
    }
  });
  const [mode, setMode] = useState("planner");
  const [itemModal, setItemModal] = useState("");
  const [itemPage, setItemPage] = useState("");
  const [browserCategory, setBrowserCategory] = useState("All");
  const [groupBrowserItems, setGroupBrowserItems] = useState(true);
  const [showBrowserNames, setShowBrowserNames] = useState(false);
  const [goals, setGoals] = useState(STARTING_GOALS);
  const [craftSteps, setCraftSteps] = useState([]);
  const [completedItems, setCompletedItems] = useState({});
  const [checked, setChecked] = useState({});
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [expandedCraftStep, setExpandedCraftStep] = useState("");
  const [recipeChoices, setRecipeChoices] = useState({});
  const [tagSelections, setTagSelections] = useState({});
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => (typeof window === "undefined" ? true : !window.matchMedia("(max-width: 767px)").matches));
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => (typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches));
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("craftpath.themeMode") || "dark");
  const [accentHue, setAccentHue] = useState(() => Number(localStorage.getItem("craftpath.accentHue") || 38));
  const [customText, setCustomText] = useState("");
  const [importEditable, setImportEditable] = useState(false);
  const [newItem, setNewItem] = useState({ id: "", name: "", category: "", method: "craft", spriteMode: "existing", spriteItem: "", sprite: "", spriteHead: "", notes: "" });
  const [editingRecipeId, setEditingRecipeId] = useState("");
  const [recipeDraft, setRecipeDraft] = useState("");
  const [message, setMessage] = useState("");

  const allConfigEntries = [...BUILT_IN_CONFIGS, ...customConfigs.map((cfg) => ({ id: cfg.meta.id, name: cfg.meta.name, inline: cfg }))];

  useEffect(() => {
    const entry = allConfigEntries.find((candidate) => candidate.id === configId) || allConfigEntries[0];
    async function load() {
      const next = entry.inline ? entry.inline : await loadConfigFile(entry);
      setConfig(next);
      setCraftSteps([]);
      setCompletedItems({});
      setChecked({});
      setExpanded({});
      setSelectedMaterial("");
      setExpandedCraftStep("");
      setRecipeChoices({});
      setTagSelections({});
    }
    load().catch(() => setMessage("Could not load that config file."));
  }, [configId, customConfigs]);

  useEffect(() => {
    localStorage.setItem("craftpath.configId", configId);
  }, [configId]);

  useEffect(() => {
    try {
      localStorage.setItem("craftpath.configs", JSON.stringify(customConfigs));
    } catch {
      setMessage("Imported pack is loaded for this session, but it is too large to save in browser storage.");
    }
  }, [customConfigs]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.setProperty("--accent-hue", accentHue);
    localStorage.setItem("craftpath.themeMode", themeMode);
    localStorage.setItem("craftpath.accentHue", String(accentHue));
  }, [themeMode, accentHue]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => {
      setIsNarrowViewport(media.matches);
      if (media.matches) {
        setLeftSidebarOpen(false);
        setRightSidebarOpen(false);
      } else {
        setLeftSidebarOpen(true);
        setRightSidebarOpen(true);
        setMobileMenuOpen(false);
      }
    };
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const recipeLookup = useMemo(() => (config ? recipesByOutput(config) : {}), [config]);
  const plan = useMemo(() => (config ? computePlan(goals, craftSteps, completedItems, config) : { needs: {}, readyCrafts: [] }), [goals, craftSteps, completedItems, config]);

  if (!config) return <main className="loading">Loading CraftCodex...</main>;

  const items = config.items;
  const needsEntries = Object.entries(plan.needs)
    .filter(([id]) => items[id])
    .sort((a, b) => items[a[0]].name.localeCompare(items[b[0]].name));
  const completedEntries = Object.entries(completedItems)
    .filter(([, qty]) => qty > 0)
    .filter(([id]) => items[id])
    .sort((a, b) => items[a[0]].name.localeCompare(items[b[0]].name));
  const checklistEntries = [...needsEntries, ...completedEntries.map(([id, qty]) => [id, qty, true])];
  const materialBoardEntries = [...needsEntries.map(([id, qty]) => [id, qty, false]), ...completedEntries.map(([id, qty]) => [id, qty, true])];
  const collectedCount = checklistEntries.filter(([id, , completed]) => completed || checked[id]).length;
  const allCollected = needsEntries.length > 0 && needsEntries.every(([id]) => checked[id]);
  const searchableIds = Object.keys(items).sort((a, b) => items[a].name.localeCompare(items[b].name));
  const searchResults = searchableIds.filter((id) => items[id].name.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const categories = ["All", ...Array.from(new Set(searchableIds.map((id) => items[id].category || "Uncategorized"))).sort()];
  const browserItems = searchableIds.filter((id) => {
    const category = items[id].category || "Uncategorized";
    const matchesCategory = browserCategory === "All" || category === browserCategory;
    const matchesQuery = !query || items[id].name.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });
  const browserGroups = browserItems.reduce((groups, id) => {
    const category = items[id].category || "Uncategorized";
    groups[category] = [...(groups[category] || []), id];
    return groups;
  }, {});
  const modalRecipes = itemModal ? recipeLookup[itemModal] || [] : [];
  const modalUsedIn = itemModal ? recipesUsingItem(config, itemModal) : [];
  const currentIsEditable = Boolean(config.meta?.editable);
  const currentIsLocked = Boolean(config.meta?.locked);
  const selectedConfigEntry = allConfigEntries.find((entry) => entry.id === configId) || allConfigEntries[0];
  const rightRailVisible = !isNarrowViewport && rightSidebarOpen && ((mode === "planner") || (mode === "browser"));

  function openItemModal(id) {
    setItemModal(id);
  }

  function openItemPage(id) {
    setItemPage(id);
    setItemModal("");
    setMode("browser");
  }

  function saveItemDetails(id, nextItem) {
    if (currentIsLocked) return;
    replaceCurrentConfig({ ...config, items: { ...config.items, [id]: nextItem } });
    setMessage(`Saved item ${nextItem.name || id}.`);
  }

  function handleMaterialCardClick(id, isCraftable, completed) {
    setSelectedMaterial(id);
    if (!completed) {
      setExpanded((current) => ({ ...current, [id]: !current[id] }));
    }
  }

  function addGoal(id) {
    setGoals((current) => {
      const existing = current.find((goal) => goal.id === id);
      if (existing) return current.map((goal) => (goal.id === id ? { ...goal, qty: goal.qty + 1 } : goal));
      return [...current, { id, qty: 1 }];
    });
    setQuery("");
  }

  function updateGoal(id, qty) {
    setGoals((current) => current.map((goal) => (goal.id === id ? { ...goal, qty: Math.max(1, qty) } : goal)));
  }

  function removeGoal(id) {
    setGoals((current) => current.filter((goal) => goal.id !== id));
    setCraftSteps((current) => current.filter((step) => step.id !== id));
  }

  function addMaterials(id, qty) {
    const recipes = recipeLookup[id] || [];
    const recipe = recipes[recipeChoices[id] || 0];
    if (!recipe) return;
    const recipeTagSelections = Object.fromEntries(
      [...new Set([...(recipe.grid || []).flat(), ...Object.keys(recipe.ingredients || {})].filter(isTagIngredient).map(tagKey))]
        .map((key) => [key, tagSelections[`${recipe.id}:${key}`] || tagChoices(config, `#${key}`)[0]])
        .filter(([, choice]) => choice)
    );
    setCraftSteps((current) => {
      const existing = current.find((step) => step.id === id && step.recipeId === recipe.id);
      if (existing) {
        return current.map((step) => (step === existing ? { ...step, qty: step.qty + qty, tagSelections: { ...(step.tagSelections || {}), ...recipeTagSelections } } : step));
      }
      return [...current, { id, qty, recipeId: recipe.id, tagSelections: recipeTagSelections }];
    });
    setExpanded((current) => ({ ...current, [id]: false }));
  }

  function setRecipeTagChoice(recipeId, key, choice) {
    setTagSelections((current) => ({ ...current, [`${recipeId}:${key}`]: choice }));
  }

  function changeRecipe(id, direction) {
    const count = recipeLookup[id]?.length || 1;
    setRecipeChoices((current) => ({ ...current, [id]: ((current[id] || 0) + direction + count) % count }));
  }

  function replaceCurrentConfig(nextConfig) {
    setConfig(nextConfig);
    setCustomConfigs((current) => [...current.filter((cfg) => cfg.meta.id !== nextConfig.meta.id), nextConfig]);
    localStorage.setItem("craftpath.configId", nextConfig.meta.id);
  }

  function importConfigObject(nextConfig, options = {}) {
    const normalized = {
      ...nextConfig,
      meta: {
        id: nextConfig.meta?.id || `custom-${Date.now()}`,
        name: nextConfig.meta?.name || "Custom Recipe Pack",
        type: nextConfig.meta?.type || "custom",
        spriteBase: nextConfig.meta?.spriteBase || "/sprites/",
        editable: Boolean(options.editable ?? nextConfig.meta?.editable),
        locked: Boolean(nextConfig.meta?.locked),
      },
      items: nextConfig.items || {},
      stations: nextConfig.stations || {},
      tags: nextConfig.tags || {},
      recipes: nextConfig.recipes || [],
    };
    setCustomConfigs((current) => [...current.filter((cfg) => cfg.meta.id !== normalized.meta.id), normalized]);
    setConfigId(normalized.meta.id);
    localStorage.setItem("craftpath.configId", normalized.meta.id);
    setCustomText(JSON.stringify(normalized, null, 2));
    setMessage(`Imported ${normalized.meta.name} with ${normalized.recipes.length} recipes and ${Object.keys(normalized.items).length} items.`);
  }

  function downloadCurrentConfig() {
    if (!config) return;
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (config.meta?.name || config.meta?.id || "recipe-pack").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "recipe-pack";
    link.href = url;
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${config.meta?.name || "recipe pack"}.`);
  }

  function handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const importTask = file.name.toLowerCase().endsWith(".zip")
      ? minecraftZipToConfig(file, importEditable)
      : file.text().then((text) => JSON.parse(text));
    importTask
      .then((nextConfig) => importConfigObject(nextConfig, { editable: importEditable }))
      .catch(() => setMessage(file.name.toLowerCase().endsWith(".zip") ? "That zip could not be read as a CraftCodex Minecraft pack." : "That file was not valid JSON."));
    event.target.value = "";
  }

  function saveEditableConfig() {
    try {
      importConfigObject(JSON.parse(customText));
    } catch {
      setMessage("The editable config JSON has a syntax error.");
    }
  }

  function seedEditableConfig() {
    setCustomText(JSON.stringify(config, null, 2));
    setMode("builder");
  }

  function createEditableCopy() {
    const copy = {
      ...config,
      meta: {
        ...config.meta,
        id: `custom-${Date.now()}`,
        name: `Custom ${config.meta?.name || "Recipe Pack"}`,
        type: "custom",
        editable: true,
        locked: false,
        baseId: config.meta?.id,
      },
      items: { ...config.items },
      stations: { ...(config.stations || {}) },
      tags: { ...(config.tags || {}) },
      recipes: [...(config.recipes || [])],
    };
    importConfigObject(copy, { editable: true });
    setMessage(`Created editable copy from ${config.meta?.name}.`);
  }

  function toggleCurrentLock() {
    if (!currentIsEditable) return;
    const next = { ...config, meta: { ...config.meta, locked: !currentIsLocked } };
    replaceCurrentConfig(next);
    setMessage(next.meta.locked ? "Config locked for normal use." : "Config unlocked for editing.");
  }

  function addCustomItem() {
    if (!newItem.id.trim() || !newItem.name.trim() || currentIsLocked) return;
    const id = newItem.id.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, "_");
    const spriteMode = newItem.spriteMode || "existing";
    const sprite = spriteMode === "existing"
      ? { type: "item", id: newItem.spriteItem || Object.keys(config.items)[0] || "" }
      : spriteMode === "head"
        ? { type: "player_head", texture: newItem.spriteHead.trim() }
        : newItem.sprite.trim() || `${id}.svg`;
    const nextItem = {
      name: newItem.name.trim(),
      method: newItem.method.trim() || "craft",
      sprite,
      notes: newItem.notes.trim(),
      ...(newItem.category.trim() ? { category: newItem.category.trim() } : {}),
    };
    replaceCurrentConfig({ ...config, items: { ...config.items, [id]: nextItem } });
    setNewItem({ id: "", name: "", category: "", method: "craft", spriteMode: "existing", spriteItem: "", sprite: "", spriteHead: "", notes: "" });
    setMessage(`Added item ${nextItem.name}.`);
  }

  function beginRecipeEdit(id) {
    const recipe = config.recipes.find((candidate) => candidate.id === id) || {
      id: `recipe-${Date.now()}`,
      output: { id: "", qty: 1 },
      type: "craft",
      station: "Crafting Table",
      ingredients: {},
      grid: [["", "", ""], ["", "", ""], ["", "", ""]],
    };
    setEditingRecipeId(recipe.id);
    setRecipeDraft(JSON.stringify(recipe, null, 2));
  }

  function createRecipeDraft(recipe, stationName, stationDef) {
    if (currentIsLocked) return;
    if (stationName && stationDef) {
      replaceCurrentConfig({ ...config, stations: { ...(config.stations || {}), [stationName]: stationDef } });
      setMessage(`Added crafting block ${stationName}.`);
    }
    setEditingRecipeId(recipe.id);
    setRecipeDraft(JSON.stringify(recipe, null, 2));
  }

  function saveRecipeDraft() {
    if (currentIsLocked) return;
    try {
      const recipe = JSON.parse(recipeDraft);
      if (!recipe.id || !recipe.output?.id) {
        setMessage("Recipe needs an id and output.id.");
        return;
      }
      const recipes = [...config.recipes.filter((candidate) => candidate.id !== recipe.id), recipe];
      replaceCurrentConfig({ ...config, recipes });
      setEditingRecipeId(recipe.id);
      setMessage(`Saved recipe ${recipe.id}.`);
    } catch {
      setMessage("Recipe JSON has a syntax error.");
    }
  }

  function stepIsReady(step) {
    const scaled = scaleIngredients(step.recipe, step.qty);
    return Object.entries(scaled.ingredients).every(([id, qty]) => checked[id] || (completedItems[id] || 0) >= qty);
  }

  function completeCraft(step) {
    const scaled = scaleIngredients(step.recipe, step.qty);
    setCraftSteps((current) => current.filter((candidate) => !(candidate.id === step.id && candidate.recipeId === step.recipeId)));
    setCompletedItems((current) => {
      const next = { ...current };
      Object.entries(scaled.ingredients).forEach(([id, qty]) => addQty(next, id, -qty));
      addQty(next, step.id, step.qty);
      return next;
    });
    setChecked((current) => {
      const next = { ...current, [step.id]: true };
      Object.keys(scaled.ingredients).forEach((id) => delete next[id]);
      return next;
    });
    setExpandedCraftStep("");
  }

  return (
    <main className={`app-shell ${mode === "browser" ? "browser-shell" : ""} ${mode === "browser" && currentIsEditable ? "browser-editor-shell" : ""} ${mode === "builder" ? "builder-shell" : ""} ${mode === "settings" ? "settings-shell" : ""} ${leftSidebarOpen ? "" : "left-collapsed"} ${rightRailVisible ? "" : "right-collapsed"} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <header className="app-header">
        <div className="brand compact">
          <div className="brand-mark"><Pickaxe size={19} /></div>
          <div>
            <h1>CraftCodex</h1>
          </div>
        </div>
        <button className="mobile-menu-button settings-button icon-only" onClick={() => setMobileMenuOpen((value) => !value)} aria-label="Open navigation menu" aria-expanded={mobileMenuOpen}>
          <Menu size={18} />
        </button>
        <button className="mobile-sidebar-button settings-button icon-only" onClick={() => setLeftSidebarOpen((value) => !value)} aria-label={leftSidebarOpen ? "Hide item drawer" : "Show item drawer"} aria-expanded={leftSidebarOpen}>
          <PanelLeft size={18} />
        </button>
        <div className="mode-toggle" aria-label="App mode">
          <button className={mode === "planner" ? "active" : ""} onClick={() => { setMode("planner"); setItemPage(""); setMobileMenuOpen(false); }}>Collection Planner</button>
          <button className={mode === "browser" ? "active" : ""} onClick={() => { setMode("browser"); setItemPage(""); setMobileMenuOpen(false); }}>Item Browser</button>
          <button className={mode === "builder" ? "active" : ""} onClick={() => { setMode("builder"); setItemPage(""); setMobileMenuOpen(false); }}>Recipe Builder</button>
        </div>
        <div className={`header-tools ${mobileMenuOpen ? "open" : ""}`}>
          <label className="version-select">
            <Tag size={14} />
            <span>Version</span>
            <strong className="version-value">{selectedConfigEntry?.name || "Select"}</strong>
            <select value={configId} onChange={(event) => setConfigId(event.target.value)}>
              {allConfigEntries.map((entry) => (
                <option value={entry.id} key={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <button className="settings-button icon-only" onClick={() => setLeftSidebarOpen((value) => !value)} aria-label={leftSidebarOpen ? "Hide left sidebar" : "Show left sidebar"} title={leftSidebarOpen ? "Hide left sidebar" : "Show left sidebar"}>
            <PanelLeft size={16} />
          </button>
          <button className="settings-button icon-only" onClick={() => setRightSidebarOpen((value) => !value)} aria-label={rightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"} title={rightSidebarOpen ? "Hide right sidebar" : "Show right sidebar"}>
            <PanelRight size={16} />
          </button>
          <button className={`settings-button ${mode === "settings" ? "active" : ""}`} onClick={() => { setMode("settings"); setItemPage(""); setMobileMenuOpen(false); }}>
            <Settings size={16} /> Settings
          </button>
        </div>
      </header>

      {leftSidebarOpen ? <aside className="sidebar">
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items" />
        </label>

        <div className="search-results">
          {searchResults.map((id) => (
            <button key={id} onClick={() => (mode === "planner" ? addGoal(id) : openItemPage(id))} className="result-row">
              <span className="slot"><ItemIcon config={config} id={id} /></span>
              <span>{items[id].name}</span>
              {mode === "planner" ? <Plus size={15} /> : <Info size={15} />}
            </button>
          ))}
        </div>

        {mode === "planner" ? (
          <section className="goal-panel">
            <div className="panel-title">
              <span>Goal List</span>
              <strong>{goals.length}</strong>
            </div>
            {goals.map((goal) => (
              <div className="goal-row" key={goal.id}>
                <span className="slot"><ItemIcon config={config} id={goal.id} /></span>
                <span className="goal-name">{items[goal.id]?.name || goal.id}</span>
                <input aria-label={`${items[goal.id]?.name || goal.id} quantity`} type="number" min="1" value={goal.qty} onChange={(event) => updateGoal(goal.id, Number(event.target.value))} />
                <button className="icon-button" onClick={() => removeGoal(goal.id)} aria-label={`Remove ${items[goal.id]?.name || goal.id}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </section>
        ) : mode === "builder" ? (
          <section className="goal-panel builder-nav">
            <div className="panel-title">
              <span>Builder Status</span>
              <strong>{config.recipes.length}</strong>
            </div>
            <p>{currentIsEditable ? currentIsLocked ? "This recipe pack is locked." : "This recipe pack is editable." : "Create an editable copy to build a custom recipe list."}</p>
            <button className="category-row active" onClick={currentIsEditable ? toggleCurrentLock : createEditableCopy}>
              <FileJson size={15} />
              <span>{currentIsEditable ? currentIsLocked ? "Unlock Recipe Pack" : "Lock Recipe Pack" : "Create Editable Copy"}</span>
            </button>
          </section>
        ) : (
          <section className="goal-panel">
            <div className="panel-title">
              <span>Browse Categories</span>
              <strong>{browserItems.length}</strong>
            </div>
            {categories.slice(0, 9).map((category) => (
              <button className={`category-row ${browserCategory === category ? "active" : ""}`} key={category} onClick={() => setBrowserCategory(category)}>
                <BookOpen size={15} />
                <span>{category}</span>
              </button>
            ))}
          </section>
        )}
      </aside> : null}

      <section className="workspace">
        {mode === "browser" && itemPage ? null : (
          <header className="topbar">
            <div>
              <h2>{mode === "planner" ? "Needed Materials" : mode === "builder" ? "Recipe Builder" : mode === "settings" ? "Settings" : "Item Browser"}</h2>
              <p>
                {mode === "planner"
                  ? "Expand a craftable card, pick a recipe, then add its ingredients to the list."
                  : mode === "builder"
                    ? "Create editable recipe packs from a base version, then add items and recipes for servers or modpacks."
                    : mode === "settings"
                      ? "Customize CraftCodex's theme and workspace layout."
                      : "Browse items, inspect recipes, and open dedicated item pages."}
              </p>
            </div>
          </header>
        )}

        {mode === "settings" ? (
          <section className="settings-panel customize-panel">
            <div>
              <span className="eyebrow">Customize webpage</span>
              <h3>Appearance</h3>
            </div>
            <div className="settings-row">
              <label>
                Theme
                <select value={themeMode} onChange={(event) => setThemeMode(event.target.value)}>
                  <option value="dark">Dark mode</option>
                  <option value="light">Light mode</option>
                </select>
              </label>
              <label className="hue-control">
                <span>Color hue</span>
                <input type="range" min="0" max="360" value={accentHue} onChange={(event) => setAccentHue(Number(event.target.value))} />
                <b>{accentHue}°</b>
              </label>
              <button onClick={() => setAccentHue(38)}>Reset orange/yellow</button>
            </div>
          </section>
        ) : null}

        {mode === "settings" ? null : mode === "builder" ? (
          <section className="recipe-builder">
            <section className="builder-config-panel">
              <div className="pack-status-row">
                <div>
                  <span className="eyebrow">Current recipe pack</span>
                  <h3>{config.meta?.name}</h3>
                  <p>{Object.keys(config.items).length} items · {config.recipes.length} recipes · {Object.keys(config.stations || {}).length} station layouts</p>
                </div>
                <strong>{currentIsEditable ? currentIsLocked ? "Locked" : "Editable" : "Read only"}</strong>
              </div>
              <div className="settings-row">
                <label>
                  Recipe config
                  <select value={configId} onChange={(event) => setConfigId(event.target.value)}>
                    {allConfigEntries.map((entry) => (
                      <option value={entry.id} key={entry.id}>{entry.name}</option>
                    ))}
                  </select>
                </label>
                <label className="import-button">
                  <Upload size={16} /> Import config
                  <input type="file" accept="application/json,.json,.zip,application/zip" onChange={handleFileImport} />
                </label>
                <label className="toggle-control settings-toggle">
                  <input type="checkbox" checked={importEditable} onChange={() => setImportEditable((value) => !value)} />
                  <span>Import as editable</span>
                </label>
                <button onClick={createEditableCopy}><FileJson size={16} /> Create editable copy</button>
                <button onClick={downloadCurrentConfig}><Download size={16} /> Download pack</button>
                {currentIsEditable ? <button onClick={toggleCurrentLock}>{currentIsLocked ? "Unlock config" : "Lock config"}</button> : null}
              </div>
              <details className="advanced-json">
                <summary>Full config JSON</summary>
                <textarea value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="Paste or edit a recipe config JSON file here." />
                <div className="settings-row">
                  <button onClick={saveEditableConfig}>Save Editable Config</button>
                  <p>{currentIsEditable ? currentIsLocked ? "Current config is locked." : "Current config is editable." : "Built-in configs are read-only. Create an editable copy to modify recipes."} {message}</p>
                </div>
              </details>
            </section>

            {currentIsEditable ? (
              <>
                <div className={`builder-lock-note ${currentIsLocked ? "locked" : ""}`}>
                  {currentIsLocked ? "This recipe pack is locked so you can use it without accidental edits. Unlock it when you want to change items or recipes." : "This recipe pack is editable. Add custom items, paste recipe JSON, or modify recipes copied from the selected base version."}
                </div>
                <ConfigEditor
                  config={config}
                  currentIsLocked={currentIsLocked}
                  newItem={newItem}
                  setNewItem={setNewItem}
                  addCustomItem={addCustomItem}
                  editingRecipeId={editingRecipeId}
                  beginRecipeEdit={beginRecipeEdit}
                  createRecipeDraft={createRecipeDraft}
                  recipeDraft={recipeDraft}
                  setRecipeDraft={setRecipeDraft}
                  saveRecipeDraft={saveRecipeDraft}
                />
              </>
            ) : (
              <div className="empty-builder">
                <FileJson size={34} />
                <h3>Start from the selected Minecraft version</h3>
                <p>Built-in recipe packs stay read-only. Create an editable copy when you want a server, modpack, or personal override file.</p>
                <button className="primary-action" onClick={createEditableCopy}>Create editable copy</button>
              </div>
            )}
          </section>
        ) : mode === "browser" ? (
          itemPage ? (
            <ItemPage
              config={config}
              itemId={itemPage}
              recipes={recipeLookup[itemPage] || []}
              usedIn={recipesUsingItem(config, itemPage)}
              onBack={() => setItemPage("")}
              onQuickInfo={openItemModal}
              canEdit={currentIsEditable && !currentIsLocked}
              onSaveItem={saveItemDetails}
            />
          ) : (
            <section className="recipe-browser">
              <div className="mobile-category-chips" aria-label="Browse categories">
                {categories.map((category) => (
                  <button className={browserCategory === category ? "active" : ""} key={category} onClick={() => setBrowserCategory(category)}>
                    {category}
                  </button>
                ))}
              </div>
              <div className="browser-toolbar">
                <span>{browserCategory} · {browserItems.length} items</span>
                <div className="browser-toolbar-controls">
                  <label className="toggle-control">
                    <input type="checkbox" checked={groupBrowserItems} onChange={() => setGroupBrowserItems((value) => !value)} />
                    <span>Group by category</span>
                  </label>
                  <label className="toggle-control">
                    <input type="checkbox" checked={showBrowserNames} onChange={() => setShowBrowserNames((value) => !value)} />
                    <span>Show names</span>
                  </label>
                </div>
              </div>
              {groupBrowserItems ? (
                Object.entries(browserGroups).map(([category, ids]) => (
                  <section className="browser-group" key={category}>
                    <div className="browser-group-title">
                      <h3>{category}</h3>
                      <span>{ids.length}</span>
                    </div>
                    <div className={`browser-grid ${showBrowserNames ? "" : "icon-only"}`}>
                      {ids.map((id) => (
                        <button className="browser-card" key={id} onClick={() => openItemModal(id)} title={items[id].name} aria-label={items[id].name}>
                          <span className="slot"><ItemIcon config={config} id={id} size={24} /></span>
                          {showBrowserNames ? <strong>{items[id].name}</strong> : null}
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className={`browser-grid flat ${showBrowserNames ? "" : "icon-only"}`}>
                  {browserItems.map((id) => (
                    <button className="browser-card" key={id} onClick={() => openItemModal(id)} title={items[id].name} aria-label={items[id].name}>
                      <span className="slot"><ItemIcon config={config} id={id} size={24} /></span>
                      {showBrowserNames ? <strong>{items[id].name}</strong> : null}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        ) : (
          <section className="material-board">
            {materialBoardEntries.map(([id, qty, completed]) => {
            const recipes = recipeLookup[id] || [];
            const recipeIndex = recipeChoices[id] || 0;
            const recipe = recipes[recipeIndex];
            const isExpanded = expanded[id];
            const isCraftable = !completed && recipes.length > 0;
            return (
              <article className={`material-card ${completed || checked[id] ? "done" : ""} ${completed ? "crafted" : ""} ${selectedMaterial === id ? "selected" : ""}`} key={`${id}-${completed ? "crafted" : "needed"}`}>
                <button className="material-head" onClick={() => handleMaterialCardClick(id, isCraftable, completed)}>
                  <span className="slot large"><ItemIcon config={config} id={id} size={32} /></span>
                  <span>
                    <strong>{items[id].name}</strong>
                    <em>{completed ? "Crafted and checked" : isCraftable ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : items[id].method}</em>
                  </span>
                  <b>x{qty}</b>
                  {completed ? <span className="crafted-mark"><Check size={14} /> done</span> : null}
                </button>

                {isExpanded && !completed ? (
                  <div className="recipe-expansion">
                    {recipe ? (
                      <>
                        <div className="recipe-toolbar">
                          <button disabled={recipes.length < 2} onClick={() => changeRecipe(id, -1)}><ChevronLeft size={15} /></button>
                          <span>{recipe.station} · {recipe.type} · {recipeIndex + 1}/{recipes.length}</span>
                          <button disabled={recipes.length < 2} onClick={() => changeRecipe(id, 1)}><ChevronRight size={15} /></button>
                        </div>
                        <RecipeGrid
                          config={config}
                          recipe={recipe}
                          interactiveTags
                          tagSelections={Object.fromEntries(
                            Object.keys(config.tags || {}).map((key) => [key, tagSelections[`${recipe.id}:${key}`]]).filter(([, choice]) => choice)
                          )}
                          onTagSelect={(key, choice) => setRecipeTagChoice(recipe.id, key, choice)}
                        />
                        <div className="recipe-actions">
                          <button className="primary-action" onClick={() => addMaterials(id, qty)}>
                            <Plus size={15} /> Add materials to list
                          </button>
                          <button className="more-info-button inline" onClick={() => openItemModal(id)}><Info size={14} /> More info</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="material-note">{items[id].notes || "No recipe is configured for this item."}</p>
                        <div className="recipe-actions">
                          <button className="primary-action" onClick={() => setChecked((current) => ({ ...current, [id]: !current[id] }))}>
                            <Check size={15} /> {checked[id] ? "Unmark collected" : "Mark collected"}
                          </button>
                          <button className="more-info-button inline" onClick={() => openItemModal(id)}><Info size={14} /> More info</button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </article>
            );
            })}
          </section>
        )}
      </section>

      {mode === "planner" && (rightSidebarOpen || isNarrowViewport) ? <aside className="checklist">
        {mode === "planner" ? (
          <>
            <div className="progress-card">
              <div className="progress-ring" style={{ "--progress": `${checklistEntries.length ? Math.round((collectedCount / checklistEntries.length) * 100) : 0}%` }}>
                <span>{checklistEntries.length ? Math.round((collectedCount / checklistEntries.length) * 100) : 0}%</span>
              </div>
              <div>
                <h2>Crafting Steps</h2>
                <p>{allCollected ? "Collected. Craft the queued items now." : `${collectedCount} of ${checklistEntries.length} checklist rows confirmed`}</p>
              </div>
            </div>

            <div className="craft-step-list">
              {plan.readyCrafts.map((step) => {
                const isOpen = expandedCraftStep === `${step.id}-${step.recipeId}`;
                const isReady = stepIsReady(step);
                return (
                  <article className={`craft-step ${isReady ? "ready" : ""}`} key={`${step.id}-${step.recipeId}`}>
                    <button className="craft-step-head" onClick={() => setExpandedCraftStep(isOpen ? "" : `${step.id}-${step.recipeId}`)}>
                      <span className="slot"><ItemIcon config={config} id={step.id} /></span>
                      <span>
                        <strong>{items[step.id]?.name || step.id}</strong>
                        <em>{isReady ? `Craft ${step.crafts} time${step.crafts === 1 ? "" : "s"}` : "Waiting on materials"}</em>
                      </span>
                      {isReady ? <Check size={16} /> : <Hammer size={16} />}
                    </button>
                    {isOpen ? (
                      <div className="craft-step-detail">
                        <RecipeGrid config={config} recipe={step.recipe} />
                        <button className="primary-action" onClick={() => completeCraft(step)} disabled={!isReady}>
                          <Check size={15} /> Complete craft
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <section className="next-actions">
              <h3>Collection Checklist</h3>
              {checklistEntries.map(([id, qty, completed]) => (
                <label className={`resource-row ${completed || checked[id] ? "done" : ""}`} key={`${id}-${completed ? "completed" : "needed"}`}>
                  <input type="checkbox" checked={Boolean(completed || checked[id])} disabled={Boolean(completed)} onChange={() => setChecked((current) => ({ ...current, [id]: !current[id] }))} />
                  <span className="checkmark"><Check size={14} /></span>
                  <span className="slot"><ItemIcon config={config} id={id} /></span>
                  <span className="resource-copy">
                    <strong>{items[id].name}</strong>
                    <em>{completed ? "Crafted and confirmed in your inventory." : items[id].notes}</em>
                  </span>
                  <b>x{qty}</b>
                </label>
              ))}
            </section>
          </>
        ) : null}
      </aside> : null}
      {mode === "browser" && rightRailVisible && itemPage ? (
        <aside className="checklist item-switcher">
          <div className="panel-title">
            <span>All Items</span>
            <strong>{searchableIds.length}</strong>
          </div>
          <div className="item-switcher-grid">
            {searchableIds.map((id) => (
              <button className={`item-switcher-card ${itemPage === id ? "active" : ""}`} key={id} onClick={() => { setItemPage(id); setItemModal(""); }} title={items[id].name} aria-label={`View ${items[id].name}`}>
                <span className="slot"><ItemIcon config={config} id={id} size={24} /></span>
              </button>
            ))}
          </div>
        </aside>
      ) : mode === "browser" && rightRailVisible ? (
        <ItemInspector
          config={config}
          itemId={itemModal || itemPage}
          recipes={(itemModal || itemPage) ? recipeLookup[itemModal || itemPage] || [] : []}
          usedIn={(itemModal || itemPage) ? recipesUsingItem(config, itemModal || itemPage) : []}
          canEdit={currentIsEditable && !currentIsLocked}
          onSaveItem={saveItemDetails}
          onOpenPage={openItemPage}
        />
      ) : null}
      {mode === "browser" && rightRailVisible ? null : <ItemInfoModal
        config={config}
        itemId={itemModal}
        recipes={modalRecipes}
        usedIn={modalUsedIn}
        onClose={() => setItemModal("")}
        onOpenPage={() => openItemPage(itemModal)}
      />}
    </main>
  );
}
