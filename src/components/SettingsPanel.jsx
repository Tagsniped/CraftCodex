import { ACCENT_COLORS } from "../lib/theme.js";

export default function SettingsPanel({ themeMode, setThemeMode, accent, setAccent }) {
  return (
    <section className="settings-panel customize-panel">
      <div>
        <span className="eyebrow">Customize webpage</span>
        <h3>Appearance</h3>
      </div>
      <div className="settings-row">
        <label>
          Theme
          <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)}>
            <option value="dark">Dark mode</option>
            <option value="light">Light mode</option>
          </select>
        </label>
        <div className="accent-picker">
          <span>Accent color</span>
          <div className="accent-swatches">
            {Object.entries(ACCENT_COLORS).map(([key, { hue, label }]) => (
              <button
                key={key}
                className={`accent-swatch ${accent === key ? "selected" : ""}`}
                style={{ backgroundColor: `hsl(${hue} 72% 50%)` }}
                title={label}
                aria-label={label}
                aria-pressed={accent === key}
                onClick={() => setAccent(key)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
