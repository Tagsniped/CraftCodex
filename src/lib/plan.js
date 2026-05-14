import { resolveRecipeIngredientTags } from "./utils.js";

export function recipesByOutput(config) {
  return (config.recipes || []).reduce((lookup, recipe) => {
    const id = recipe.output.id;
    lookup[id] = [...(lookup[id] || []), recipe];
    return lookup;
  }, {});
}

export function recipesUsingItem(config, id) {
  return (config.recipes || []).filter((recipe) => Object.keys(recipe.ingredients || {}).includes(id));
}

export function addQty(map, id, qty) {
  map[id] = (map[id] || 0) + qty;
  if (map[id] <= 0) delete map[id];
}

export function scaleIngredients(recipe, neededQty) {
  const crafts = Math.ceil(neededQty / Math.max(1, recipe.output.qty || 1));
  return {
    crafts,
    ingredients: Object.fromEntries(Object.entries(recipe.ingredients || {}).map(([id, qty]) => [id, qty * crafts])),
  };
}

export function computePlan(goals, craftSteps, completedItems, config) {
  const needs = {};
  const addBalance = (id, qty) => {
    needs[id] = (needs[id] || 0) + qty;
  };
  goals.forEach((goal) => addBalance(goal.id, goal.qty));

  const readyCrafts = [];
  craftSteps.forEach((step) => {
    const recipe = config.recipes.find((candidate) => candidate.id === step.recipeId);
    if (!recipe) return;

    addBalance(step.id, -step.qty);
    const resolvedRecipe = resolveRecipeIngredientTags(config, recipe, step.tagSelections || {});
    const scaled = scaleIngredients(resolvedRecipe, step.qty);
    Object.entries(scaled.ingredients).forEach(([id, qty]) => addBalance(id, qty));
    readyCrafts.push({ ...step, recipe: resolvedRecipe, sourceRecipe: recipe, crafts: scaled.crafts });
  });

  Object.entries(completedItems).forEach(([id, qty]) => addBalance(id, -qty));
  Object.entries(needs).forEach(([id, qty]) => {
    if (qty <= 0) delete needs[id];
  });

  return { needs, readyCrafts };
}
