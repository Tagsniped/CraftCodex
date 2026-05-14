import fs from "node:fs";
import path from "node:path";
import { spriteFromMaterialOrHead } from "./slimefun-head-textures.mjs";

const workspace = process.cwd();
const sourceDir = "C:/Users/alexa/Downloads/items";
const outputFile = path.join(workspace, "public/configs/slimefun-mcpe.json");
const packPrefix = "SF_MCPE_";
const slimefunItemAliases = {
  NETHER_STAR_REACTOR: "SF_NETHERSTAR_REACTOR",
  REACTOR_COOLANT_CELL: "SF_REACTOR_COLLANT_CELL",
};

function stripColors(value) {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&[0-9a-fk-or]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function categoryId(group) {
  return `SF_MCPE_${group.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Items"}`;
}

function mcpeId(rawId) {
  return `${packPrefix}${rawId}`;
}

function vanillaId(material) {
  return material.toLowerCase();
}

function readJavaFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return readJavaFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".java") ? [fullPath] : [];
  });
}

function splitTopLevel(value) {
  const parts = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (const char of value) {
    if (inString) {
      current += char;
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      current += char;
      continue;
    }

    if (char === "(" || char === "{" || char === "[") depth += 1;
    if (char === ")" || char === "}" || char === "]") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function stringLiterals(value) {
  return [...value.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((match) => match[1]);
}

function firstCallArgs(statement, callName) {
  const start = statement.indexOf(`${callName}(`);
  if (start < 0) return null;
  let index = start + callName.length + 1;
  let depth = 1;
  let inString = false;
  let escape = false;
  let body = "";

  for (; index < statement.length; index += 1) {
    const char = statement[index];
    if (inString) {
      body += char;
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      body += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0) return body;
    body += char;
  }
  return null;
}

function allCallArgs(statement, callName) {
  const calls = [];
  let offset = 0;
  while (offset < statement.length) {
    const start = statement.indexOf(`${callName}(`, offset);
    if (start < 0) break;
    const source = statement.slice(start);
    const args = firstCallArgs(source, callName);
    if (args) calls.push(args);
    offset = start + callName.length + 1;
  }
  return calls;
}

function classNameFor(filePath) {
  return path.basename(filePath, ".java");
}

function defaultGroupFor(filePath) {
  const relative = path.relative(sourceDir, filePath);
  const folder = relative.includes(path.sep) ? relative.split(path.sep)[0] : classNameFor(filePath);
  return titleCase(folder);
}

function collectStatements(text, predicate) {
  const statements = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!predicate(lines[index])) continue;
    let statement = lines[index];
    while (!statement.includes(";") && index < lines.length - 1) {
      index += 1;
      statement += `\n${lines[index]}`;
    }
    statements.push(statement);
  }
  return statements;
}

function parseDisplayFromArgs(rawId, variable, args, fallbackName) {
  const literals = args.flatMap((arg) => stringLiterals(arg));
  const displayLiteral = literals.find((literal) => {
    if (!literal || literal === rawId) return false;
    if (/^[a-f0-9]{32,}$/i.test(literal)) return false;
    if (literal.includes("<ID>") || literal.includes("<Type>")) return false;
    return true;
  });
  const displayName = stripColors(displayLiteral || fallbackName || titleCase(rawId || variable));
  const displayIndex = displayLiteral ? literals.indexOf(displayLiteral) : -1;
  const lore = literals
    .slice(displayIndex + 1)
    .map(stripColors)
    .filter((literal) => literal && !literal.includes("<ID>") && !literal.includes("<Type>"));
  return { displayName, lore };
}

function parseItems(files) {
  const items = {};
  const variableToId = {};
  const qualifiedToId = {};

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    const klass = classNameFor(filePath);
    const group = defaultGroupFor(filePath);
    const statements = collectStatements(text, (line) => /static\s+final\s+SlimefunItemStack\s+[A-Z0-9_]+\s*=/.test(line));

    for (const statement of statements) {
      const variable = statement.match(/SlimefunItemStack\s+([A-Z0-9_]+)\s*=/)?.[1];
      if (!variable) continue;

      let rawId = variable;
      let displayName = titleCase(variable);
      let lore = [];
      let material = statement.match(/Material\.([A-Z0-9_]+)/)?.[1];
      let spriteArgs = [];
      const constructorArgs = firstCallArgs(statement, "SlimefunItemStack");

      if (constructorArgs) {
        const args = splitTopLevel(constructorArgs);
        spriteArgs = args;
        rawId = stringLiterals(args[0] || "")[0] || variable;
        const parsed = parseDisplayFromArgs(rawId, variable, args);
        displayName = parsed.displayName;
        lore = parsed.lore;
      } else if (statement.includes("MobDataCard.create(")) {
        const args = splitTopLevel(firstCallArgs(statement, "create") || "");
        const mobName = stripColors(stringLiterals(args[0] || "")[0] || titleCase(variable));
        rawId = `${mobName.toUpperCase().replace(/\s+/g, "_")}_DATA_CARD`;
        displayName = `${mobName} Data Card`;
        lore = ["Place in a mob simulation chamber to activate"];
        material = null;
      } else if (statement.includes("Oscillator.create(")) {
        const materialName = statement.match(/Material\.([A-Z0-9_]+)/)?.[1] || variable.replace(/_OSCILLATOR$/, "");
        rawId = `QUARRY_OSCILLATOR_${materialName}`;
        displayName = `${titleCase(materialName)} Oscillator`;
        lore = ["Place in a quarry to give it a chance of mining this material"];
        material = materialName;
      }

      const id = mcpeId(rawId);
      variableToId[variable] = id;
      qualifiedToId[`${klass}.${variable}`] = id;
      items[id] = {
        name: displayName,
        category: categoryId(group),
        method: "slimefun",
        sprite: spriteFromMaterialOrHead(statement, spriteArgs, material),
        notes: lore.join(" "),
      };
    }
  }

  return { items, variableToId, qualifiedToId };
}

