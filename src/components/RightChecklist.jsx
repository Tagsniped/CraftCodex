import { Check, Hammer } from "lucide-react";
import ItemIcon from "./ItemIcon.jsx";
import RecipeGrid from "./RecipeGrid.jsx";

export default function RightChecklist({ checklistEntries, collectedCount, allCollected, items, config, plan, expandedCraftStep, setExpandedCraftStep, stepIsReady, completeCraft, checked, setChecked }) {
  const progress = checklistEntries.length ? Math.round((collectedCount / checklistEntries.length) * 100) : 0;

  return (
    <aside className="checklist">
      <div className="progress-card">
        <div className="progress-ring" style={{ "--progress": `${progress}%` }}>
          <span>{progress}%</span>
        </div>
        <div>
          <h2>Crafting Steps</h2>
          <p>{allCollected ? "Collected. Craft the queued items now." : `${collectedCount} of ${checklistEntries.length} checklist rows confirmed`}</p>
        </div>
      </div>

      <div className="craft-step-list">
        {plan.readyCrafts.map((step) => {
          const isOpen = expandedCraftStep === `${step.id}-${step.recipeId}`;
          const isReady = stepIsReady(step);
          return (
            <article className={`craft-step ${isReady ? "ready" : ""}`} key={`${step.id}-${step.recipeId}`}>
              <button className="craft-step-head" onClick={() => setExpandedCraftStep(isOpen ? "" : `${step.id}-${step.recipeId}`)}>
                <span className="slot"><ItemIcon config={config} id={step.id} /></span>
                <span>
                  <strong>{items[step.id]?.name || step.id}</strong>
                  <em>{isReady ? `Craft ${step.crafts} time${step.crafts === 1 ? "" : "s"}` : "Waiting on materials"}</em>
                </span>
                {isReady ? <Check size={16} /> : <Hammer size={16} />}
              </button>
              {isOpen ? (
                <div className="craft-step-detail">
                  <RecipeGrid config={config} recipe={step.recipe} />
                  <button className="primary-action" onClick={() => completeCraft(step)} disabled={!isReady}>
                    <Check size={15} /> Complete craft
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <section className="next-actions">
        <h3>Collection Checklist</h3>
        {checklistEntries.map(([id, qty, completed]) => (
          <label className={`resource-row ${completed || checked[id] ? "done" : ""}`} key={`${id}-${completed ? "completed" : "needed"}`}>
            <input type="checkbox" checked={Boolean(completed || checked[id])} disabled={Boolean(completed)} onChange={() => setChecked((current) => ({ ...current, [id]: !current[id] }))} />
            <span className="checkmark"><Check size={14} /></span>
            <span className="slot"><ItemIcon config={config} id={id} /></span>
            <span className="resource-copy">
              <strong>{items[id].name}</strong>
              <em>{completed ? "Crafted and confirmed in your inventory." : items[id].notes}</em>
            </span>
            <b>x{qty}</b>
          </label>
        ))}
      </section>
    </aside>
  );
}
