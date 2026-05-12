import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
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
import "./styles.css";

const BASE_URL = import.meta.env.BASE_URL || "/";
const assetUrl = (path) => `${BASE_URL}${path.replace(/^\//, "")}`;

const BUILT_IN_CONFIGS = [
  { id: "minecraft-26.1.2", name: "Minecraft 26.1.2", url: "packs/minecraft-26.1.2.zip", format: "minecraft-zip" },
  { id: "vanilla-1.20", name: "Vanilla 1.20", url: "configs/vanilla-1.20.json" },
  { id: "server-example", name: "Server Example", url: "configs/server-example.json" },
];

const STARTING_GOALS = [
  { id: "enchanting_table", qty: 1 },
  { id: "bookshelf", qty: 15 },
  { id: "diamond_pickaxe", qty: 1 },
  { id: "comparator", qty: 4 },
];

const CRAFTING_MENU_STYLES = {
  grid_3x3: { label: "3 x 3 crafting grid", type: "craft", station: "Crafting Table", stationDef: { layout: "grid", columns: 3, rows: 3 } },
  grid_2x2: { label: "2 x 2 crafting grid", type: "craft", station: "Inventory", stationDef: { layout: "grid", columns: 2, rows: 2 } },
  furnace: { label: "Furnace layout", type: "smelt", station: "Furnace", stationDef: { layout: "furnace", slots: ["input", "fuel", "output"] } },
  brewing: { label: "Brewing stand layout", type: "brew", station: "Brewing Stand", stationDef: { layout: "brewing", slots: ["ingredient", "fuel", "bottle_1", "bottle_2", "bottle_3", "output"] } },
  smithing: { label: "Smithing table layout", type: "smith", station: "Smithing Table", stationDef: { layout: "smithing", slots: ["template", "base", "addition", "output"] } },
};

function mergeConfigs(base, overlay) {
  if (!overlay) return base;
  return {
    meta: { ...base.meta, ...overlay.meta },
    items: { ...base.items, ...overlay.items },
    stations: { ...(base.stations || {}), ...(overlay.stations || {}) },
    tags: { ...(base.tags || {}), ...(overlay.tags || {}) },
    recipes: [...base.recipes, ...(overlay.recipes || [])],
  };
}

async function loadConfigFile(entry) {
  if (entry.format === "minecraft-zip" || entry.url?.toLowerCase().endsWith(".zip")) {
    const blob = await fetch(assetUrl(entry.url)).then((response) => {
      if (!response.ok) throw new Error(`Could not fetch ${entry.url}`);
      return response.blob();
    });
    return minecraftZipToConfig(new File([blob], entry.url.split("/").pop() || `${entry.id}.zip`), false, entry.id);
  }
  const config = await fetch(assetUrl(entry.url)).then((response) => {
    if (!response.ok) throw new Error(`Could not fetch ${entry.url}`);
    return response.json();
  });
  if (config.extends === "vanilla-1.20") {
    const base = await fetch(assetUrl("configs/vanilla-1.20.json")).then((response) => response.json());
    return mergeConfigs(base, config);
  }
  return config;
}

function normalizeMinecraftId(value = "") {
  return String(value).replace(/^minecraft:/, "");
}

