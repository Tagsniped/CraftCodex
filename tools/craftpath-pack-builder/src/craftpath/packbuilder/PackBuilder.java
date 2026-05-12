package craftpath.packbuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@SuppressWarnings("unchecked")
public class PackBuilder {
    private final Path source;
    private final Path output;
    private final String packName;
    private final Path itemFieldsFile;
    private final Path iconExportDir;

    private final Set<String> itemIds = new LinkedHashSet<>();
    private final Map<String, Map<String, Object>> itemModels = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> blockModels = new LinkedHashMap<>();
    private final Map<String, Map<String, Object>> fieldOverrides = new LinkedHashMap<>();
    private final Map<String, List<String>> tagLookup = new LinkedHashMap<>();
    private final Map<String, Path> iconExports = new LinkedHashMap<>();
    private final Map<String, String> renderedSprites = new LinkedHashMap<>();

    public PackBuilder(Path source, Path output, String packName, Path itemFieldsFile) {
        this(source, output, packName, itemFieldsFile, null);
    }

    public PackBuilder(Path source, Path output, String packName, Path itemFieldsFile, Path iconExportDir) {
        this.source = source;
        this.output = output;
        this.packName = packName;
        this.itemFieldsFile = itemFieldsFile;
        this.iconExportDir = iconExportDir;
    }

    public BuildStats build() throws IOException {
        Files.createDirectories(output);
        resetDirectory(output.resolve("sprites"));
        loadModelMaps();
        loadTags();
        loadFieldOverrides();
        loadIconExports();

        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("id", idFromName(packName));
        manifest.put("name", packName);
        manifest.put("type", "minecraft-version");
        manifest.put("editable", false);
        manifest.put("spriteBase", "sprites/");

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("meta", manifest);
        config.put("stations", defaultStations());
        config.put("tags", tagLookup);
        config.put("items", buildItems());
        config.put("recipes", buildRecipes());

        writeJson(output.resolve("manifest.json"), manifest);
        writeJson(output.resolve("config.json"), config);
        zipOutput(output.resolve("craftpath-pack.zip"));

        return new BuildStats(
                itemIds.size(),
                renderedSprites.size(),
                ((List<?>) config.get("recipes")).size(),
                output.resolve("craftpath-pack.zip")
        );
    }

    private void loadModelMaps() throws IOException {
        readJsonFiles(source.resolve("assets/minecraft/items"), itemModels, true, itemIds);
        readJsonFiles(source.resolve("assets/minecraft/models/item"), itemModels, false, null);
        readJsonFiles(source.resolve("assets/minecraft/models/block"), blockModels, true, null);
    }

    private void loadFieldOverrides() throws IOException {
        if (itemFieldsFile == null || !Files.exists(itemFieldsFile)) return;
        Object parsed = Json.parse(Files.readString(itemFieldsFile));
        if (!(parsed instanceof Map<?, ?> root)) return;
        Object items = root.get("items");
        if (!(items instanceof Map<?, ?> itemMap)) return;
        for (Map.Entry<?, ?> entry : itemMap.entrySet()) {
            if (entry.getValue() instanceof Map<?, ?> fields) {
                fieldOverrides.put(String.valueOf(entry.getKey()), new LinkedHashMap<>((Map<String, Object>) fields));
            }
        }
    }

    private void loadTags() throws IOException {
        Path tagsRoot = source.resolve("data/minecraft/tags");
        if (!Files.isDirectory(tagsRoot)) return;
        try (var stream = Files.walk(tagsRoot)) {
            for (Path path : stream.filter(p -> p.toString().endsWith(".json")).sorted().toList()) {
                Object parsed = Json.parse(Files.readString(path));
                if (!(parsed instanceof Map<?, ?> tag)) continue;
                Object values = tag.get("values");
                if (!(values instanceof List<?> list)) continue;
                String id = tagsRoot.relativize(path).toString().replace('\\', '/').replaceFirst("\\.json$", "");
                if (id.startsWith("item/")) id = id.substring("item/".length());
                if (id.startsWith("items/")) id = id.substring("items/".length());
                List<String> options = new ArrayList<>();
                for (Object value : list) {
                    String option = value instanceof Map<?, ?> map ? string(map.get("id")) : string(value);
                    option = normalizeMinecraftId(option);
                    if (!option.isBlank() && !option.startsWith("#")) options.add(option);
                }
                if (!options.isEmpty()) {
                    tagLookup.put(id, options);
                }
            }
        }
    }

