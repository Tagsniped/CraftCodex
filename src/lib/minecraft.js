import { normalizeMinecraftId, titleFromId, recipeResultId, recipeResultQty, ingredientChoices } from "./utils.js";
import { readZipFile } from "./zip.js";

function resolveMinecraftIngredient(value, tagLookup) {
  if (!value) return "";
  if (value.startsWith("#")) {
    const tagId = value.slice(1);
    const options = tagLookup[tagId] || tagLookup[`minecraft:${tagId}`] || [];
    return normalizeMinecraftId(options[0] || `tag:${tagId}`);
  }
  return normalizeMinecraftId(value);
}

function textureNameFromModelRef(value = "") {
  return normalizeMinecraftId(value).replace(/^(block|item)\//, "");
}

function firstTextureFromModel(model, modelLookup, seen = new Set()) {
  if (!model || seen.has(model)) return "";
  seen.add(model);
  const textures = model.textures || {};
  const directTexture = Object.values(textures).find((value) => typeof value === "string" && !value.startsWith("#"));
  if (directTexture) return textureNameFromModelRef(directTexture);
  const parent = model.parent ? modelLookup[textureNameFromModelRef(model.parent)] : null;
  return firstTextureFromModel(parent, modelLookup, seen);
}

export function minecraftRecipeToCraftpath(fileName, rawRecipe, tagLookup) {
  const resultId = normalizeMinecraftId(recipeResultId(rawRecipe.result));
  if (!resultId) return null;
  const recipeType = rawRecipe.type || "";
  const stationByType = {
    "minecraft:crafting_shaped": "Crafting Table",
    "minecraft:crafting_shapeless": "Crafting Table",
    "minecraft:smelting": "Furnace",
    "minecraft:blasting": "Furnace",
    "minecraft:smoking": "Furnace",
    "minecraft:campfire_cooking": "Furnace",
    "minecraft:smithing_transform": "Smithing Table",
    "minecraft:smithing_trim": "Smithing Table",
  };
  const ingredients = {};
  let grid = [];
  function addIngredient(id, qty = 1) {
    if (!id) return;
    ingredients[id] = (ingredients[id] || 0) + qty;
  }

  if (recipeType === "minecraft:crafting_shaped") {
    const key = rawRecipe.key || {};
    grid = (rawRecipe.pattern || []).map((row) => {
      const slots = row.split("").map((mark) => {
        const choice = ingredientChoices(key[mark])[0];
        const id = mark.trim() ? resolveMinecraftIngredient(choice, tagLookup) : "";
        addIngredient(id, id ? 1 : 0);
        return id;
      });
      return [...slots, "", "", ""].slice(0, 3);
    });
    while (grid.length < 3) grid.push(["", "", ""]);
  } else if (recipeType === "minecraft:crafting_shapeless") {
    const ids = (rawRecipe.ingredients || []).map((ingredient) => resolveMinecraftIngredient(ingredientChoices(ingredient)[0], tagLookup)).filter(Boolean);
    ids.forEach((id) => addIngredient(id));
    grid = [ids.slice(0, 3), ids.slice(3, 6), ids.slice(6, 9)].map((row) => [...row, "", "", ""].slice(0, 3));
  } else if (stationByType[recipeType] === "Furnace") {
    const id = resolveMinecraftIngredient(ingredientChoices(rawRecipe.ingredient)[0], tagLookup);
    addIngredient(id);
    grid = [[id, "", ""], ["fuel", "", ""], ["", "", ""]];
  } else if (stationByType[recipeType] === "Smithing Table") {
    const template = resolveMinecraftIngredient(ingredientChoices(rawRecipe.template)[0], tagLookup);
    const base = resolveMinecraftIngredient(ingredientChoices(rawRecipe.base)[0], tagLookup);
    const addition = resolveMinecraftIngredient(ingredientChoices(rawRecipe.addition)[0], tagLookup);
    [template, base, addition].forEach((id) => addIngredient(id));
    grid = [[template, base, addition]];
  } else {
    return null;
  }

  return {
    id: fileName.replace(/^recipes\//, "").replace(/\.json$/, ""),
    output: { id: resultId, qty: recipeResultQty(rawRecipe.result) },
    type: stationByType[recipeType] === "Furnace" ? "smelt" : stationByType[recipeType] === "Smithing Table" ? "smith" : "craft",
    station: stationByType[recipeType] || "Crafting Table",
    ingredients,
    grid,
  };
}

export function craftpathPackConfigFromZipFiles(files) {
  if (!files["config.json"]) return null;
  const config = JSON.parse(files["config.json"].text());
  const items = { ...(config.items || {}) };
  Object.entries(items).forEach(([id, item]) => {
    const sprite = item?.sprite || `${id}.png`;
    if (sprite.startsWith("data:") || sprite.startsWith("/")) return;
    const spriteEntry = files[`sprites/${sprite}`] || files[`./sprites/${sprite}`];
    if (spriteEntry) {
      items[id] = { ...item, sprite: spriteEntry.dataUrl() };
    }
  });
  return {
    ...config,
    meta: {
      ...(config.meta || {}),
      spriteBase: "",
    },
    tags: config.tags || {},
    items,
  };
}

export async function minecraftZipToConfig(file, importEditable = false, stableId = "") {
  const files = await readZipFile(file);
  const craftpathConfig = craftpathPackConfigFromZipFiles(files);
  if (craftpathConfig) {
    return {
      ...craftpathConfig,
      meta: {
        ...(craftpathConfig.meta || {}),
        id: stableId || `${craftpathConfig.meta?.id || file.name.replace(/\.zip$/i, "")}-${Date.now()}`,
        editable: Boolean(importEditable || craftpathConfig.meta?.editable),
      },
    };
  }
  const manifest = files["manifest.json"] ? JSON.parse(files["manifest.json"].text()) : {};
  const tagLookup = {};
  Object.entries(files).forEach(([name, entry]) => {
    if (!name.startsWith("tags/") || !name.endsWith(".json")) return;
    const tagId = `minecraft:${name.replace(/^tags\/(?:item\/)?/, "").replace(/\.json$/, "")}`;
    const values = JSON.parse(entry.text()).values || [];
    tagLookup[tagId] = values.map((value) => typeof value === "string" ? value : value.id).filter(Boolean);
  });

  const spriteById = {};
  Object.entries(files).forEach(([name, entry]) => {
    if (!name.startsWith("sprites/") || !name.endsWith(".png")) return;
    const id = name.split("/").pop().replace(/\.png$/, "");
    spriteById[id] = entry.dataUrl();
  });
  const modelLookup = {};
  const itemModelRefs = {};
  const itemModelIds = new Set();
  Object.entries(files).forEach(([name, entry]) => {
    if (!name.endsWith(".json")) return;
    const shortName = name.split("/").pop().replace(/\.json$/, "");
    if (name.startsWith("block_models/") || name.startsWith("models/block/")) {
      modelLookup[shortName] = JSON.parse(entry.text());
    }
    if (name.startsWith("item_models/") || name.startsWith("models/item/") || name.startsWith("items/")) {
      itemModelIds.add(shortName);
      const itemModel = JSON.parse(entry.text());
      const modelRef = itemModel.model?.model || itemModel.parent || itemModel.model;
      if (typeof modelRef === "string") itemModelRefs[shortName] = textureNameFromModelRef(modelRef);
      const directTexture = firstTextureFromModel(itemModel, modelLookup);
      if (directTexture) itemModelRefs[shortName] = directTexture;
    }
  });
  const spriteForImportedItem = (id) => {
    const direct = spriteById[id];
    if (direct) return direct;
    const textureId = itemModelRefs[id];
    if (!textureId) return `${id}.png`;
    const modelTexture = firstTextureFromModel(modelLookup[textureId], modelLookup) || textureId;
    return spriteById[modelTexture] || spriteById[textureId] || `${id}.png`;
  };

  const items = {};
  const recipes = [];
  const ensureItem = (id, overrides = {}) => {
    if (!id) return;
    items[id] = {
      name: titleFromId(id),
      category: overrides.category || "Imported",
      method: overrides.method || "craft",
      sprite: spriteForImportedItem(id),
      notes: overrides.notes || "",
      ...(items[id] || {}),
      ...overrides,
    };
  };
  ensureItem("fuel", { name: "Fuel", category: "Raw", method: "find", notes: "Any valid furnace fuel." });

  Object.entries(files).forEach(([name, entry]) => {
    if (!name.startsWith("recipes/") || !name.endsWith(".json")) return;
    const rawRecipe = JSON.parse(entry.text());
    const recipe = minecraftRecipeToCraftpath(name, rawRecipe, tagLookup);
    if (!recipe) return;
    recipes.push(recipe);
    ensureItem(recipe.output.id, { category: titleFromId(rawRecipe.category || "Imported"), method: recipe.type });
    Object.keys(recipe.ingredients).forEach((id) => ensureItem(id, { category: "Ingredient" }));
  });
  itemModelIds.forEach((id) => ensureItem(id, { category: items[id]?.category || "Item" }));

  const baseId = manifest.id || file.name.replace(/\.zip$/i, "") || `minecraft-pack-${Date.now()}`;
  return {
    meta: {
      id: `${baseId}-${Date.now()}`,
      name: manifest.name || titleFromId(baseId),
      type: manifest.type || "minecraft-version",
      spriteBase: "",
      editable: Boolean(importEditable || manifest.editable),
      locked: !importEditable && manifest.locked !== false,
      source: manifest.source || { format: "minecraft-generated-data" },
    },
    stations: {
      "Crafting Table": { layout: "grid", columns: 3, rows: 3 },
      "Inventory": { layout: "grid", columns: 2, rows: 2 },
      "Furnace": { layout: "furnace", slots: ["input", "fuel", "output"] },
      "Smithing Table": { layout: "smithing", slots: ["template", "base", "addition", "output"] },
    },
    tags: tagLookup,
    items,
    recipes,
  };
}
