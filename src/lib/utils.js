export function normalizeMinecraftId(value = "") {
  return String(value).replace(/^minecraft:/, "");
}

export function titleFromId(id = "") {
  return normalizeMinecraftId(id)
    .replace(/^#/, "")
    .replace(/^tag:/, "")
    .split(/[_/:.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function tagKey(id = "") {
  return normalizeMinecraftId(String(id).replace(/^#/, "").replace(/^tag:/, ""));
}

export function isTagIngredient(id = "") {
  return String(id).startsWith("#") || String(id).startsWith("tag:");
}

export function tagChoices(config, id) {
  if (!isTagIngredient(id)) return [];
  const key = tagKey(id);
  const choices = config.tags?.[key] || config.tags?.[`minecraft:${key}`] || [];
  return choices.map(normalizeMinecraftId).filter((choice) => config.items?.[choice]);
}

export function ingredientDisplayId(config, id, tagSelections = {}, cycleIndex = 0) {
  if (!isTagIngredient(id)) return id;
  const key = tagKey(id);
  const choices = tagChoices(config, id);
  const selected = tagSelections[key];
  if (selected && choices.includes(selected)) return selected;
  return choices.length ? choices[cycleIndex % choices.length] : "";
}

export function ingredientDisplayName(config, id, resolvedId) {
  if (!isTagIngredient(id)) return config.items[id]?.name || id;
  if (resolvedId) return config.items[resolvedId]?.name || titleFromId(resolvedId);
  return `Any ${titleFromId(tagKey(id))}`;
}

export function resolveRecipeIngredientTags(config, recipe, tagSelections = {}) {
  const resolved = { ...recipe, ingredients: {}, grid: [] };
  Object.entries(recipe.ingredients || {}).forEach(([id, qty]) => {
    const nextId = ingredientDisplayId(config, id, tagSelections);
    if (nextId) resolved.ingredients[nextId] = (resolved.ingredients[nextId] || 0) + qty;
  });
  resolved.grid = (recipe.grid || []).map((row) => row.map((id) => ingredientDisplayId(config, id, tagSelections) || id));
  return resolved;
}

export function recipeResultId(result) {
  if (typeof result === "string") return result;
  return result?.id || result?.item || "";
}

export function recipeResultQty(result) {
  return typeof result === "object" && result?.count ? result.count : 1;
}

export function ingredientChoices(raw) {
  if (!raw) return [];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.flatMap((entry) => ingredientChoices(entry));
  if (raw.item) return [raw.item];
  if (raw.tag) return [`#${raw.tag}`];
  return [];
}