    private void loadIconExports() throws IOException {
        if (iconExportDir == null || !Files.isDirectory(iconExportDir)) return;
        try (var stream = Files.list(iconExportDir)) {
            for (Path path : stream.filter(Files::isRegularFile).sorted().toList()) {
                String name = path.getFileName().toString();
                if (!name.toLowerCase(Locale.ROOT).endsWith(".png")) continue;
                String key = iconKeyFromFileName(name);
                if (!key.isBlank()) iconExports.putIfAbsent(key, path);
            }
        }
    }

    private Map<String, Object> buildItems() throws IOException {
        Map<String, Object> items = new LinkedHashMap<>();
        for (String id : itemIds) {
            String sprite = renderSpriteForItem(id);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", titleFromId(id));
            item.put("category", "Item");
            item.put("method", "find");
            item.put("sprite", sprite);
            item.put("notes", "");
            item.putAll(fieldOverrides.getOrDefault(id, Map.of()));
            items.put(id, item);
        }
        return items;
    }

    private List<Object> buildRecipes() throws IOException {
        List<Object> recipes = new ArrayList<>();
        Path recipesDir = source.resolve("data/minecraft/recipe");
        if (!Files.isDirectory(recipesDir)) return recipes;
        try (var stream = Files.list(recipesDir)) {
            for (Path path : stream.filter(p -> p.toString().endsWith(".json")).sorted().toList()) {
                Map<String, Object> raw = (Map<String, Object>) Json.parse(Files.readString(path));
                Map<String, Object> recipe = convertRecipe(path.getFileName().toString(), raw);
                if (recipe != null) recipes.add(recipe);
            }
        }
        return recipes;
    }

    private Map<String, Object> convertRecipe(String filename, Map<String, Object> raw) {
        String type = string(raw.get("type"));
        Object result = raw.get("result");
        String outputId = normalizeMinecraftId(result instanceof Map<?, ?> map ? string(map.get("id")) : string(result));
        if (outputId.isBlank()) return null;

        Map<String, Integer> ingredients = new LinkedHashMap<>();
        List<Object> grid = new ArrayList<>();
        String station;
        String craftType;

        if (type.equals("minecraft:crafting_shaped")) {
            station = "Crafting Table";
            craftType = "craft";
            Map<String, Object> key = (Map<String, Object>) raw.getOrDefault("key", Map.of());
            for (Object rowObj : (List<Object>) raw.getOrDefault("pattern", List.of())) {
                List<Object> row = new ArrayList<>();
                for (char mark : string(rowObj).toCharArray()) {
                    String id = mark == ' ' ? "" : resolveIngredient(key.get(String.valueOf(mark)));
                    row.add(id);
                    addIngredient(ingredients, id);
                }
                while (row.size() < 3) row.add("");
                grid.add(row);
            }
            while (grid.size() < 3) grid.add(new ArrayList<>(List.of("", "", "")));
        } else if (type.equals("minecraft:crafting_shapeless")) {
            station = "Crafting Table";
            craftType = "craft";
            List<String> ids = new ArrayList<>();
            for (Object ingredient : (List<Object>) raw.getOrDefault("ingredients", List.of())) {
                String id = resolveIngredient(ingredient);
                if (!id.isBlank()) {
                    ids.add(id);
                    addIngredient(ingredients, id);
                }
            }
            for (int row = 0; row < 3; row++) {
                List<Object> slots = new ArrayList<>();
                for (int col = 0; col < 3; col++) {
                    int idx = row * 3 + col;
                    slots.add(idx < ids.size() ? ids.get(idx) : "");
                }
                grid.add(slots);
            }
        } else if (type.equals("minecraft:smelting") || type.equals("minecraft:blasting") || type.equals("minecraft:smoking") || type.equals("minecraft:campfire_cooking")) {
            station = "Furnace";
            craftType = "smelt";
            String id = resolveIngredient(raw.get("ingredient"));
            addIngredient(ingredients, id);
            grid.add(List.of(id, "", ""));
            grid.add(List.of("fuel", "", ""));
            grid.add(List.of("", "", ""));
        } else if (type.startsWith("minecraft:smithing")) {
            station = "Smithing Table";
            craftType = "smith";
            String template = resolveIngredient(raw.get("template"));
            String base = resolveIngredient(raw.get("base"));
            String addition = resolveIngredient(raw.get("addition"));
            addIngredient(ingredients, template);
            addIngredient(ingredients, base);
            addIngredient(ingredients, addition);
            grid.add(List.of(template, base, addition));
        } else {
            return null;
        }

        Map<String, Object> outputMap = new LinkedHashMap<>();
        outputMap.put("id", outputId);
        outputMap.put("qty", result instanceof Map<?, ?> map && map.get("count") instanceof Number number ? number.intValue() : 1);

        Map<String, Object> recipe = new LinkedHashMap<>();
        recipe.put("id", filename.replace(".json", ""));
        recipe.put("output", outputMap);
        recipe.put("type", craftType);
        recipe.put("station", station);
        recipe.put("ingredients", ingredients);
        recipe.put("grid", grid);
        return recipe;
    }

