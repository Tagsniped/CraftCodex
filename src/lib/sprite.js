import { assetUrl } from "./asset.js";

export function playerHeadDataUrl(value = "") {
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

export function spriteFor(config, id, seen = new Set()) {
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
