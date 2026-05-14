import fs from "node:fs";
import path from "node:path";
import { spriteFromMaterialOrHead } from "./slimefun-head-textures.mjs";

const workspace = process.cwd();
const itemsSource = "C:/Users/alexa/Downloads/SlimefunItems.java";
const setupSource = "C:/Users/alexa/Downloads/SlimefunItemSetup.java";
const outputFile = path.join(workspace, "public/configs/slimefun-1.21.json");

const itemText = fs.readFileSync(itemsSource, "utf8");
const setupText = fs.readFileSync(setupSource, "utf8");

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

function slimefunCategory(group) {
  const normalized = group.trim();
  const collapsed = normalized.toLowerCase().startsWith("alloy") ? "Alloy" : normalized;
  return `SF_${collapsed.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Items"}`;
}

function sfId(value) {
  return `SF_${value}`;
}

function vanillaId(material) {
  return material.toLowerCase();
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
  const matches = [...value.matchAll(/"((?:\\.|[^"\\])*)"/g)];
  return matches.map((match) => match[1]);
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

function collectItemStatements(text) {
  const statements = [];
  let group = "Items";
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const comment = lines[index].match(/\/\*\s*([^*]+?)\s*\*\//);
    if (comment) group = comment[1].trim();
    if (!lines[index].includes("public static final SlimefunItemStack")) continue;

    let statement = lines[index];
    while (!statement.includes(";") && index < lines.length - 1) {
      index += 1;
      statement += `\n${lines[index]}`;
    }
    statements.push({ group, statement });
  }
  return statements;
}

function parseSlimefunItems() {
  const items = {};
  const variableToId = {};

  for (const { group, statement } of collectItemStatements(itemText)) {
    const variable = statement.match(/SlimefunItemStack\s+([A-Z0-9_]+)\s*=/)?.[1];
    const argsBody = firstCallArgs(statement, "SlimefunItemStack");
    if (!variable || !argsBody) continue;

    const args = splitTopLevel(argsBody);
    const rawId = stringLiterals(args[0] || "")[0] || variable;
    const literals = args.flatMap((arg) => stringLiterals(arg));
    const displayLiteral = literals.find((literal) => {
      if (!literal || literal === rawId) return false;
      if (/^[a-f0-9]{32,}$/i.test(literal)) return false;
      if (literal.includes("<ID>") || literal.includes("<Type>")) return false;
      return true;
    });
    const displayName = stripColors(displayLiteral || titleCase(rawId));
    const displayIndex = displayLiteral ? literals.indexOf(displayLiteral) : -1;
    const lore = literals
      .slice(displayIndex + 1)
      .map(stripColors)
      .filter((literal) => literal && !literal.includes("<ID>") && !literal.includes("<Type>"));

    const joinedArgs = args.join(", ");
    const material = joinedArgs.match(/Material\.([A-Z0-9_]+)/)?.[1];
    const id = sfId(rawId);
    variableToId[variable] = id;
    items[id] = {
      name: displayName,
      category: slimefunCategory(group),
      method: "slimefun",
      sprite: spriteFromMaterialOrHead(statement, args, material),
      notes: lore.join(" "),
    };
  }

  return { items, variableToId };
}

function collectRegisterStatements(text) {
  const statements = [];
  const lines = text.split(/\r?\n/);
  let current = "";
  for (const line of lines) {
    if (!current && !/^\s*new\s+\w+\(/.test(line)) continue;
    current += current ? `\n${line}` : line;
    if (current.includes(".register(plugin);")) {
      statements.push(current);
      current = "";
    }
  }
  return statements;
}

function extractArrayBody(statement) {
  const start = statement.indexOf("new ItemStack[]");
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

function parseStack(token, variableToId) {
  if (!token || token === "null") return null;
  const sfMatch = token.match(/SlimefunItems\.([A-Z0-9_]+)/);
  if (sfMatch) {
    return {
      id: variableToId[sfMatch[1]] || sfId(sfMatch[1]),
      qty: Number(token.match(/,\s*(\d+)\s*\)/)?.[1] || 1),
    };
  }
  const materialMatch = token.match(/Material\.([A-Z0-9_]+)/);
  if (materialMatch) {
    return {
      id: vanillaId(materialMatch[1]),
      qty: Number(token.match(/,\s*(\d+)\s*\)/)?.[1] || 1),
    };
  }
  return null;
}