    private String resolveIngredient(Object raw) {
        if (raw == null) return "";
        if (raw instanceof String text) return normalizeIngredientId(text);
        if (raw instanceof Map<?, ?> map) {
            if (map.get("item") != null) return normalizeMinecraftId(string(map.get("item")));
            if (map.get("tag") != null) return "#" + normalizeMinecraftId(string(map.get("tag")));
        }
        if (raw instanceof List<?> list && !list.isEmpty()) return resolveIngredient(list.get(0));
        return "";
    }

    private String renderSpriteForItem(String id) throws IOException {
        Path out = output.resolve("sprites").resolve(id + ".png");
        Path exportedIcon = iconExportForItem(id);
        if (exportedIcon != null) {
            SpriteRenderer.copyItemTexture(exportedIcon, out);
            renderedSprites.put(id, id + ".png");
            return id + ".png";
        }

        Path itemTexture = texture("item", id);
        if (Files.exists(itemTexture)) {
            SpriteRenderer.copyItemTexture(itemTexture, out);
            renderedSprites.put(id, id + ".png");
            return id + ".png";
        }

        BlockSpriteTextures blockTextures = blockTexturesFromItemModel(id);
        List<SpriteRenderer.Cuboid> cuboids = cuboidsFromItemModel(id, blockTextures.textures);
        if (!cuboids.isEmpty()) {
            SpriteRenderer.renderCuboids(cuboids, out);
            renderedSprites.put(id, id + ".png");
            return id + ".png";
        }
        if (blockTextures.hasAny()) {
            SpriteRenderer.renderBlockTextures(blockTextures.top, blockTextures.left, blockTextures.right, out);
            renderedSprites.put(id, id + ".png");
            return id + ".png";
        }

        Path fallbackBlock = texture("block", id);
        if (Files.exists(fallbackBlock)) {
            SpriteRenderer.renderBlockTexture(fallbackBlock, out);
            renderedSprites.put(id, id + ".png");
            return id + ".png";
        }
        return id + ".png";
    }

    private Path iconExportForItem(String id) throws IOException {
        String normalized = normalizeMinecraftId(id).replace(':', '_');
        return iconExports.get(normalized);
    }

    private static String iconKeyFromFileName(String fileName) {
        String name = fileName.replaceFirst("(?i)\\.png$", "");
        if (name.startsWith("minecraft__")) {
            String rest = name.substring("minecraft__".length());
            int metadata = rest.indexOf("__");
            return metadata >= 0 ? rest.substring(0, metadata) : rest;
        }
        if (name.startsWith("minecraft_")) return name.substring("minecraft_".length());
        return name;
    }

    private BlockSpriteTextures blockTexturesFromItemModel(String id) {
        Map<String, Object> itemModel = itemModels.get(id);
        String modelRef = modelRef(itemModel);
        String modelId = stripModelPrefix(modelRef);
        Map<String, String> textures = resolvedTextureMap(modelId, new HashSet<>());
        String top = chooseTexture(textures, "up", "end", "top", "all", "side", "north");
        String left = chooseTexture(textures, "north", "side", "all", "end", "up");
        String right = chooseTexture(textures, "east", "side", "all", "end", "up", "north");
        if (top.isBlank() && left.isBlank() && right.isBlank()) {
            String texture = firstTexture(blockModels.get(modelId), new HashSet<>());
            if (texture.isBlank()) texture = modelId;
            top = texture;
            left = texture;
            right = texture;
        }
        return new BlockSpriteTextures(textureIfExists(top), textureIfExists(left), textureIfExists(right), textures);
    }

    private List<SpriteRenderer.Cuboid> cuboidsFromItemModel(String id, Map<String, String> textures) {
        String modelId = stripModelPrefix(modelRef(itemModels.get(id)));
        List<Object> elements = modelElements(modelId, new HashSet<>());
        List<SpriteRenderer.Cuboid> cuboids = new ArrayList<>();
        for (Object elementObj : elements) {
            if (!(elementObj instanceof Map<?, ?> element)) continue;
            double[] from = numberArray(element.get("from"));
            double[] to = numberArray(element.get("to"));
            if (from.length != 3 || to.length != 3) continue;
            Map<String, Object> faces = element.get("faces") instanceof Map<?, ?> faceMap ? (Map<String, Object>) faceMap : Map.of();
            Path top = textureForFace(faces, textures, "up", "down");
            Path left = textureForFace(faces, textures, "west", "north", "side", "up");
            Path right = textureForFace(faces, textures, "south", "east", "north", "side", "up");
            if (top != null || left != null || right != null) {
                cuboids.add(new SpriteRenderer.Cuboid(from, to, top, left, right));
            }
        }
        return cuboids;
    }

