import ItemIcon from "./ItemIcon.jsx";

export default function ItemSwitcher({ config, items, searchableIds, itemPage, setItemPage, setItemModal }) {
  return (
    <aside className="checklist item-switcher">
      <div className="panel-title">
        <span>All Items</span>
        <strong>{searchableIds.length}</strong>
      </div>
      <div className="item-switcher-grid">
        {searchableIds.map((id) => (
          <button
            className={`item-switcher-card ${itemPage === id ? "active" : ""}`}
            key={id}
            onClick={() => { setItemPage(id); setItemModal(""); }}
            title={items[id].name}
            aria-label={`View ${items[id].name}`}
          >
            <span className="slot"><ItemIcon config={config} id={id} size={24} /></span>
          </button>
        ))}
      </div>
    </aside>
  );
}
