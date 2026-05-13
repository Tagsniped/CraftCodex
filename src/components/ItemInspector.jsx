import { useState } from "react";
import { FileJson, Info } from "lucide-react";
import ItemIcon from "./ItemIcon.jsx";
import RecipeGrid from "./RecipeGrid.jsx";
import ItemEditForm from "./ItemEditForm.jsx";

export default function ItemInspector({ config, itemId, recipes, usedIn, canEdit, onSaveItem, onOpenPage }) {
  const [isEditing, setIsEditing] = useState(false);

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
          <p>{item?.category || "Item"} - {recipes.length ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : item?.method}</p>
        </div>
      </header>

      {isEditing ? (
        <ItemEditForm
          config={config}
          itemId={itemId}
          onSave={(id, nextItem) => {
            onSaveItem(id, nextItem);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
          compact
        />
      ) : (
        <>
          <p className="inspector-note">{item?.notes || "No extra notes are configured for this item yet."}</p>
          {primaryRecipe ? (
            <div className="inspector-recipe">
              <RecipeGrid config={config} recipe={primaryRecipe} />
              <div>
                <strong>{primaryRecipe.station}</strong>
                <p>{primaryRecipe.type} - {primaryRecipe.output.qty || 1} per craft</p>
              </div>
            </div>
          ) : (
            <p className="inspector-note">No recipe is configured for this item.</p>
          )}
          <div className="inspector-actions">
            {canEdit ? <button className="primary-action" onClick={() => setIsEditing(true)}><FileJson size={15} /> Edit item</button> : null}
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
        </>
      )}
    </aside>
  );
}
