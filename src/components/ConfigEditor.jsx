import { useState } from "react";
import { FileJson } from "lucide-react";
import { spriteFor, playerHeadDataUrl } from "../lib/sprite.js";
import ItemIcon from "./ItemIcon.jsx";
import RecipeVisualEditor from "./RecipeVisualEditor.jsx";
import NewRecipeStarter from "./NewRecipeStarter.jsx";

export default function ConfigEditor({
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
