import { useState, useMemo } from "react";
import { CRAFTING_MENU_STYLES, parseRecipeDraft, recipeGridFromFlat, ingredientsFromGrid, stationMatchesStyle } from "../lib/builder.js";
import ItemIcon from "./ItemIcon.jsx";

export default function RecipeVisualEditor({ config, recipeDraft, setRecipeDraft, currentIsLocked, compact = false }) {
  const [activeSlot, setActiveSlot] = useState(null);
  const itemIds = useMemo(() => Object.keys(config.items).sort((a, b) => config.items[a].name.localeCompare(config.items[b].name)), [config]);
  const stationNames = useMemo(() => Object.keys(config.stations || {}).sort(), [config]);
  const recipe = parseRecipeDraft(recipeDraft);

  if (!recipe) {
    return (
      <div className="visual-recipe-editor empty">
        <p>Choose a recipe or create a new one to use the visual editor.</p>
      </div>
    );
  }

  const station = config.stations?.[recipe.station] || config.stations?.[recipe.type] || { layout: "grid", columns: 3, rows: 3 };
  const flatGrid = [...(recipe.grid || [["", "", ""], ["", "", ""], ["", "", ""]]).flat()];
  while (flatGrid.length < 9) flatGrid.push("");
  const outputId = recipe.output?.id || "";
  const outputQty = recipe.output?.qty || 1;
  const currentStyleId = Object.entries(CRAFTING_MENU_STYLES).find(([, style]) => stationMatchesStyle(station, style))?.[0] || "grid_3x3";
  const compatibleStations = Object.entries(config.stations || {})
    .filter(([, candidate]) => stationMatchesStyle(candidate, CRAFTING_MENU_STYLES[currentStyleId]))
    .map(([name]) => name)
    .sort();

  function updateRecipe(updater) {
    const nextRecipe = updater({ ...recipe, output: { qty: 1, ...(recipe.output || {}) } });
    const nextFlat = [...(nextRecipe.grid || recipe.grid || [["", "", ""], ["", "", ""], ["", "", ""]]).flat()];
    while (nextFlat.length < 9) nextFlat.push("");
    const nextGrid = recipeGridFromFlat(nextFlat);
    const normalized = {
      ...nextRecipe,
      grid: nextGrid,
      ingredients: ingredientsFromGrid(nextGrid),
    };
    setRecipeDraft(JSON.stringify(normalized, null, 2));
  }

  function setSlot(index, value) {
    updateRecipe((draft) => {
      const nextFlat = [...flatGrid];
      nextFlat[index] = value;
      return { ...draft, grid: recipeGridFromFlat(nextFlat) };
    });
  }

  function setField(field, value) {
    updateRecipe((draft) => ({ ...draft, [field]: value }));
  }

  function setOutput(field, value) {
    updateRecipe((draft) => ({ ...draft, output: { ...(draft.output || {}), [field]: value } }));
  }

  function setStation(stationName) {
    const nextStation = config.stations?.[stationName] || {};
    updateRecipe((draft) => ({ ...draft, station: stationName, type: nextStation.layout || draft.type || "craft" }));
  }

  function setMenuStyle(styleId) {
    const nextStyle = CRAFTING_MENU_STYLES[styleId];
    const nextStation = Object.entries(config.stations || {}).find(([, candidate]) => stationMatchesStyle(candidate, nextStyle))?.[0] || nextStyle.station;
    updateRecipe((draft) => ({ ...draft, station: nextStation, type: nextStyle.type }));
    setActiveSlot(null);
  }

  function slotButton(index, label = "") {
    const id = flatGrid[index] || "";
    return (
      <button
        type="button"
        className={`recipe-pick-slot ${activeSlot === index ? "active" : ""} ${id ? "filled" : ""}`}
        onClick={() => setActiveSlot(activeSlot === index ? null : index)}
        disabled={currentIsLocked}
        key={index}
      >
        {id ? <ItemIcon config={config} id={id} size={compact ? 22 : 30} /> : <span className="empty-plus">+</span>}
        <em>{id ? config.items[id]?.name || id : label || "Empty"}</em>
      </button>
    );
  }

  function outputSlot() {
    return (
      <div className={`recipe-pick-slot output-preview ${outputId ? "filled" : ""}`}>
        {outputId ? <ItemIcon config={config} id={outputId} size={compact ? 24 : 32} /> : <span className="empty-plus">?</span>}
        <em>{outputId ? `${config.items[outputId]?.name || outputId} x${outputQty}` : "Output"}</em>
      </div>
    );
  }

  let layout;
  if (station.layout === "furnace") {
    layout = (
      <div className="recipe-builder-layout furnace-builder">
        <div className="station-stack">{slotButton(0, "Input")}{slotButton(3, "Fuel")}</div>
        <div className="recipe-arrow">→</div>
        {outputSlot()}
      </div>
    );
  } else if (station.layout === "smithing") {
    layout = (
      <div className="recipe-builder-layout smithing-builder">
        {[0, 1, 2].map((index) => slotButton(index, ["Template", "Base", "Addition"][index]))}
        <div className="recipe-arrow">→</div>
        {outputSlot()}
      </div>
    );
  } else if (station.layout === "brewing") {
    layout = (
      <div className="recipe-builder-layout brewing-builder">
        {slotButton(0, "Ingredient")}
        {slotButton(3, "Fuel")}
        <div className="brewing-builder-bottles">{[6, 7, 8].map((index) => slotButton(index, "Bottle"))}</div>
        <div className="recipe-arrow">→</div>
        {outputSlot()}
      </div>
    );
  } else {
    const columns = station.columns || 3;
    layout = (
      <div className="recipe-builder-layout shaped-builder">
        <div className="visual-grid" style={{ "--recipe-columns": columns }}>
          {flatGrid.slice(0, (station.rows || 3) * columns).map((_, index) => slotButton(index))}
        </div>
        <div className="recipe-arrow">→</div>
        {outputSlot()}
      </div>
    );
  }

  return (
    <div className={`visual-recipe-editor ${compact ? "compact" : ""}`}>
      <div className="recipe-form-grid">
        <label>
          Recipe id
          <input value={recipe.id || ""} disabled={currentIsLocked} onChange={(event) => setField("id", event.target.value)} />
        </label>
        <label>
          Crafting menu style
          <select value={currentStyleId} disabled={currentIsLocked} onChange={(event) => setMenuStyle(event.target.value)}>
            {Object.entries(CRAFTING_MENU_STYLES).map(([id, option]) => (
              <option value={id} key={id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Crafting block
          <select value={recipe.station || ""} disabled={currentIsLocked} onChange={(event) => setStation(event.target.value)}>
            {compatibleStations.map((name) => <option value={name} key={name}>{name}</option>)}
            {!compatibleStations.includes(recipe.station) && recipe.station ? <option value={recipe.station}>{recipe.station}</option> : null}
            {stationNames.filter((name) => !compatibleStations.includes(name) && name !== recipe.station).map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>
        <label>
          Output
          <select value={outputId} disabled={currentIsLocked} onChange={(event) => setOutput("id", event.target.value)}>
            <option value="">Choose output item</option>
            {itemIds.map((id) => <option value={id} key={id}>{config.items[id].name}</option>)}
          </select>
        </label>
        <label>
          Output qty
          <input type="number" min="1" value={outputQty} disabled={currentIsLocked} onChange={(event) => setOutput("qty", Math.max(1, Number(event.target.value)))} />
        </label>
      </div>

      {layout}

      {activeSlot !== null ? (
        <div className="slot-picker">
          <label>
            Ingredient for selected slot
            <select value={flatGrid[activeSlot] || ""} disabled={currentIsLocked} onChange={(event) => setSlot(activeSlot, event.target.value)}>
              <option value="">Empty slot</option>
              {itemIds.map((id) => <option value={id} key={id}>{config.items[id].name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setSlot(activeSlot, "")} disabled={currentIsLocked}>Clear slot</button>
        </div>
      ) : (
        <p className="recipe-builder-hint">Click any slot to choose an ingredient.</p>
      )}
    </div>
  );
}
