import { assetUrl } from "./asset.js";
import { minecraftZipToConfig } from "./minecraft.js";

export const BUILT_IN_CONFIGS = [
  { id: "minecraft-26.1.2", name: "Minecraft 26.1.2", url: "packs/minecraft-26.1.2.zip", format: "minecraft-zip" },
  { id: "slimefun-1.21", name: "Slimefun 1.21", url: "configs/slimefun-1.21.json" },
  { id: "slimefun-mcpe", name: "Slimefun MCPE", url: "configs/slimefun-mcpe.json" },
  { id: "vanilla-1.20", name: "Vanilla 1.20", url: "configs/vanilla-1.20.json" },
  { id: "server-example", name: "Server Example", url: "configs/server-example.json" },
];

export const STARTING_GOALS = [
  { id: "enchanting_table", qty: 1 },
  { id: "bookshelf", qty: 15 },
  { id: "diamond_pickaxe", qty: 1 },
  { id: "comparator", qty: 4 },
];

export function mergeConfigs(base, overlay) {
  if (!overlay) return base;
  return {
    meta: { ...base.meta, ...overlay.meta },
    items: { ...base.items, ...overlay.items },
    stations: { ...(base.stations || {}), ...(overlay.stations || {}) },
    tags: { ...(base.tags || {}), ...(overlay.tags || {}) },
    recipes: [...base.recipes, ...(overlay.recipes || [])],
  };
}

export async function loadConfigFile(entry, seen = new Set()) {
  if (seen.has(entry.id)) throw new Error(`Circular config extends: ${entry.id}`);
  seen.add(entry.id);

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
  if (config.extends) {
    const baseEntry = BUILT_IN_CONFIGS.find((candidate) => candidate.id === config.extends);
    if (!baseEntry) throw new Error(`Unknown base config: ${config.extends}`);
    const base = await loadConfigFile(baseEntry, seen);
    return mergeConfigs(base, config);
  }
  return config;
}
