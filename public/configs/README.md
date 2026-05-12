Recipe configs are JSON files that define items, stations, and recipes.

Item `category` is optional. If omitted, CraftCodex shows the item under `Uncategorized`.

Custom file editing can be controlled with metadata:

```json
{
  "meta": {
    "id": "my-server-pack",
    "name": "My Server Pack",
    "type": "server",
    "editable": true,
    "locked": false,
    "baseId": "vanilla-1.20"
  }
}
```

- `editable: true` enables in-app item and recipe editing.
- `locked: true` keeps the config selectable but disables accidental edits.
- `baseId` records which version or pack the custom config started from.

Station layouts are defined by name and then referenced by each recipe's `station` field:

```json
{
  "stations": {
    "Crafting Table": { "layout": "grid", "columns": 3, "rows": 3 },
    "Furnace": { "layout": "furnace" },
    "Brewing Stand": { "layout": "brewing" },
    "Smithing Table": { "layout": "smithing" },
    "Crusher": { "layout": "grid", "columns": 2, "rows": 2 }
  }
}
```

Supported built-in layout values:

- `grid`: generic crafting grid. Use `columns` and `rows`.
- `furnace`: input + fuel -> output.
- `brewing`: ingredient/fuel/bottles -> output.
- `smithing`: template/base/addition -> output.

Modpacks and servers can add custom station names. Use `layout: "grid"` for most custom crafting blocks unless the app adds a specialized layout for that station type later.
