import { FileJson, Upload } from "lucide-react";
import ConfigEditor from "./ConfigEditor.jsx";

export default function BuilderView({ config, configId, setConfigId, allConfigEntries, currentIsEditable, currentIsLocked, importEditable, setImportEditable, customText, setCustomText, handleFileImport, saveEditableConfig, createEditableCopy, toggleCurrentLock, message, newItem, setNewItem, addCustomItem, editingRecipeId, beginRecipeEdit, createRecipeDraft, recipeDraft, setRecipeDraft, saveRecipeDraft }) {
  return (
    <section className="recipe-builder">
      <section className="builder-config-panel">
        <div className="pack-status-row">
          <div>
            <span className="eyebrow">Current recipe pack</span>
            <h3>{config.meta?.name}</h3>
            <p>{Object.keys(config.items).length} items · {config.recipes.length} recipes · {Object.keys(config.stations || {}).length} station layouts</p>
          </div>
          <strong>{currentIsEditable ? currentIsLocked ? "Locked" : "Editable" : "Read only"}</strong>
        </div>
        <div className="settings-row">
          <label>
            Recipe config
            <select value={configId} onChange={(e) => setConfigId(e.target.value)}>
              {allConfigEntries.map((entry) => (
                <option value={entry.id} key={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label className="import-button">
            <Upload size={16} /> Import config
            <input type="file" accept="application/json,.json,.zip,application/zip" onChange={handleFileImport} />
          </label>
          <label className="toggle-control settings-toggle">
            <input type="checkbox" checked={importEditable} onChange={() => setImportEditable((v) => !v)} />
            <span>Import as editable</span>
          </label>
          <button onClick={createEditableCopy}><FileJson size={16} /> Create editable copy</button>
          {currentIsEditable ? <button onClick={toggleCurrentLock}>{currentIsLocked ? "Unlock config" : "Lock config"}</button> : null}
        </div>
        <details className="advanced-json">
          <summary>Full config JSON</summary>
          <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="Paste or edit a recipe config JSON file here." />
          <div className="settings-row">
            <button onClick={saveEditableConfig}>Save Editable Config</button>
            <p>{currentIsEditable ? currentIsLocked ? "Current config is locked." : "Current config is editable." : "Built-in configs are read-only. Create an editable copy to modify recipes."} {message}</p>
          </div>
        </details>
      </section>

      {currentIsEditable ? (
        <>
          <div className={`builder-lock-note ${currentIsLocked ? "locked" : ""}`}>
            {currentIsLocked ? "This recipe pack is locked so you can use it without accidental edits. Unlock it when you want to change items or recipes." : "This recipe pack is editable. Add custom items, paste recipe JSON, or modify recipes copied from the selected base version."}
          </div>
          <ConfigEditor
            config={config}
            currentIsLocked={currentIsLocked}
            newItem={newItem}
            setNewItem={setNewItem}
            addCustomItem={addCustomItem}
            editingRecipeId={editingRecipeId}
            beginRecipeEdit={beginRecipeEdit}
            createRecipeDraft={createRecipeDraft}
            recipeDraft={recipeDraft}
            setRecipeDraft={setRecipeDraft}
            saveRecipeDraft={saveRecipeDraft}
          />
        </>
      ) : (
        <div className="empty-builder">
          <FileJson size={34} />
          <h3>Start from the selected Minecraft version</h3>
          <p>Built-in recipe packs stay read-only. Create an editable copy when you want a server, modpack, or personal override file.</p>
          <button className="primary-action" onClick={createEditableCopy}>Create editable copy</button>
        </div>
      )}
    </section>
  );
}
