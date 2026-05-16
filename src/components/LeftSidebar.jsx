import { BookOpen, FileJson, Info, Plus, Search, Trash2 } from "lucide-react";
import ItemIcon from "./ItemIcon.jsx";

export default function LeftSidebar({ mode, config, items, query, setQuery, searchResults, goals, updateGoal, removeGoal, addGoal, openItemPage, browserCategory, setBrowserCategory, categories, browserItems, currentIsEditable, currentIsLocked, toggleCurrentLock, createEditableCopy }) {
  return (
    <aside className="sidebar">
      <label className="search-box">
        <Search size={17} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" />
      </label>

      <div className="search-results">
        {searchResults.map((id) => (
          <button key={id} onClick={() => (mode === "planner" ? addGoal(id) : openItemPage(id))} className="result-row">
            <span className="slot"><ItemIcon config={config} id={id} /></span>
            <span>{items[id].name}</span>
            {mode === "planner" ? <Plus size={15} /> : <Info size={15} />}
          </button>
        ))}
      </div>

      {mode === "planner" ? (
        <section className="goal-panel">
          <div className="panel-title">
            <span>Goal List</span>
            <strong>{goals.length}</strong>
          </div>
          {goals.map((goal) => (
            <div className="goal-row" key={goal.id}>
              <span className="slot"><ItemIcon config={config} id={goal.id} /></span>
              <span className="goal-name">{items[goal.id]?.name || goal.id}</span>
              <input aria-label={`${items[goal.id]?.name || goal.id} quantity`} type="number" min="1" value={goal.qty} onChange={(e) => updateGoal(goal.id, Number(e.target.value))} />
              <button className="icon-button" onClick={() => removeGoal(goal.id)} aria-label={`Remove ${items[goal.id]?.name || goal.id}`}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      ) : mode === "builder" ? (
        <section className="goal-panel builder-nav">
          <div className="panel-title">
            <span>Builder Status</span>
            <strong>{config.recipes.length}</strong>
          </div>
          <p>{currentIsEditable ? currentIsLocked ? "This recipe pack is locked." : "This recipe pack is editable." : "Create an editable copy to build a custom recipe list."}</p>
          <button className="category-row active" onClick={currentIsEditable ? toggleCurrentLock : createEditableCopy}>
            <FileJson size={15} />
            <span>{currentIsEditable ? currentIsLocked ? "Unlock Recipe Pack" : "Lock Recipe Pack" : "Create Editable Copy"}</span>
          </button>
        </section>
      ) : (
        <section className="goal-panel">
          <div className="panel-title">
            <span>Browse Categories</span>
            <strong>{browserItems.length}</strong>
          </div>
          {categories.slice(0, 9).map((category) => (
            <button className={`category-row ${browserCategory === category ? "active" : ""}`} key={category} onClick={() => setBrowserCategory(category)}>
              <BookOpen size={15} />
              <span>{category}</span>
            </button>
          ))}
        </section>
      )}
    </aside>
  );
}
