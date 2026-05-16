import { Check, ChevronLeft, ChevronRight, Info, Plus } from "lucide-react";
import ItemIcon from "./ItemIcon.jsx";
import RecipeGrid from "./RecipeGrid.jsx";

export default function PlannerView({ materialBoardEntries, items, config, recipeLookup, recipeChoices, expanded, selectedMaterial, checked, tagSelections, handleMaterialCardClick, changeRecipe, setRecipeTagChoice, addMaterials, setChecked, openItemModal }) {
  return (
    <section className="material-board">
      {materialBoardEntries.map(([id, qty, completed]) => {
        const recipes = recipeLookup[id] || [];
        const recipeIndex = recipeChoices[id] || 0;
        const recipe = recipes[recipeIndex];
        const isExpanded = expanded[id];
        const isCraftable = !completed && recipes.length > 0;
        return (
          <article className={`material-card ${completed || checked[id] ? "done" : ""} ${completed ? "crafted" : ""} ${selectedMaterial === id ? "selected" : ""}`} key={`${id}-${completed ? "crafted" : "needed"}`}>
            <button className="material-head" onClick={() => handleMaterialCardClick(id, isCraftable, completed)}>
              <span className="slot large"><ItemIcon config={config} id={id} size={32} /></span>
              <span>
                <strong>{items[id].name}</strong>
                <em>{completed ? "Crafted and checked" : isCraftable ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}` : items[id].method}</em>
              </span>
              <b>x{qty}</b>
              {completed ? <span className="crafted-mark"><Check size={14} /> done</span> : null}
            </button>
            {isExpanded && !completed ? (
              <div className="recipe-expansion">
                {recipe ? (
                  <>
                    <div className="recipe-toolbar">
                      <button disabled={recipes.length < 2} onClick={() => changeRecipe(id, -1)}><ChevronLeft size={15} /></button>
                      <span>{recipe.station} · {recipe.type} · {recipeIndex + 1}/{recipes.length}</span>
                      <button disabled={recipes.length < 2} onClick={() => changeRecipe(id, 1)}><ChevronRight size={15} /></button>
                    </div>
                    <RecipeGrid
                      config={config}
                      recipe={recipe}
                      interactiveTags
                      tagSelections={Object.fromEntries(
                        Object.keys(config.tags || {}).map((key) => [key, tagSelections[`${recipe.id}:${key}`]]).filter(([, choice]) => choice)
                      )}
                      onTagSelect={(key, choice) => setRecipeTagChoice(recipe.id, key, choice)}
                    />
                    <div className="recipe-actions">
                      <button className="primary-action" onClick={() => addMaterials(id, qty)}>
                        <Plus size={15} /> Add materials to list
                      </button>
                      <button className="more-info-button inline" onClick={() => openItemModal(id)}><Info size={14} /> More info</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="material-note">{items[id].notes || "No recipe is configured for this item."}</p>
                    <div className="recipe-actions">
                      <button className="primary-action" onClick={() => setChecked((current) => ({ ...current, [id]: !current[id] }))}>
                        <Check size={15} /> {checked[id] ? "Unmark collected" : "Mark collected"}
                      </button>
                      <button className="more-info-button inline" onClick={() => openItemModal(id)}><Info size={14} /> More info</button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