function outputStackFromStatement(statement, variableToId) {
  const constructor = statement.match(/new\s+([A-Za-z0-9_]+)\s*\(/)?.[1];
  const argsBody = constructor ? firstCallArgs(statement, constructor) : null;
  if (!argsBody) return null;
  const args = splitTopLevel(argsBody);
  const recipeArrayIndex = args.findIndex((arg) => arg.includes("new ItemStack[]"));
  const outputCandidates = (recipeArrayIndex >= 0 ? args.slice(0, recipeArrayIndex) : args).filter((arg) => {
    if (/^itemGroups\.|^RecipeType\.|^new PotionEffect|^\"/.test(arg.trim())) return false;
    return true;
  });

  for (const arg of outputCandidates) {
    const stack = parseStack(arg, variableToId);
    if (stack) return stack;
  }
  return null;
}

function stationName(recipeType) {
  const custom = {
    ENHANCED_CRAFTING_TABLE: "Enhanced Crafting Table",
    MAGIC_WORKBENCH: "Magic Workbench",
    ARMOR_FORGE: "Armor Forge",
    GRIND_STONE: "Grind Stone",
    ORE_CRUSHER: "Ore Crusher",
    COMPRESSOR: "Compressor",
    SMELTERY: "Smeltery",
    ANCIENT_ALTAR: "Ancient Altar",
    PRESSURE_CHAMBER: "Pressure Chamber",
    ORE_WASHER: "Ore Washer",
    GOLD_PAN: "Gold Pan",
    JUICER: "Juicer",
  };
  return custom[recipeType] || titleCase(recipeType);
}

function recipeTypeFromStatement(statement) {
  const recipeType = statement.match(/RecipeType\.([A-Z0-9_]+)/)?.[1];
  if (recipeType) return recipeType;
  const constructor = statement.match(/new\s+([A-Za-z0-9_]+)\s*\(/)?.[1];
  const defaults = {
    AlloyIngot: "SMELTERY",
  };
  return defaults[constructor] || "";
}

function parseRecipes(variableToId) {
  const recipes = [];
  const stations = {};

  for (const statement of collectRegisterStatements(setupText)) {
    const outputStack = outputStackFromStatement(statement, variableToId);
    const recipeType = recipeTypeFromStatement(statement);
    const arrayBody = extractArrayBody(statement);
    if (!outputStack || !recipeType || !arrayBody) continue;

    const outputId = outputStack.id;
    const slots = splitTopLevel(arrayBody).slice(0, 9).map((token) => parseStack(token, variableToId));
    while (slots.length < 9) slots.push(null);

    const ingredients = {};
    for (const stack of slots) {
      if (!stack) continue;
      ingredients[stack.id] = (ingredients[stack.id] || 0) + stack.qty;
    }
    if (!Object.keys(ingredients).length) continue;

    const station = stationName(recipeType);
    stations[station] = { layout: "grid", columns: 3, rows: 3 };
    recipes.push({
      id: `${outputId.toLowerCase()}.${recipeType.toLowerCase()}`,
      output: { id: outputId, qty: outputStack.qty || 1 },
      type: "slimefun",
      station,
      ingredients,
      grid: [slots.slice(0, 3), slots.slice(3, 6), slots.slice(6, 9)].map((row) => row.map((stack) => stack?.id || "")),
    });
  }

  return { stations, recipes };
}

const { items, variableToId } = parseSlimefunItems();
const { stations, recipes } = parseRecipes(variableToId);

const config = {
  meta: {
    id: "slimefun-1.21",
    name: "Slimefun 1.21",
    type: "slimefun",
    spriteBase: "/sprites/",
  },
  extends: "minecraft-26.1.2",
  stations,
  items,
  recipes,
};

fs.writeFileSync(outputFile, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Generated ${Object.keys(items).length} Slimefun items and ${recipes.length} recipes at ${outputFile}`);
