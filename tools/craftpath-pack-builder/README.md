# CraftCodex Pack Builder

A small local Java app for turning a Minecraft version export folder into a compact CraftCodex website pack.

## What It Reads

Point it at a Minecraft version folder like:

```text
26.1.2/
  data/minecraft/recipe/
  data/minecraft/tags/
  assets/minecraft/items/
  assets/minecraft/models/block/
  assets/minecraft/textures/item/
  assets/minecraft/textures/block/
```

`assets/minecraft/items` is treated as the authoritative item list. Texture files are only used as artwork, so render-helper textures do not become browser items.

## What It Writes

```text
output/
  manifest.json
  config.json
  sprites/
    acacia_log.png
    diamond_pickaxe.png
    ...
  craftpath-pack.zip
```

`config.json` is the streamlined CraftCodex config the website can import later. `sprites/` contains generated item PNGs.

## Optional Item Info

You can provide an optional JSON file to add or override item fields:

```json
{
  "items": {
    "diamond": {
      "category": "Raw",
      "method": "mine",
      "notes": "Mine below Y 16."
    }
  }
}
```

Supported fields are open-ended. Common fields are:

- `name`
- `category`
- `method`
- `notes`
- `sprite`

## Running

Install a JDK, then from this folder:

```powershell
.\run.bat
```

Or compile manually:

```powershell
javac -d out src\craftpath\packbuilder\*.java
java -cp out craftpath.packbuilder.Main
```

CLI mode:

```powershell
java -cp out craftpath.packbuilder.Main "C:\Users\alexa\Desktop\26.1.2" "C:\Users\alexa\Documents\New project\built-packs\minecraft-26.1.2" "Minecraft 26.1.2"
```

With IconExporter PNGs:

```powershell
java -cp out craftpath.packbuilder.Main "C:\Users\alexa\Desktop\26.1.2" "C:\Users\alexa\Documents\New project\built-packs\minecraft-26.1.2" "Minecraft 26.1.2" "C:\Users\alexa\Documents\New project\craftpath-icon-exports\minecraft-26.1.2"
```

IconExporter images are preferred over generated fallback sprites. The builder looks for names like
`minecraft__acacia_log.png`, `minecraft__acacia_log__0.png`, and `minecraft_acacia_log.png`.
