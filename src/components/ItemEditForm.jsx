import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { spriteFor, playerHeadDataUrl } from "../lib/sprite.js";

function spriteDraftFromItem(item, itemId, items) {
  const sprite = item?.sprite || `${itemId}.svg`;
  const spriteMode = typeof sprite === "object" && sprite.type === "item"
    ? "existing"
    : typeof sprite === "object" && sprite.type === "player_head"
      ? "head"
      : typeof sprite === "string" && (sprite.startsWith("item:") || items[sprite])
        ? "existing"
        : typeof sprite === "string" && sprite.startsWith("player_head:")
          ? "head"
          : "custom";

  return {
    spriteMode,
    spriteItem: typeof sprite === "object" && sprite.type === "item"
      ? sprite.id
      : typeof sprite === "string" && sprite.startsWith("item:")
        ? sprite.slice("item:".length)
        : typeof sprite === "string" && items[sprite]
          ? sprite
          : "",
    sprite: spriteMode === "custom" ? sprite : "",
    spriteHead: typeof sprite === "object" && sprite.type === "player_head"
      ? sprite.texture || sprite.value || sprite.username || ""
      : typeof sprite === "string" && sprite.startsWith("player_head:")
        ? sprite.slice("player_head:".length)
        : "",
  };
}

function spriteFromDraft(draft, fallbackId) {
  if (draft.spriteMode === "existing") return { type: "item", id: draft.spriteItem || fallbackId || "" };
  if (draft.spriteMode === "head") return { type: "player_head", texture: draft.spriteHead.trim() };
  return draft.sprite.trim() || `${fallbackId}.svg`;
}

export default function ItemEditForm({ config, itemId, onSave, onCancel, compact = false }) {
  const item = config.items[itemId] || {};
  const itemIds = useMemo(() => Object.keys(config.items || {}).sort((a, b) => config.items[a].name.localeCompare(config.items[b].name)), [config.items]);
  const [draft, setDraft] = useState(() => ({
    name: item.name || itemId,
    category: item.category || "",
    method: item.method || "",
    notes: item.notes || "",
    ...spriteDraftFromItem(item, itemId, config.items || {}),
  }));

  useEffect(() => {
    setDraft({
      name: item.name || itemId,
      category: item.category || "",
      method: item.method || "",
      notes: item.notes || "",
      ...spriteDraftFromItem(item, itemId, config.items || {}),
    });
  }, [config.items, item, itemId]);

  const previewSource = draft.spriteMode === "existing"
    ? spriteFor(config, draft.spriteItem || itemIds[0])
    : draft.spriteMode === "head"
      ? playerHeadDataUrl(draft.spriteHead)
      : spriteFor({ ...config, items: { ...config.items, __preview: { sprite: draft.sprite } } }, "__preview");

  function saveItem() {
    onSave(itemId, {
      ...item,
      name: draft.name.trim() || itemId,
      category: draft.category.trim(),
      method: draft.method.trim(),
      notes: draft.notes.trim(),
      sprite: spriteFromDraft(draft, itemId),
    });
  }

  return (
    <div className={`item-edit-form ${compact ? "compact" : ""}`}>
      <label>
        Item ID
        <input value={itemId} disabled />
      </label>
      <label>
        Display name
        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
      </label>
      <label>
        Category
        <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
      </label>
      <label>
        Method
        <input value={draft.method} onChange={(event) => setDraft((current) => ({ ...current, method: event.target.value }))} />
      </label>
      <div className="item-edit-sprite">
        <label>
          Sprite source
          <select value={draft.spriteMode} onChange={(event) => setDraft((current) => ({ ...current, spriteMode: event.target.value }))}>
            <option value="existing">Existing item</option>
            <option value="custom">Custom filename/path</option>
            <option value="head">Player head</option>
          </select>
        </label>
        {draft.spriteMode === "existing" ? (
          <label>
            Item sprite
            <select value={draft.spriteItem || itemIds[0] || ""} onChange={(event) => setDraft((current) => ({ ...current, spriteItem: event.target.value }))}>
              {itemIds.map((id) => <option value={id} key={id}>{config.items[id].name}</option>)}
            </select>
          </label>
        ) : draft.spriteMode === "head" ? (
          <label>
            Head texture, player, or note
            <input value={draft.spriteHead} onChange={(event) => setDraft((current) => ({ ...current, spriteHead: event.target.value }))} />
          </label>
        ) : (
          <label>
            Sprite filename/path
            <input value={draft.sprite} onChange={(event) => setDraft((current) => ({ ...current, sprite: event.target.value }))} />
          </label>
        )}
        <span className="slot large" title="Sprite preview">
          {previewSource ? <img className="item-art" src={previewSource} width="32" height="32" alt="" /> : null}
        </span>
      </div>
      <label className="item-edit-notes">
        Notes
        <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
      </label>
      <div className="item-edit-actions">
        <button className="primary-action" onClick={saveItem}><Save size={15} /> Save item</button>
        <button className="back-button" onClick={onCancel}><X size={15} /> Cancel</button>
      </div>
    </div>
  );
}
