export const CRAFTING_MENU_STYLES = {
  grid_3x3: { label: "3 x 3 crafting grid", type: "craft", station: "Crafting Table", stationDef: { layout: "grid", columns: 3, rows: 3 } },
  grid_2x2: { label: "2 x 2 crafting grid", type: "craft", station: "Inventory", stationDef: { layout: "grid", columns: 2, rows: 2 } },
  furnace: { label: "Furnace layout", type: "smelt", station: "Furnace", stationDef: { layout: "furnace", slots: ["input", "fuel", "output"] } },
  brewing: { label: "Brewing stand layout", type: "brew", station: "Brewing Stand", stationDef: { layout: "brewing", slots: ["ingredient", "fuel", "bottle_1", "bottle_2", "bottle_3", "output"] } },
  smithing: { label: "Smithing table layout", type: "smith", station: "Smithing Table", stationDef: { layout: "smithing", slots: ["template", "base", "addition", "output"] } },
};

export function recipeGridFromFlat(flatGrid) {
  return [0, 3, 6].map((start) => flatGrid.slice(start, start + 3));
}

export function ingredientsFromGrid(grid) {
  return grid.flat().reduce((ingredients, id) => {
    if (id) ingredients[id] = (ingredients[id] || 0) + 1;
    return ingredients;
  }, {});
}

export function parseRecipeDraft(recipeDraft) {
  try {
    return JSON.parse(recipeDraft);
  } catch {
    return null;
  }
}

export function stationMatchesStyle(station, style) {
  if (!station || !style) return false;
  if (station.layout !== style.stationDef.layout) return false;
  if (station.layout === "grid") {
    return (station.columns || 3) === style.stationDef.columns && (station.rows || 3) === style.stationDef.rows;
  }
  return true;
}
