import ItemIcon from "./ItemIcon.jsx";

export default function BrowserView({ items, config, categories, browserCategory, setBrowserCategory, browserItems, browserGroups, groupBrowserItems, setGroupBrowserItems, showBrowserNames, setShowBrowserNames, openItemModal }) {
  return (
    <section className="recipe-browser">
      <div className="mobile-category-chips" aria-label="Browse categories">
        {categories.map((category) => (
          <button className={browserCategory === category ? "active" : ""} key={category} onClick={() => setBrowserCategory(category)}>
            {category}
          </button>
        ))}
      </div>
      <div className="browser-toolbar">
        <span>{browserCategory} · {browserItems.length} items</span>
        <div className="browser-toolbar-controls">
          <label className="toggle-control">
            <input type="checkbox" checked={groupBrowserItems} onChange={() => setGroupBrowserItems((v) => !v)} />
            <span>Group by category</span>
          </label>
          <label className="toggle-control">
            <input type="checkbox" checked={showBrowserNames} onChange={() => setShowBrowserNames((v) => !v)} />
            <span>Show names</span>
          </label>
        </div>
      </div>
      {groupBrowserItems ? (
        Object.entries(browserGroups).map(([category, ids]) => (
          <section className="browser-group" key={category}>
            <div className="browser-group-title">
              <h3>{category}</h3>
              <span>{ids.length}</span>
            </div>
            <div className={`browser-grid ${showBrowserNames ? "" : "icon-only"}`}>
              {ids.map((id) => (
                <button className="browser-card" key={id} onClick={() => openItemModal(id)} title={items[id].name} aria-label={items[id].name}>
                  <span className="slot"><ItemIcon config={config} id={id} size={24} /></span>
                  {showBrowserNames ? <strong>{items[id].name}</strong> : null}
                </button>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className={`browser-grid flat ${showBrowserNames ? "" : "icon-only"}`}>
          {browserItems.map((id) => (
            <button className="browser-card" key={id} onClick={() => openItemModal(id)} title={items[id].name} aria-label={items[id].name}>
              <span className="slot"><ItemIcon config={config} id={id} size={24} /></span>
              {showBrowserNames ? <strong>{items[id].name}</strong> : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