function extractArrayBody(statement) {
  const itemStackStart = statement.indexOf("new ItemStack[]");
  const slimefunStackStart = statement.indexOf("new SlimefunItemStack[]");
  const start = itemStackStart >= 0 ? itemStackStart : slimefunStackStart;
  if (start < 0) return null;
  const open = statement.indexOf("{", start);
  if (open < 0) return null;
  let depth = 1;
  let inString = false;
  let escape = false;
  let body = "";

  for (let index = open + 1; index < statement.length; index += 1) {
    const char = statement[index];
    if (inString) {
      body += char;
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      body += char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return body;
    body += char;
  }
  return null;
}

function itemFromReference(token, maps) {
  const trimmed = token.trim();
  if (!trimmed || trimmed === "null") return null;

  const slimefunRef = trimmed.match(/SlimefunItems\.([A-Z0-9_]+)/);
  if (slimefunRef) return { id: slimefunItemAliases[slimefunRef[1]] || `SF_${slimefunRef[1]}`, qty: quantityFromToken(trimmed) };

  const materialRef = trimmed.match(/Material\.([A-Z0-9_]+)/);
  if (materialRef && !trimmed.includes("SlimefunItems.")) return { id: vanillaId(materialRef[1]), qty: quantityFromToken(trimmed) };

  const qualifiedRef = trimmed.match(/\b([A-Z][A-Za-z0-9_]*)\.([A-Z][A-Z0-9_]+)\b/);
  if (qualifiedRef) {
    const id = maps.qualifiedToId[`${qualifiedRef[1]}.${qualifiedRef[2]}`] || maps.variableToId[qualifiedRef[2]];
    if (id) return { id, qty: quantityFromToken(trimmed) };
  }

  const bareRef = trimmed.match(/(?:new SlimefunItemStack\()?([A-Z][A-Z0-9_]+)\b/);
  if (bareRef && maps.variableToId[bareRef[1]]) return { id: maps.variableToId[bareRef[1]], qty: quantityFromToken(trimmed) };

  return null;
}

function parseAuxiliaryRecipeSets(files, maps) {
  const randomSets = {};
  const mappedSets = {};

  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    const randomStatements = collectStatements(text, (line) => /RandomizedItemStack\s+[a-zA-Z0-9_]+\s*=/.test(line));
    for (const statement of randomStatements) {
      const variable = statement.match(/RandomizedItemStack\s+([a-zA-Z0-9_]+)\s*=/)?.[1];
      const args = splitTopLevel(firstCallArgs(statement, "RandomizedItemStack") || "");
      if (variable) randomSets[variable] = args.map((token) => itemFromReference(token, maps)).filter(Boolean);
    }

    const mapStatements = collectStatements(text, (line) => /\b(crops|trees)\.put\(/.test(line));
    for (const statement of mapStatements) {
      const setName = statement.match(/\b(crops|trees)\.put\(/)?.[1];
      const args = splitTopLevel(firstCallArgs(statement, "put") || "");
      const input = itemFromReference(args[0] || "", maps);
      const body = extractArrayBody(args.slice(1).join(", "));
      const outputs = body ? splitTopLevel(body).map((token) => itemFromReference(token, maps)).filter(Boolean) : [];
      if (setName && input && outputs.length) {
        mappedSets[setName] = [...(mappedSets[setName] || []), { input, outputs }];
      }
    }
  }

  return { randomSets, mappedSets };
}

function quantityFromToken(token) {
  const args = firstCallArgs(token, "ItemStack") || firstCallArgs(token, "SlimefunItemStack");
  if (!args) return 1;
  const parts = splitTopLevel(args);
  const count = Number.parseInt((parts[1] || "").replace(/_/g, ""), 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function recipeStation(statement) {
  if (statement.includes("InfinityWorkbench.TYPE")) return "Infinity Workbench";
  if (statement.includes("registerEnhanced(")) return "Enhanced Crafting Table";
  const recipeType = statement.match(/RecipeType\.([A-Z0-9_]+)/)?.[1];
  if (recipeType) return titleCase(recipeType);
  const customType = statement.match(/\b([A-Z][A-Za-z0-9_]*)\.TYPE\b/)?.[1];
  if (customType) return titleCase(customType.replace(/([a-z])([A-Z])/g, "$1_$2"));
  if (/new StorageUnit\(/.test(statement)) return "Storage Forge";
  if (/new MobDataCard\(/.test(statement)) return "Mob Data Infuser";
  if (/new Singularity\(/.test(statement)) return "Singularity Constructor";
  return "Enhanced Crafting Table";
}

function collectRecipeStatements(files) {
  const statements = [];
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.split(/\r?\n/);
    let current = "";
    for (const line of lines) {
      const beginsRecipe =
        !current &&
        (
          (/(?:new\s+\w+\(|register(?:Enhanced)?\()/.test(line) && line.includes("new ItemStack")) ||
          /registerSmeltery\(|new Singularity\(/.test(line)
        );
      if (!current && !beginsRecipe) continue;
      current += current ? `\n${line}` : line;
      if (current.includes(";")) {
        if (current.includes("new ItemStack[]") || /registerSmeltery\(|new Singularity\(/.test(current)) statements.push(current);
        current = "";
      }
    }
  }
  return statements;
}

function helperRecipe(statement, maps) {
  if (statement.includes("registerSmeltery(")) {
    const args = splitTopLevel(firstCallArgs(statement, "registerSmeltery") || "");
    const output = itemFromReference(args[0] || "", maps)?.id;
    const slots = args.slice(1).map((token) => itemFromReference(token, maps));
    return output ? { output, station: "Smeltery", slots } : null;
  }

  if (statement.includes("new Singularity(")) {
    const args = splitTopLevel(firstCallArgs(statement, "Singularity") || "");
    const output = itemFromReference(args[0] || "", maps)?.id;
    const input = itemFromReference(args[1] || "", maps);
    const qty = Number.parseInt((args[2] || "").replace(/_/g, ""), 10);
    if (input && Number.isFinite(qty) && qty > 0) input.qty = qty;
    return output ? { output, station: "Singularity Constructor", slots: input ? [input] : [] } : null;
  }

  return null;
}

function findOutput(statement, maps) {
  const arrayIndex = statement.indexOf("new ItemStack[]");
  const prefix = arrayIndex >= 0 ? statement.slice(0, arrayIndex) : statement;
  const matches = [...prefix.matchAll(/\b(?:(SlimefunItems|Material|[A-Z][A-Za-z0-9_]*)\.)?([A-Z][A-Z0-9_]+)\b/g)];
  const candidates = [];

  for (const match of matches) {
    const qualifier = match[1];
    const name = match[2];
    if (["Groups", "RecipeType", "Material", "SlimefunItems", "LoreBuilder", "MachineLore"].includes(qualifier)) continue;
    if (["TYPE", "BASIC_AMOUNT", "ADVANCED_AMOUNT", "REINFORCED_AMOUNT", "VOID_AMOUNT", "INFINITY_AMOUNT"].includes(name)) continue;
    const id = qualifier ? maps.qualifiedToId[`${qualifier}.${name}`] || maps.variableToId[name] : maps.variableToId[name];
    if (id) candidates.push(id);
  }

  return candidates.at(-1) || null;
}

function ingredientsFromSlots(slots) {
  const ingredients = {};
  for (const slot of slots) {
    if (!slot) continue;
    ingredients[slot.id] = (ingredients[slot.id] || 0) + slot.qty;
  }
  return ingredients;
}

function gridFromSlots(slots, columns, rows) {
  const ids = slots.map((slot) => slot?.id || "");
  while (ids.length < columns * rows) ids.push("");
  const grid = [];
  for (let row = 0; row < rows; row += 1) {
    grid.push(ids.slice(row * columns, row * columns + columns));
  }
  return grid;
}

function pushRecipe(recipes, seen, recipe) {
  const flatGrid = (recipe.grid || []).flat();
  const key = `${recipe.output.id}|${recipe.station}|${recipe.output.qty}|${flatGrid.join(",")}|${JSON.stringify(recipe.ingredients)}`;
  if (seen.has(key)) return;
  seen.add(key);
  recipes.push({ ...recipe, id: `${recipe.output.id.toLowerCase()}_${recipes.length + 1}` });
}

function machineStationName(output, items) {
  return items[output]?.name || titleCase(output.replace(packPrefix, ""));
}

function additionalMachineRecipes(statement, maps, items) {
  const parentOutput = findOutput(statement, maps);
  if (!parentOutput) return [];
  const station = machineStationName(parentOutput, items);
  const recipes = [];

  for (const callArgs of allCallArgs(statement, "addRecipe")) {
    const args = splitTopLevel(callArgs);
    const outputToken = args[0] || "";
    const outputs = maps.randomSets?.[outputToken.trim()] || [itemFromReference(outputToken, maps)].filter(Boolean);
    const inputs = args.slice(1).map((token) => itemFromReference(token, maps)).filter(Boolean);
    if (!outputs.length || !inputs.length) continue;
    for (const output of outputs) {
      recipes.push({
        output,
        station,
        slots: inputs,
      });
    }
  }

  const recipeArray = firstCallArgs(statement, "recipes");
  if (recipeArray?.includes("new SlimefunItemStack[]")) {
    const body = extractArrayBody(recipeArray);
    const entries = body ? splitTopLevel(body).map((token) => itemFromReference(token, maps)) : [];
    for (let index = 0; index < entries.length; index += 3) {
      const inputA = entries[index];
      const inputB = entries[index + 1];
      const output = entries[index + 2];
      if (!output || !inputA || !inputB) continue;
      recipes.push({ output, station, slots: [inputA, inputB] });
    }
  }

  const mappedSet = recipeArray?.match(/\b(crops|trees)\b/)?.[1];
  if (mappedSet && maps.mappedSets?.[mappedSet]) {
    for (const entry of maps.mappedSets[mappedSet]) {
      for (const output of entry.outputs) {
        recipes.push({ output, station, slots: [entry.input] });
      }
    }
  }

  return recipes;
}

function parseRecipes(files, maps, items) {
  const recipes = [];
  const stations = {};
  const seen = new Set();

  for (const statement of collectRecipeStatements(files)) {
    for (const machineRecipe of additionalMachineRecipes(statement, maps, items)) {
      const columns = Math.max(1, Math.min(3, machineRecipe.slots.length));
      const rows = Math.max(1, Math.ceil(machineRecipe.slots.length / columns));
      stations[machineRecipe.station] = { layout: "grid", columns, rows };
      pushRecipe(recipes, seen, {
        output: { id: machineRecipe.output.id, qty: machineRecipe.output.qty },
        type: "slimefun",
        station: machineRecipe.station,
        ingredients: ingredientsFromSlots(machineRecipe.slots),
        grid: gridFromSlots(machineRecipe.slots, columns, rows),
      });
    }

    const helper = helperRecipe(statement, maps);
    const arrayBody = extractArrayBody(statement);
    const output = helper?.output || findOutput(statement, maps);
    if (!output || (!arrayBody && !helper)) continue;

    const slots = helper?.slots || splitTopLevel(arrayBody).map((token) => itemFromReference(token, maps));
    const station = helper?.station || recipeStation(statement);
    const columns = slots.length > 9 || station === "Infinity Workbench" ? 6 : 3;
    const rows = Math.max(columns === 6 ? 6 : 3, Math.ceil(slots.length / columns));
    const paddedSlots = [...slots];
    while (paddedSlots.length < columns * rows) paddedSlots.push(null);
    const key = `${output}|${station}|${paddedSlots.map((slot) => `${slot?.id || ""}:${slot?.qty || ""}`).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    stations[station] = { layout: "grid", columns, rows };
    const group = statement.match(/Groups\.([A-Z0-9_]+)/)?.[1];
    if (group && items[output]) items[output].category = categoryId(titleCase(group));

    recipes.push({
      id: `${output.toLowerCase()}_${recipes.length + 1}`,
      output: { id: output, qty: 1 },
      type: "slimefun",
      station,
      ingredients: ingredientsFromSlots(paddedSlots),
      grid: gridFromSlots(paddedSlots, columns, rows),
    });
  }

  return { recipes, stations };
}

function main() {
  const files = readJavaFiles(sourceDir);
  const maps = parseItems(files);
  Object.assign(maps, parseAuxiliaryRecipeSets(files, maps));
  const { recipes, stations } = parseRecipes(files, maps, maps.items);

  const config = {
    meta: {
      id: "slimefun-mcpe",
      name: "Slimefun MCPE",
      version: "1.21",
      type: "slimefun-extension",
      extends: "slimefun-1.21",
      source: "InfinityExpansion Slimefun extension Java sources",
    },
    extends: "slimefun-1.21",
    items: maps.items,
    recipes,
    stations,
    tags: {},
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Generated ${Object.keys(config.items).length} Slimefun MCPE items and ${recipes.length} recipes at ${outputFile}`);
}

main();