    private List<Object> modelElements(String modelId, Set<String> seen) {
        Map<String, Object> model = blockModels.get(modelId);
        if (model == null || seen.contains(modelId)) return List.of();
        seen.add(modelId);
        Object elements = model.get("elements");
        if (elements instanceof List<?> list && !list.isEmpty()) return new ArrayList<>(list);
        return modelElements(stripModelPrefix(string(model.get("parent"))), seen);
    }

    private Path textureForFace(Map<String, Object> faces, Map<String, String> textures, String... preferredFaces) {
        for (String faceName : preferredFaces) {
            Object face = faces.get(faceName);
            String textureRef = face instanceof Map<?, ?> faceMap ? string(faceMap.get("texture")) : "";
            Path path = textureIfExists(resolveTextureValue(textureRef, textures));
            if (path != null) return path;
        }
        for (Object face : faces.values()) {
            String textureRef = face instanceof Map<?, ?> faceMap ? string(faceMap.get("texture")) : "";
            Path path = textureIfExists(resolveTextureValue(textureRef, textures));
            if (path != null) return path;
        }
        return null;
    }

    private String resolveTextureValue(String value, Map<String, String> textures) {
        if (value == null || value.isBlank()) return "";
        if (value.startsWith("#")) return textures.getOrDefault(value.substring(1), "");
        return stripModelPrefix(value);
    }

    private String firstTexture(Map<String, Object> model, Set<String> seen) {
        if (model == null) return "";
        Object texturesObj = model.get("textures");
        if (texturesObj instanceof Map<?, ?> textures) {
            for (Object value : textures.values()) {
                String text = string(value);
                if (!text.startsWith("#") && !text.isBlank()) return stripModelPrefix(text);
            }
        }
        String parent = stripModelPrefix(string(model.get("parent")));
        if (parent.isBlank() || seen.contains(parent)) return "";
        seen.add(parent);
        return firstTexture(blockModels.get(parent), seen);
    }

    private Map<String, String> resolvedTextureMap(String modelId, Set<String> seen) {
        Map<String, Object> model = blockModels.get(modelId);
        if (model == null || seen.contains(modelId)) return new LinkedHashMap<>();
        seen.add(modelId);

        Map<String, String> textures = resolvedTextureMap(stripModelPrefix(string(model.get("parent"))), seen);
        Object texturesObj = model.get("textures");
        if (texturesObj instanceof Map<?, ?> modelTextures) {
            for (Map.Entry<?, ?> entry : modelTextures.entrySet()) {
                textures.put(String.valueOf(entry.getKey()), string(entry.getValue()));
            }
        }

        Map<String, String> resolved = new LinkedHashMap<>();
        for (String key : textures.keySet()) {
            resolved.put(key, resolveTextureReference(key, textures, new HashSet<>()));
        }
        return resolved;
    }

    private String resolveTextureReference(String key, Map<String, String> textures, Set<String> seen) {
        String value = textures.getOrDefault(key, "");
        if (value.startsWith("#")) {
            String nextKey = value.substring(1);
            if (seen.contains(nextKey)) return "";
            seen.add(nextKey);
            return resolveTextureReference(nextKey, textures, seen);
        }
        return stripModelPrefix(value);
    }

    private String chooseTexture(Map<String, String> textures, String... keys) {
        for (String key : keys) {
            String value = textures.getOrDefault(key, "");
            if (!value.isBlank()) return value;
        }
        for (String value : textures.values()) {
            if (!value.isBlank()) return value;
        }
        return "";
    }

    private Path textureIfExists(String id) {
        if (id == null || id.isBlank()) return null;
        Path path = texture("block", id);
        return Files.exists(path) ? path : null;
    }

    private static double[] numberArray(Object value) {
        if (!(value instanceof List<?> list)) return new double[0];
        double[] numbers = new double[list.size()];
        for (int i = 0; i < list.size(); i++) {
            Object item = list.get(i);
            numbers[i] = item instanceof Number number ? number.doubleValue() : 0;
        }
        return numbers;
    }

