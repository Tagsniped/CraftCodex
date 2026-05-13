import { useState } from "react";
import { ArrowLeft, FileJson } from "lucide-react";
import ItemIcon from "./ItemIcon.jsx";
import RecipeGrid from "./RecipeGrid.jsx";
import ItemEditForm from "./ItemEditForm.jsx";

export default function ItemPage({ config, itemId, recipes, usedIn, onBack, onQuickInfo, canEdit, onSaveItem }) {
  const [isEditing, setIsEditing] = useState(false);
  const item = config.items[itemId];
  return (
    <section className="item-page">
      <div className="item-page-actions">
        <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to recipes</button>
        {canEdit ? <button className="primary-action edit-item-action" onClick={() => setIsEditing(true)}><FileJson size={15} /> Edit item</button> : null}
      </div>
      <header className="item-page-hero">
        <span className="slot hero-slot"><ItemIcon config={config} id={itemId} size={64} /></span>
        <div>
          <h2>{item?.name || itemId}</h2>
          <p>{config.meta?.name} - {item?.category || "Item"} - {recipes.length ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : item?.method}</p>
        </div>
      </header>

      {isEditing ? (
        <section className="info-panel">
          <h3>Edit Item Details</h3>
          <ItemEditForm
            config={config}
            itemId={itemId}
            onSave={(id, nextItem) => {
              onSaveItem(id, nextItem);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        </section>
      ) : (
        <>
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
                  <p>{recipe.type} - produces x{recipe.output.qty || 1}</p>
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
        </>
      )}
    </section>
  );
}
