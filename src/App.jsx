import { useEffect, useMemo, useState } from "react";
import { BUILT_IN_CONFIGS, STARTING_GOALS, loadConfigFile } from "./lib/config.js";
import { ACCENT_COLORS } from "./lib/theme.js";
import { isTagIngredient, tagKey, tagChoices } from "./lib/utils.js";
import { recipesByOutput, recipesUsingItem, scaleIngredients, computePlan, addQty } from "./lib/plan.js";
import { minecraftZipToConfig } from "./lib/minecraft.js";
import AppHeader from "./components/AppHeader.jsx";
import LeftSidebar from "./components/LeftSidebar.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import PlannerView from "./components/PlannerView.jsx";
import BrowserView from "./components/BrowserView.jsx";
import BuilderView from "./components/BuilderView.jsx";
import RightChecklist from "./components/RightChecklist.jsx";
import ItemInfoModal from "./components/ItemInfoModal.jsx";
import ItemInspector from "./components/ItemInspector.jsx";
import ItemPage from "./components/ItemPage.jsx";
import ItemSwitcher from "./components/ItemSwitcher.jsx";

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
  const [accent, setAccent] = useState(() => localStorage.getItem("craftpath.accent") || "amber");
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
  }, [configId, customConfigs]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const hue = (ACCENT_COLORS[accent] || ACCENT_COLORS.amber).hue;
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.setProperty("--accent-hue", hue);
    localStorage.setItem("craftpath.themeMode", themeMode);
    localStorage.setItem("craftpath.accent", accent);
  }, [themeMode, accent]);

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

  const workspaceTitle = mode === "planner" ? "Needed Materials"
    : mode === "builder" ? "Recipe Builder"
    : mode === "settings" ? "Settings"
    : itemPage ? items[itemPage]?.name || "Item Page"
    : "Item Browser";

  const workspaceSubtitle = mode === "planner"
    ? "Expand a craftable card, pick a recipe, then add its ingredients to the list."
    : mode === "builder"
      ? "Create editable recipe packs from a base version, then add items and recipes for servers or modpacks."
      : mode === "settings"
        ? "Customize CraftCodex's theme and workspace layout."
        : "Browse items, inspect recipes, and open dedicated item pages.";

  return (
    <main className={`app-shell ${mode === "browser" ? "browser-shell" : ""} ${mode === "browser" && currentIsEditable ? "browser-editor-shell" : ""} ${mode === "builder" ? "builder-shell" : ""} ${mode === "settings" ? "settings-shell" : ""} ${leftSidebarOpen ? "" : "left-collapsed"} ${rightRailVisible ? "" : "right-collapsed"} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <AppHeader
        mode={mode}
        setMode={setMode}
        setItemPage={setItemPage}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        leftSidebarOpen={leftSidebarOpen}
        setLeftSidebarOpen={setLeftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        setRightSidebarOpen={setRightSidebarOpen}
        configId={configId}
        setConfigId={setConfigId}
        allConfigEntries={allConfigEntries}
        selectedConfigEntry={selectedConfigEntry}
      />

      {leftSidebarOpen ? (
        <LeftSidebar
          mode={mode}
          config={config}
          items={items}
          query={query}
          setQuery={setQuery}
          searchResults={searchResults}
          goals={goals}
          updateGoal={updateGoal}
          removeGoal={removeGoal}
          addGoal={addGoal}
          openItemPage={openItemPage}
          browserCategory={browserCategory}
          setBrowserCategory={setBrowserCategory}
          categories={categories}
          browserItems={browserItems}
          currentIsEditable={currentIsEditable}
          currentIsLocked={currentIsLocked}
          toggleCurrentLock={toggleCurrentLock}
          createEditableCopy={createEditableCopy}
        />
      ) : null}

      <section className="workspace">
        <header className="topbar">
          <div>
            <h2>{workspaceTitle}</h2>
            <p>{workspaceSubtitle}</p>
          </div>
        </header>

        {mode === "settings" ? (
          <SettingsPanel themeMode={themeMode} setThemeMode={setThemeMode} accent={accent} setAccent={setAccent} />
        ) : mode === "builder" ? (
          <BuilderView
            config={config}
            configId={configId}
            setConfigId={setConfigId}
            allConfigEntries={allConfigEntries}
            currentIsEditable={currentIsEditable}
            currentIsLocked={currentIsLocked}
            importEditable={importEditable}
            setImportEditable={setImportEditable}
            customText={customText}
            setCustomText={setCustomText}
            handleFileImport={handleFileImport}
            saveEditableConfig={saveEditableConfig}
            createEditableCopy={createEditableCopy}
            toggleCurrentLock={toggleCurrentLock}
            message={message}
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
        ) : mode === "browser" && itemPage ? (
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
        ) : mode === "browser" ? (
          <BrowserView
            items={items}
            config={config}
            categories={categories}
            browserCategory={browserCategory}
            setBrowserCategory={setBrowserCategory}
            browserItems={browserItems}
            browserGroups={browserGroups}
            groupBrowserItems={groupBrowserItems}
            setGroupBrowserItems={setGroupBrowserItems}
            showBrowserNames={showBrowserNames}
            setShowBrowserNames={setShowBrowserNames}
            openItemModal={openItemModal}
          />
        ) : (
          <PlannerView
            materialBoardEntries={materialBoardEntries}
            items={items}
            config={config}
            recipeLookup={recipeLookup}
            recipeChoices={recipeChoices}
            expanded={expanded}
            selectedMaterial={selectedMaterial}
            checked={checked}
            tagSelections={tagSelections}
            handleMaterialCardClick={handleMaterialCardClick}
            changeRecipe={changeRecipe}
            setRecipeTagChoice={setRecipeTagChoice}
            addMaterials={addMaterials}
            setChecked={setChecked}
            openItemModal={openItemModal}
          />
        )}
      </section>

      {mode === "planner" && (rightSidebarOpen || isNarrowViewport) ? (
        <RightChecklist
          checklistEntries={checklistEntries}
          collectedCount={collectedCount}
          allCollected={allCollected}
          items={items}
          config={config}
          plan={plan}
          expandedCraftStep={expandedCraftStep}
          setExpandedCraftStep={setExpandedCraftStep}
          stepIsReady={stepIsReady}
          completeCraft={completeCraft}
          checked={checked}
          setChecked={setChecked}
        />
      ) : null}

      {mode === "browser" && rightRailVisible && itemPage ? (
        <ItemSwitcher
          config={config}
          items={items}
          searchableIds={searchableIds}
          itemPage={itemPage}
          setItemPage={setItemPage}
          setItemModal={setItemModal}
        />
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

      {mode === "browser" && rightRailVisible ? null : (
        <ItemInfoModal
          config={config}
          itemId={itemModal}
          recipes={modalRecipes}
          usedIn={modalUsedIn}
          onClose={() => setItemModal("")}
          onOpenPage={() => openItemPage(itemModal)}
        />
      )}
    </main>
  );
}
