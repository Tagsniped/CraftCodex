import { X } from "lucide-react";
import ItemIcon from "./ItemIcon.jsx";
import RecipeGrid from "./RecipeGrid.jsx";

export default function ItemInfoModal({ config, itemId, recipes, usedIn, onClose, onOpenPage }) {
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
