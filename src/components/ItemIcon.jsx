import { spriteFor } from "../lib/sprite.js";

export default function ItemIcon({ config, id, size = 24 }) {
  const item = config.items[id];
  return <img className="item-art" src={spriteFor(config, id)} width={size} height={size} alt={item?.name || id} />;
}
