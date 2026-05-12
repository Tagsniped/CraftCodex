import { useState, useEffect } from "react";
import { ingredientDisplayId, ingredientDisplayName, tagChoices, isTagIngredient, tagKey } from "../lib/utils.js";
import { spriteFor } from "../lib/sprite.js";
import ItemIcon from "./ItemIcon.jsx";

export default function RecipeGrid({ config, recipe, tagSelections = {}, onTagSelect, interactiveTags = false }) {
  const stations = config.stations || {};
  const station = stations[recipe?.station] || stations[recipe?.type] || { layout: "grid", columns: 3, rows: 3 };
  const grid = recipe?.grid || [["", "", ""], ["", "", ""], ["", "", ""]];
  const outputId = recipe?.output?.id;
  const outputQty = recipe?.output?.qty || 1;
  const flatGrid = grid.flat();
  const hasTags = flatGrid.some(isTagIngredient) || Object.keys(recipe?.ingredients || {}).some(isTagIngredient);
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    if (!hasTags || interactiveTags) return undefined;
    const timer = window.setInterval(() => setCycleIndex((value) => value + 1), 1600);
    return () => window.clearInterval(timer);
  }, [hasTags, interactiveTags]);

  function slot(id, key, extra = "") {
    const resolvedId = ingredientDisplayId(config, id, tagSelections, cycleIndex);
    const choices = tagChoices(config, id);
    const name = ingredientDisplayName(config, id, resolvedId);
    const keyId = tagKey(id);
    return (
      <div className={`recipe-slot ${extra} ${isTagIngredient(id) ? "tag-slot" : ""}`} key={key}>
        {id ? (
          <>
            {resolvedId ? <img src={spriteFor(config, resolvedId)} alt="" /> : null}
            {interactiveTags && choices.length > 1 ? (
              <select
                className="tag-choice-select"
                value={tagSelections[keyId] || choices[0]}
                aria-label={`Choose item for ${keyId}`}
                onChange={(event) => onTagSelect?.(keyId, event.target.value)}
              >
                {choices.map((choice) => (
                  <option value={choice} key={choice}>{config.items[choice]?.name || choice}</option>
                ))}
              </select>
            ) : (
              <span>{name}</span>
            )}
          </>
        ) : null}
      </div>
    );
  }

  if (station.layout === "furnace") {
    return (
      <div className="station-recipe furnace-layout" aria-label={`${recipe.station} recipe`}>
        <div className="station-stack">
          {slot(flatGrid[0], "input")}
          {slot(flatGrid[3] || flatGrid[1], "fuel", "fuel-slot")}
        </div>
        <div className="recipe-arrow">→</div>
        <div className="recipe-slot output-slot">
          <img src={spriteFor(config, outputId)} alt="" />
          <span>{config.items[outputId]?.name || outputId}{outputQty > 1 ? ` x${outputQty}` : ""}</span>
        </div>
      </div>
    );
  }

  if (station.layout === "smithing") {
    return (
      <div className="station-recipe smithing-layout" aria-label={`${recipe.station} recipe`}>
        {(station.slots || [flatGrid[0], flatGrid[1], flatGrid[2]]).map((slotDef, index) => slot(typeof slotDef === "string" ? slotDef : flatGrid[index], `smith-${index}`))}
        <div className="recipe-arrow">→</div>
        <div className="recipe-slot output-slot">
          <img src={spriteFor(config, outputId)} alt="" />
          <span>{config.items[outputId]?.name || outputId}{outputQty > 1 ? ` x${outputQty}` : ""}</span>
        </div>
      </div>
    );
  }

  if (station.layout === "brewing") {
    return (
      <div className="station-recipe brewing-layout" aria-label={`${recipe.station} recipe`}>
        {slot(flatGrid[0], "ingredient", "brewing-ingredient")}
        {slot(flatGrid[3] || flatGrid[1], "fuel", "fuel-slot")}
        <div className="brewing-bottles">
          {slot(flatGrid[6] || flatGrid[2], "bottle-1")}
          {slot(flatGrid[7] || flatGrid[4], "bottle-2")}
          {slot(flatGrid[8] || flatGrid[5], "bottle-3")}
        </div>
        <div className="recipe-arrow">→</div>
        <div className="recipe-slot output-slot">
          <img src={spriteFor(config, outputId)} alt="" />
          <span>{config.items[outputId]?.name || outputId}{outputQty > 1 ? ` x${outputQty}` : ""}</span>
        </div>
      </div>
    );
  }

  const columns = station.columns || 3;
  return (
    <div className="recipe-grid compact" style={{ "--recipe-columns": columns }} aria-label={`${recipe?.station || "Recipe"} grid`}>
      {flatGrid.map((id, index) => slot(id, `${id}-${index}`))}
    </div>
  );
}