function titleFromId(id = "") {
  return normalizeMinecraftId(id)
    .replace(/^#/, "")
    .replace(/^tag:/, "")
    .split(/[_/:.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function tagKey(id = "") {
  return normalizeMinecraftId(String(id).replace(/^#/, "").replace(/^tag:/, ""));
}

function isTagIngredient(id = "") {
  return String(id).startsWith("#") || String(id).startsWith("tag:");
}

function tagChoices(config, id) {
  if (!isTagIngredient(id)) return [];
  const key = tagKey(id);
  const choices = config.tags?.[key] || config.tags?.[`minecraft:${key}`] || [];
  return choices.map(normalizeMinecraftId).filter((choice) => config.items?.[choice]);
}

function ingredientDisplayId(config, id, tagSelections = {}, cycleIndex = 0) {
  if (!isTagIngredient(id)) return id;
  const key = tagKey(id);
  const choices = tagChoices(config, id);
  const selected = tagSelections[key];
  if (selected && choices.includes(selected)) return selected;
  return choices.length ? choices[cycleIndex % choices.length] : "";
}

function ingredientDisplayName(config, id, resolvedId) {
  if (!isTagIngredient(id)) return config.items[id]?.name || id;
  if (resolvedId) return config.items[resolvedId]?.name || titleFromId(resolvedId);
  return `Any ${titleFromId(tagKey(id))}`;
}

function resolveRecipeIngredientTags(config, recipe, tagSelections = {}) {
  const resolved = { ...recipe, ingredients: {}, grid: [] };
  Object.entries(recipe.ingredients || {}).forEach(([id, qty]) => {
    const nextId = ingredientDisplayId(config, id, tagSelections);
    if (nextId) resolved.ingredients[nextId] = (resolved.ingredients[nextId] || 0) + qty;
  });
  resolved.grid = (recipe.grid || []).map((row) => row.map((id) => ingredientDisplayId(config, id, tagSelections) || id));
  return resolved;
}

function recipeResultId(result) {
  if (typeof result === "string") return result;
  return result?.id || result?.item || "";
}

function recipeResultQty(result) {
  return typeof result === "object" && result?.count ? result.count : 1;
}

function ingredientChoices(raw) {
  if (!raw) return [];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.flatMap((entry) => ingredientChoices(entry));
  if (raw.item) return [raw.item];
  if (raw.tag) return [`#${raw.tag}`];
  return [];
}

function parseZipEntries(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Zip directory not found.");
  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = [];
  for (let i = 0; i < totalEntries; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)).replace(/^\.\//, "");
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries.filter((entry) => entry.name && !entry.name.endsWith("/"));
}

async function unzipEntry(buffer, entry) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error(`Bad zip entry: ${entry.name}`);
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + nameLength + extraLength;
  const data = bytes.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") {
    throw new Error(`Unsupported zip compression for ${entry.name}.`);
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipFile(file) {
  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer);
  const decoder = new TextDecoder();
  const files = {};
  await Promise.all(entries.map(async (entry) => {
    const data = await unzipEntry(buffer, entry);
    files[entry.name] = {
      bytes: data,
      text: () => decoder.decode(data),
      dataUrl: () => {
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < data.length; i += chunkSize) {
          binary += String.fromCharCode(...data.slice(i, i + chunkSize));
        }
        return `data:${entry.name.endsWith(".png") ? "image/png" : "application/octet-stream"};base64,${btoa(binary)}`;
      },
    };
  }));
  return files;
}

function craftpathPackConfigFromZipFiles(files) {
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

function minecraftRecipeToCraftpath(fileName, rawRecipe, tagLookup) {
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

async function minecraftZipToConfig(file, importEditable = false, stableId = "") {
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

function recipesByOutput(config) {
  return (config.recipes || []).reduce((lookup, recipe) => {
    const id = recipe.output.id;
    lookup[id] = [...(lookup[id] || []), recipe];
    return lookup;
  }, {});
}

function recipesUsingItem(config, id) {
  return (config.recipes || []).filter((recipe) => Object.keys(recipe.ingredients || {}).includes(id));
}

function addQty(map, id, qty) {
  map[id] = (map[id] || 0) + qty;
  if (map[id] <= 0) delete map[id];
}

function scaleIngredients(recipe, neededQty) {
  const crafts = Math.ceil(neededQty / Math.max(1, recipe.output.qty || 1));
  return {
    crafts,
    ingredients: Object.fromEntries(Object.entries(recipe.ingredients || {}).map(([id, qty]) => [id, qty * crafts])),
  };
}

function computePlan(goals, craftSteps, completedItems, config) {
  const needs = {};
  goals.forEach((goal) => addQty(needs, goal.id, goal.qty));

  const readyCrafts = [];
  craftSteps.forEach((step) => {
    const recipe = config.recipes.find((candidate) => candidate.id === step.recipeId);
    if (!recipe) return;

    addQty(needs, step.id, -step.qty);
    const resolvedRecipe = resolveRecipeIngredientTags(config, recipe, step.tagSelections || {});
    const scaled = scaleIngredients(resolvedRecipe, step.qty);
    Object.entries(scaled.ingredients).forEach(([id, qty]) => addQty(needs, id, qty));
    readyCrafts.push({ ...step, recipe: resolvedRecipe, sourceRecipe: recipe, crafts: scaled.crafts });
  });

  Object.entries(completedItems).forEach(([id, qty]) => addQty(needs, id, -qty));

  return { needs, readyCrafts };
}

function spriteFor(config, id, seen = new Set()) {
  if (seen.has(id)) return assetUrl(`sprites/${id}.svg`);
  seen.add(id);
  const item = config.items[id];
  const sprite = item?.sprite;
  if (sprite && typeof sprite === "object") {
    if (sprite.type === "item" && sprite.id) return spriteFor(config, sprite.id, seen);
    if (sprite.type === "player_head") return playerHeadDataUrl(sprite.texture || sprite.value || sprite.username || "");
    if (sprite.src) return sprite.src;
  }
  const base = config.meta?.spriteBase || "sprites/";
  if (typeof sprite === "string") {
    if (sprite.startsWith("item:")) return spriteFor(config, sprite.slice("item:".length), seen);
    if (sprite.startsWith("player_head:")) return playerHeadDataUrl(sprite.slice("player_head:".length));
    if (sprite.startsWith("data:") || sprite.startsWith("blob:")) return sprite;
    if (sprite.startsWith("/")) return assetUrl(sprite);
    if (config.items[sprite]) return spriteFor(config, sprite, seen);
  }
  return assetUrl(`${base}${sprite || `${id}.svg`}`);
}

function playerHeadDataUrl(value = "") {
  const seed = [...String(value || "player_head")].reduce((total, char) => total + char.charCodeAt(0), 0);
  const hue = seed % 360;
  const face = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" shape-rendering="crispEdges">
      <rect width="32" height="32" fill="hsl(${hue},48%,42%)"/>
      <rect x="4" y="4" width="24" height="24" fill="hsl(${hue},42%,58%)"/>
      <rect x="8" y="10" width="5" height="5" fill="#1d1712"/>
      <rect x="19" y="10" width="5" height="5" fill="#1d1712"/>
      <rect x="10" y="21" width="12" height="3" fill="#6b3028"/>
      <rect x="4" y="4" width="24" height="4" fill="rgba(0,0,0,.2)"/>
    </svg>
  `);
  return `data:image/svg+xml,${face}`;
}

function ItemIcon({ config, id, size = 24 }) {
  const item = config.items[id];
  return <img className="item-art" src={spriteFor(config, id)} width={size} height={size} alt={item?.name || id} />;
}

function RecipeGrid({ config, recipe, tagSelections = {}, onTagSelect, interactiveTags = false }) {
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
                aria-label={`Choose item for ${titleFromId(keyId)}`}
                onChange={(event) => onTagSelect?.(keyId, event.target.value)}
              >
                {choices.map((choice) => (
                  <option value={choice} key={choice}>{config.items[choice]?.name || titleFromId(choice)}</option>
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
      {flatGrid.map((id, index) => (
        slot(id, `${id}-${index}`)
      ))}
    </div>
  );
}

function ItemInfoModal({ config, itemId, recipes, usedIn, onClose, onOpenPage }) {
  if (!itemId) return null;
  const item = config.items[itemId];
  const primaryRecipe = recipes[0];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="item-modal" onClick={(event) => event.stopPropagation()}>
        <header className="item-modal-head">
          <span className="slot jumbo"><ItemIcon config={config} id={itemId} size={42} /></span>
          <div>
            <h2>{item?.name || itemId}</h2>
            <p>{item?.category || "Item"} · {recipes.length ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : item?.method}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close item info"><X size={17} /></button>
        </header>
        {primaryRecipe ? (
          <div className="modal-recipe">
            <RecipeGrid config={config} recipe={primaryRecipe} />
            <div>
              <strong>{primaryRecipe.station}</strong>
              <p>{primaryRecipe.type} · {primaryRecipe.output.qty || 1} per craft</p>
            </div>
          </div>
        ) : (
          <p className="plain-note">{item?.notes || "No recipe is configured for this item."}</p>
        )}
        {primaryRecipe && item?.notes ? <p className="plain-note">{item.notes}</p> : null}
        <div className="modal-foot">
          <span>Used in {usedIn.length} recipe{usedIn.length === 1 ? "" : "s"}</span>
          <button className="primary-action" onClick={onOpenPage}>View full item page</button>
        </div>
      </article>
    </div>
  );
}

function ItemInspector({ config, itemId, recipes, usedIn, canEdit, onEdit, onOpenPage }) {
  if (!itemId) {
    return (
      <aside className="checklist item-inspector">
        <div className="inspector-empty">
          <Info size={24} />
          <h2>Item Info</h2>
          <p>Select an item to see its recipe, notes, and related recipes here.</p>
        </div>
      </aside>
    );
  }

  const item = config.items[itemId];
  const primaryRecipe = recipes[0];
  return (
    <aside className="checklist item-inspector">
      <header className="inspector-head">
        <span className="slot jumbo"><ItemIcon config={config} id={itemId} size={42} /></span>
        <div>
          <h2>{item?.name || itemId}</h2>
          <p>{item?.category || "Item"} · {recipes.length ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : item?.method}</p>
        </div>
      </header>
      <p className="inspector-note">{item?.notes || "No extra notes are configured for this item yet."}</p>
      {primaryRecipe ? (
        <div className="inspector-recipe">
          <RecipeGrid config={config} recipe={primaryRecipe} />
          <div>
            <strong>{primaryRecipe.station}</strong>
            <p>{primaryRecipe.type} · {primaryRecipe.output.qty || 1} per craft</p>
          </div>
        </div>
      ) : (
        <p className="inspector-note">No recipe is configured for this item.</p>
      )}
      <div className="inspector-actions">
        {canEdit ? <button className="primary-action" onClick={() => onEdit(itemId, primaryRecipe)}><FileJson size={15} /> Edit item</button> : null}
        <button className="primary-action" onClick={() => onOpenPage(itemId)}>View full item page</button>
      </div>
      <section className="inspector-related">
        <h3>Used in {usedIn.length} recipe{usedIn.length === 1 ? "" : "s"}</h3>
        {usedIn.length ? usedIn.slice(0, 8).map((recipe) => (
          <button key={recipe.id} onClick={() => onOpenPage(recipe.output.id)}>
            <ItemIcon config={config} id={recipe.output.id} size={22} />
            <span>{config.items[recipe.output.id]?.name || recipe.output.id}</span>
          </button>
        )) : <p>No configured recipes use this item yet.</p>}
      </section>
    </aside>
  );
}

function ItemPage({ config, itemId, recipes, usedIn, onBack, onQuickInfo, canEdit, onEdit }) {
  const item = config.items[itemId];
  return (
    <section className="item-page">
      <div className="item-page-actions">
        <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to recipes</button>
        {canEdit ? <button className="primary-action edit-item-action" onClick={() => onEdit(itemId, recipes[0])}><FileJson size={15} /> Edit item</button> : null}
      </div>
      <header className="item-page-hero">
        <span className="slot hero-slot"><ItemIcon config={config} id={itemId} size={64} /></span>
        <div>
          <h2>{item?.name || itemId}</h2>
          <p>{config.meta?.name} · {item?.category || "Item"} · {recipes.length ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : item?.method}</p>
        </div>
      </header>

      <section className="info-panel">
        <p>{item?.notes || "No extra notes are configured for this item yet."}</p>
      </section>

      <section className="info-panel">
        <h3>Crafting Recipes</h3>
        {recipes.length ? recipes.map((recipe) => (
          <div className="recipe-page-row" key={recipe.id}>
            <RecipeGrid config={config} recipe={recipe} />
            <div>
              <strong>{recipe.station}</strong>
              <p>{recipe.type} · produces x{recipe.output.qty || 1}</p>
              <ul>
                {Object.entries(recipe.ingredients || {}).map(([id, qty]) => (
                  <li key={id}>
                    <button onClick={() => onQuickInfo(id)}><ItemIcon config={config} id={id} size={18} /> {config.items[id]?.name || id} x{qty}</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )) : <p>No crafting recipe is configured. This may be collected, mined, grown, looted, or command/server-only.</p>}
      </section>

      <section className="info-panel">
        <h3>Items You Can Craft With {item?.name || itemId}</h3>
        <div className="related-grid">
          {usedIn.length ? usedIn.map((recipe) => (
            <button key={recipe.id} onClick={() => onQuickInfo(recipe.output.id)}>
              <ItemIcon config={config} id={recipe.output.id} size={30} />
              <span>{config.items[recipe.output.id]?.name || recipe.output.id}</span>
            </button>
          )) : <p>No configured recipes use this item yet.</p>}
        </div>
      </section>
    </section>
  );
}

function recipeGridFromFlat(flatGrid) {
  return [0, 3, 6].map((start) => flatGrid.slice(start, start + 3));
}

function ingredientsFromGrid(grid) {
  return grid.flat().reduce((ingredients, id) => {
    if (id) ingredients[id] = (ingredients[id] || 0) + 1;
    return ingredients;
  }, {});
}

function parseRecipeDraft(recipeDraft) {
  try {
    return JSON.parse(recipeDraft);
  } catch {
    return null;
  }
}

function stationMatchesStyle(station, style) {
  if (!station || !style) return false;
  if (station.layout !== style.stationDef.layout) return false;
  if (station.layout === "grid") {
    return (station.columns || 3) === style.stationDef.columns && (station.rows || 3) === style.stationDef.rows;
  }
  return true;
}

function NewRecipeStarter({ config, currentIsLocked, onCreateRecipe, compact = false }) {
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

function RecipeVisualEditor({ config, recipeDraft, setRecipeDraft, currentIsLocked, compact = false }) {
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

function ConfigEditor({
  config,
  currentIsLocked,
  newItem,
  setNewItem,
  addCustomItem,
  editingRecipeId,
  beginRecipeEdit,
  createRecipeDraft,
  recipeDraft,
  setRecipeDraft,
  saveRecipeDraft,
  compact = false,
}) {
  const [showNewRecipeStarter, setShowNewRecipeStarter] = useState(!recipeDraft);
  const itemIds = Object.keys(config.items || {}).sort((a, b) => config.items[a].name.localeCompare(config.items[b].name));

  function startRecipe(recipe, stationName, stationDef) {
    setShowNewRecipeStarter(false);
    createRecipeDraft(recipe, stationName, stationDef);
  }

  function spriteValue() {
    if (newItem.spriteMode === "existing") return newItem.spriteItem || itemIds[0] || "";
    if (newItem.spriteMode === "head") return newItem.spriteHead || "";
    return newItem.sprite || "";
  }

  return (
    <div className={`config-editor ${compact ? "compact" : ""} ${currentIsLocked ? "locked" : ""}`}>
      <section>
        <h3>Add Item</h3>
        <div className="editor-grid">
          <input placeholder="item_id" value={newItem.id} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, id: event.target.value }))} />
          <input placeholder="Display name" value={newItem.name} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, name: event.target.value }))} />
          <input placeholder="Category optional" value={newItem.category} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, category: event.target.value }))} />
          <input placeholder="Method" value={newItem.method} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, method: event.target.value }))} />
          <input placeholder="Notes" value={newItem.notes} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, notes: event.target.value }))} />
        </div>
        <div className="sprite-picker">
          <label>
            Sprite source
            <select value={newItem.spriteMode || "custom"} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, spriteMode: event.target.value }))}>
              <option value="existing">Existing item</option>
              <option value="custom">Custom filename/path</option>
              <option value="head">Player head</option>
            </select>
          </label>
          {(newItem.spriteMode || "custom") === "existing" ? (
            <label>
              Item sprite
              <select value={newItem.spriteItem || itemIds[0] || ""} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, spriteItem: event.target.value }))}>
                {itemIds.map((id) => <option value={id} key={id}>{config.items[id].name}</option>)}
              </select>
            </label>
          ) : (newItem.spriteMode || "custom") === "head" ? (
            <label>
              Head texture, player, or note
              <input placeholder="Player name or texture value" value={newItem.spriteHead || ""} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, spriteHead: event.target.value }))} />
            </label>
          ) : (
            <label>
              Sprite filename/path
              <input placeholder="example.png or /sprites/example.png" value={newItem.sprite} disabled={currentIsLocked} onChange={(event) => setNewItem((item) => ({ ...item, sprite: event.target.value }))} />
            </label>
          )}
          <span className="slot large" title="Sprite preview">
            {spriteValue() ? (
              <img className="item-art" src={(newItem.spriteMode || "custom") === "existing" ? spriteFor(config, newItem.spriteItem || itemIds[0]) : (newItem.spriteMode || "custom") === "head" ? playerHeadDataUrl(newItem.spriteHead) : spriteFor({ ...config, items: { ...config.items, __preview: { sprite: newItem.sprite } } }, "__preview")} width="32" height="32" alt="" />
            ) : null}
          </span>
        </div>
        <button onClick={addCustomItem} disabled={currentIsLocked}>Add item</button>
      </section>
      <section>
        <h3>Edit Recipe</h3>
        <div className="settings-row">
          <button onClick={() => setShowNewRecipeStarter(true)} disabled={currentIsLocked}>New recipe</button>
          {recipeDraft ? <button onClick={() => setShowNewRecipeStarter(false)} disabled={currentIsLocked}>Current draft</button> : null}
        </div>
        {showNewRecipeStarter ? (
          <NewRecipeStarter config={config} currentIsLocked={currentIsLocked} onCreateRecipe={startRecipe} compact={compact} />
        ) : (
          <>
            <RecipeVisualEditor
              config={config}
              recipeDraft={recipeDraft}
              setRecipeDraft={setRecipeDraft}
              currentIsLocked={currentIsLocked}
              compact={compact}
            />
            <details className="advanced-json">
              <summary>Advanced JSON</summary>
              <textarea value={recipeDraft} disabled={currentIsLocked} onChange={(event) => setRecipeDraft(event.target.value)} placeholder="Choose a recipe or create a new one." />
            </details>
            <button onClick={saveRecipeDraft} disabled={currentIsLocked || !recipeDraft}>Save recipe</button>
          </>
        )}
      </section>
    </div>
  );
}

function App() {
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState("minecraft-26.1.2");
  const [customConfigs, setCustomConfigs] = useState(() => JSON.parse(localStorage.getItem("craftpath.configs") || "[]"));
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

  function editItemFromPage(id, recipe) {
    const item = items[id] || {};
    const sprite = item.sprite || `${id}.svg`;
    const spriteMode = typeof sprite === "object" && sprite.type === "item" ? "existing" : typeof sprite === "object" && sprite.type === "player_head" ? "head" : typeof sprite === "string" && (sprite.startsWith("item:") || items[sprite]) ? "existing" : typeof sprite === "string" && sprite.startsWith("player_head:") ? "head" : "custom";
    setNewItem({
      id,
      name: item.name || id,
      category: item.category || "",
      method: item.method || "craft",
      spriteMode,
      spriteItem: typeof sprite === "object" && sprite.type === "item" ? sprite.id : typeof sprite === "string" && sprite.startsWith("item:") ? sprite.slice("item:".length) : typeof sprite === "string" && items[sprite] ? sprite : "",
      sprite: spriteMode === "custom" ? sprite : "",
      spriteHead: typeof sprite === "object" && sprite.type === "player_head" ? sprite.texture || sprite.value || sprite.username || "" : typeof sprite === "string" && sprite.startsWith("player_head:") ? sprite.slice("player_head:".length) : "",
      notes: item.notes || "",
    });
    if (recipe) {
      beginRecipeEdit(recipe.id);
    } else {
      createRecipeDraft({
        id: `${id}.custom-${Date.now()}`,
        output: { id, qty: 1 },
        type: "craft",
        station: "Crafting Table",
        ingredients: {},
        grid: [["", "", ""], ["", "", ""], ["", "", ""]],
      });
    }
    setMode("builder");
    setItemPage("");
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
    setCustomText(JSON.stringify(normalized, null, 2));
    setMessage(`Imported ${normalized.meta.name} with ${normalized.recipes.length} recipes and ${Object.keys(normalized.items).length} items.`);
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
        <header className="topbar">
          <div>
            <h2>{mode === "planner" ? "Needed Materials" : mode === "builder" ? "Recipe Builder" : mode === "settings" ? "Settings" : itemPage ? items[itemPage]?.name || "Item Page" : "Item Browser"}</h2>
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

            {false ? <div className="builder-summary">
              <div>
                <span className="eyebrow">Current recipe pack</span>
                <h3>{config.meta?.name}</h3>
                <p>{Object.keys(config.items).length} items · {config.recipes.length} recipes · {Object.keys(config.stations || {}).length} station layouts</p>
              </div>
              <div className="builder-actions">
                <button onClick={createEditableCopy}><FileJson size={16} /> Create editable copy</button>
                {currentIsEditable ? <button onClick={toggleCurrentLock}>{currentIsLocked ? "Unlock pack" : "Lock pack"}</button> : null}
              </div>
            </div> : null}

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
              onEdit={editItemFromPage}
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
      {mode === "browser" && rightRailVisible ? (
        <ItemInspector
          config={config}
          itemId={itemModal || itemPage}
          recipes={(itemModal || itemPage) ? recipeLookup[itemModal || itemPage] || [] : []}
          usedIn={(itemModal || itemPage) ? recipesUsingItem(config, itemModal || itemPage) : []}
          canEdit={currentIsEditable && !currentIsLocked}
          onEdit={editItemFromPage}
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

createRoot(document.getElementById("root")).render(<App />);