    private String modelRef(Map<String, Object> itemModel) {
        if (itemModel == null) return "";
        Object model = itemModel.get("model");
        if (model instanceof Map<?, ?> modelMap) return string(modelMap.get("model"));
        if (model instanceof String text) return text;
        return string(itemModel.get("parent"));
    }

    private Path texture(String folder, String id) {
        return source.resolve("assets/minecraft/textures").resolve(folder).resolve(normalizeMinecraftId(id) + ".png");
    }

    private static String stripModelPrefix(String value) {
        return normalizeMinecraftId(value).replaceFirst("^(block|item)/", "");
    }

    private static void addIngredient(Map<String, Integer> ingredients, String id) {
        if (id == null || id.isBlank()) return;
        ingredients.put(id, ingredients.getOrDefault(id, 0) + 1);
    }

    private static void readJsonFiles(Path dir, Map<String, Map<String, Object>> output, boolean overwrite, Set<String> ids) throws IOException {
        if (!Files.isDirectory(dir)) return;
        try (var stream = Files.list(dir)) {
            for (Path path : stream.filter(p -> p.toString().endsWith(".json")).sorted().toList()) {
                try {
                    String id = path.getFileName().toString().replace(".json", "");
                    if (overwrite || !output.containsKey(id)) {
                        output.put(id, (Map<String, Object>) Json.parse(Files.readString(path)));
                    }
                    if (ids != null) ids.add(id);
                } catch (RuntimeException ex) {
                    throw new IllegalArgumentException("Could not parse " + path, ex);
                }
            }
        }
    }

    private static void resetDirectory(Path dir) throws IOException {
        if (Files.exists(dir)) {
            try (var stream = Files.walk(dir)) {
                for (Path path : stream.sorted(Comparator.reverseOrder()).toList()) {
                    if (!path.equals(dir)) Files.deleteIfExists(path);
                }
            }
        }
        Files.createDirectories(dir);
    }

    private static Map<String, Object> defaultStations() {
        Map<String, Object> stations = new LinkedHashMap<>();
        stations.put("Crafting Table", Map.of("layout", "grid", "columns", 3, "rows", 3));
        stations.put("Inventory", Map.of("layout", "grid", "columns", 2, "rows", 2));
        stations.put("Furnace", Map.of("layout", "furnace", "slots", List.of("input", "fuel", "output")));
        stations.put("Smithing Table", Map.of("layout", "smithing", "slots", List.of("template", "base", "addition", "output")));
        return stations;
    }

    private void writeJson(Path path, Object value) throws IOException {
        Files.writeString(path, Json.stringify(value), StandardCharsets.UTF_8);
    }

    private void zipOutput(Path zipPath) throws IOException {
        Files.deleteIfExists(zipPath);
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(zipPath));
             var stream = Files.walk(output)) {
            for (Path path : stream.filter(Files::isRegularFile).sorted().toList()) {
                if (path.equals(zipPath)) continue;
                ZipEntry entry = new ZipEntry(output.relativize(path).toString().replace('\\', '/'));
                zip.putNextEntry(entry);
                Files.copy(path, zip);
                zip.closeEntry();
            }
        }
    }

    private static String idFromName(String name) {
        return name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private static String titleFromId(String id) {
        StringBuilder out = new StringBuilder();
        for (String part : id.split("[_:-]+")) {
            if (part.isBlank()) continue;
            if (out.length() > 0) out.append(' ');
            out.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return out.toString();
    }

    private static String normalizeMinecraftId(String value) {
        if (value == null) return "";
        return value.replace("minecraft:", "").replaceFirst("^(block|item)/", "");
    }

    private static String normalizeIngredientId(String value) {
        if (value == null) return "";
        if (value.startsWith("#")) return "#" + normalizeMinecraftId(value.substring(1));
        return normalizeMinecraftId(value);
    }

    private static String string(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static final class BlockSpriteTextures {
        final Path top;
        final Path left;
        final Path right;
        final Map<String, String> textures;

        BlockSpriteTextures(Path top, Path left, Path right, Map<String, String> textures) {
            this.top = top;
            this.left = left;
            this.right = right;
            this.textures = textures;
        }

        boolean hasAny() {
            return top != null || left != null || right != null;
        }
    }

    public static final class BuildStats {
        public final int items;
        public final int sprites;
        public final int recipes;
        public final Path zip;

        public BuildStats(int items, int sprites, int recipes, Path zip) {
            this.items = items;
            this.sprites = sprites;
            this.recipes = recipes;
            this.zip = zip;
        }

        @Override
        public String toString() {
            return "Built " + items + " items, " + sprites + " sprites, " + recipes + " recipes.\nZip: " + zip;
        }
    }
}
