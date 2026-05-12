import { useState } from "react";
import { CRAFTING_MENU_STYLES, stationMatchesStyle } from "../lib/builder.js";

export default function NewRecipeStarter({ config, currentIsLocked, onCreateRecipe, compact = false }) {
  const [styleId, setStyleId] = useState("grid_3x3");
  const [stationChoice, setStationChoice] = useState("default");
  const [customStationName, setCustomStationName] = useState("");
  const style = CRAFTING_MENU_STYLES[styleId];
  const compatibleStations = Object.entries(config.stations || {})
    .filter(([, station]) => stationMatchesStyle(station, style))
    .map(([name]) => name)
    .sort();
  const defaultStation = compatibleStations.includes(style.station) ? style.station : compatibleStations[0] || style.station;
  const selectedStation = stationChoice === "default" ? defaultStation : stationChoice;
  const willCreateStation = stationChoice === "custom";

  function createRecipe() {
    if (currentIsLocked) return;
    const stationName = willCreateStation ? customStationName.trim() : selectedStation;
    if (!stationName) return;
    const recipe = {
      id: `recipe-${Date.now()}`,
      output: { id: "", qty: 1 },
      type: style.type,
      station: stationName,
      ingredients: {},
      grid: [["", "", ""], ["", "", ""], ["", "", ""]],
    };
    onCreateRecipe(recipe, willCreateStation ? stationName : "", willCreateStation ? style.stationDef : null);
  }

  return (
    <div className={`new-recipe-starter ${compact ? "compact" : ""}`}>
      <label>
        Crafting menu style
        <select value={styleId} disabled={currentIsLocked} onChange={(event) => { setStyleId(event.target.value); setStationChoice("default"); }}>
          {Object.entries(CRAFTING_MENU_STYLES).map(([id, option]) => (
            <option value={id} key={id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        Crafting block
        <select value={stationChoice} disabled={currentIsLocked} onChange={(event) => setStationChoice(event.target.value)}>
          <option value="default">Use default: {defaultStation}</option>
          {compatibleStations.map((name) => (
            <option value={name} key={name}>Use existing: {name}</option>
          ))}
          <option value="custom">Create new crafting block</option>
        </select>
      </label>
      {willCreateStation ? (
        <label>
          New crafting block name
          <input
            value={customStationName}
            disabled={currentIsLocked}
            onChange={(event) => setCustomStationName(event.target.value)}
            placeholder="Enhanced Crafting Table"
          />
        </label>
      ) : null}
      <p>{willCreateStation ? "The new block will reuse this menu layout and be saved into this recipe pack." : "The recipe will use the selected existing crafting block."}</p>
      <button onClick={createRecipe} disabled={currentIsLocked || (willCreateStation && !customStationName.trim())}>Create visual recipe</button>
    </div>
  );
}
