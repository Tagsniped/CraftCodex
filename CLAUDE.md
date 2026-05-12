# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server at http://127.0.0.1:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No test runner or linter is configured.

## Architecture

CraftCodex is a Minecraft recipe planner SPA with this source layout:

```
src/
  main.jsx          # Entry point only (createRoot)
  App.jsx           # Root component — all state, event handlers, and top-level render
  styles.css        # All styles (~2930 lines), CSS custom properties for theming
  lib/
    asset.js        # BASE_URL and assetUrl() helper
    utils.js        # Tag/ingredient display utilities (normalizeMinecraftId, tagChoices, etc.)
    plan.js         # computePlan, scaleIngredients, recipesByOutput
    builder.js      # CRAFTING_MENU_STYLES constant + recipe editor helpers
    zip.js          # Browser-native ZIP parser (DecompressionStream + DataView)
    minecraft.js    # Minecraft data → internal config conversion
    sprite.js       # spriteFor(), playerHeadDataUrl()
    config.js       # BUILT_IN_CONFIGS, STARTING_GOALS, loadConfigFile, mergeConfigs
  components/
    ItemIcon.jsx
    RecipeGrid.jsx
    ItemInfoModal.jsx
    ItemInspector.jsx
    ItemPage.jsx
    NewRecipeStarter.jsx
    RecipeVisualEditor.jsx
    ConfigEditor.jsx
```

### State management

`App` uses 23 `useState` hooks directly. There is no Context API, Redux, or other state library. Persistence is via `localStorage` keys `craftpath.configs`, `craftpath.themeMode`, and `craftpath.accentHue`.

### Data flow

1. A config object (`{ meta, items, stations, tags, recipes }`) is loaded from a built-in JSON or imported ZIP/JSON file.
2. `recipeLookup` (output → recipe) and `recipesUsingItem` (item → recipes that use it) are derived from the config.
3. `computePlan()` does a graph traversal over goals to produce `{ needs, readyCrafts }` for the planner.
4. UI renders one of three modes: **planner** (material checklist), **browser** (item catalog), or **builder** (recipe/config editor).

### Key utility functions

| Function | File | Purpose |
|---|---|---|
| `computePlan()` | `lib/plan.js` | Traverses ingredient graph to compute crafting needs |
| `minecraftZipToConfig()` | `lib/minecraft.js` | Converts a Minecraft data pack ZIP to internal config format |
| `minecraftRecipeToCraftpath()` | `lib/minecraft.js` | Maps a Minecraft recipe JSON to internal recipe format |
| `readZipFile()` | `lib/zip.js` | Browser-native ZIP parser using `DecompressionStream` + `DataView` |
| `resolveRecipeIngredientTags()` | `lib/utils.js` | Expands `#tag` references to concrete item IDs |
| `mergeConfigs()` | `lib/config.js` | Merges an extending config into a base config |
| `spriteFor()` | `lib/sprite.js` | Resolves item icon (SVG path, data URL, player head, or item reference) |

### Public assets

- `public/configs/` — JSON recipe configs (built-ins: `vanilla-1.20.json`, `server-example.json`)
- `public/sprites/` — SVG/PNG item icons (32×32, named by item ID)
- `public/packs/` — Prebuilt Minecraft data pack ZIP

### Java pack builder tool

`tools/craftpath-pack-builder/` is a standalone Java CLI that converts a raw Minecraft version export into a `config.json` + `sprites/` folder suitable for `public/configs/`. Run via `.\run.bat` inside that directory. Its output is not committed — see `.gitignore`.

## Build & deployment

- `vite.config.js` sets `base: "/CraftCodex/"` for GitHub Pages deployment.
- Pushing to `master` triggers `.github/workflows/deploy-pages.yml`, which runs `npm ci && npm run build` and deploys `dist/` to GitHub Pages.

## Config format

Recipe configs follow a documented schema in `public/configs/README.md`. Key points:
- Stations support types: `grid` (2×2 or 3×3), `furnace`, `brewing`, `smithing`, plus custom shapes.
- A config can extend another via `"extends": "vanilla-1.20"`.
- Items have optional `category`, and `meta` fields control editability (`editable`, `locked`).
