import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");
const serverPath = path.resolve(siteRoot, "../../packages/mcp/src/server.ts");
const examplesPath = path.join(here, "examples.json");
const outPath = path.join(siteRoot, "generated/tools.json");

if (!fs.existsSync(serverPath)) {
  if (!fs.existsSync(outPath)) {
    console.error("The MCP server source is missing, and generated/tools.json is missing.");
    process.exit(1);
  }
  console.log("The MCP server source is outside this build. The committed tool file stays.");
  process.exit(0);
}

const source = fs.readFileSync(serverPath, "utf8");
const examples = JSON.parse(fs.readFileSync(examplesPath, "utf8"));
const tools = extractTools(source);
const server = extractServer(source);

const names = new Set(tools.map((tool) => tool.name));
if (names.size !== tools.length) {
  fail("A tool name is repeated in the MCP server.");
}

for (const name of Object.keys(examples)) {
  if (!names.has(name)) fail(`examples.json has ${name}, and the server does not register that tool.`);
}

for (const tool of tools) {
  const example = examples[tool.name];
  if (!example || example.call == null || example.result === undefined) {
    fail(`${tool.name} needs an example call and an example result in scripts/examples.json.`);
  }
  checkCall(tool, example.call);
  tool.exampleCall = example.call;
  tool.exampleResult = example.result;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const body = {
  source: "packages/mcp/src/server.ts",
  server: server.name,
  version: server.version,
  tools,
};
fs.writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`);
console.log(`Wrote ${tools.length} tools to generated/tools.json.`);

function extractServer(text) {
  const match = text.match(/new McpServer\(\{\s*name:\s*"([^"]+)",\s*version:\s*"([^"]+)"/);
  if (!match) fail("The server name and version were not found.");
  return { name: match[1], version: match[2] };
}

function extractTools(text) {
  const tools = [];
  const re = /server\.registerTool\(\s*"([^"]+)"\s*,\s*\{/g;
  let match;
  while ((match = re.exec(text))) {
    const name = match[1];
    const braceAt = match.index + match[0].length - 1;
    const block = sliceBalanced(text, braceAt);
    const schemaAt = block.indexOf("inputSchema");
    if (schemaAt < 0) fail(`${name} has no inputSchema.`);
    const schemaBrace = block.indexOf("{", schemaAt);
    const schema = sliceBalanced(block, schemaBrace);
    tools.push({
      name,
      title: grabString(block, "title"),
      description: grabString(block, "description"),
      input: parseSchema(schema),
    });
  }
  if (tools.length === 0) fail("No registerTool calls were found.");
  return tools;
}

function parseSchema(schema) {
  const inner = schema.slice(1, -1);
  const fields = [];
  for (const part of splitTopLevel(inner)) {
    const match = part.match(/^([A-Za-z0-9_]+)\s*:\s*([\s\S]+)$/);
    if (!match) continue;
    fields.push(describeZod(match[1], match[2].trim().replace(/,\s*$/, "")));
  }
  return fields;
}

function describeZod(name, expr) {
  let type = "unknown";
  const enumMatch = expr.match(/z\.enum\(\s*\[([\s\S]*?)\]\s*\)/);
  if (/z\.array\(/.test(expr)) type = "string[]";
  else if (enumMatch) {
    type = [...enumMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]).join(" | ");
  } else if (/z\.string\(/.test(expr)) type = "string";
  else if (/z\.number\(/.test(expr)) type = "number";
  else if (/z\.boolean\(/.test(expr)) type = "boolean";
  if (type === "unknown" || type === "") fail(`The type of ${name} was not read from: ${expr}`);
  const described = expr.match(/\.describe\(\s*"((?:\\.|[^"\\])*)"\s*\)/);
  return {
    name,
    type,
    required: !/\.optional\(\)/.test(expr),
    description: described ? JSON.parse(`"${described[1]}"`) : "",
  };
}

function checkCall(tool, call) {
  if (!call || typeof call !== "object" || Array.isArray(call)) {
    fail(`${tool.name} example call must be an object.`);
  }
  for (const field of tool.input) {
    if (field.required && !(field.name in call)) {
      fail(`${tool.name} example call is missing ${field.name}.`);
    }
  }
  for (const [key, value] of Object.entries(call)) {
    const field = tool.input.find((item) => item.name === key);
    if (!field) fail(`${tool.name} example call has unknown field ${key}.`);
    checkType(tool.name, field, value);
  }
}

function checkType(toolName, field, value) {
  const label = `${toolName}.${field.name}`;
  if (field.type === "string" && typeof value !== "string") fail(`${label} must be a string.`);
  if (field.type === "number" && typeof value !== "number") fail(`${label} must be a number.`);
  if (field.type === "boolean" && typeof value !== "boolean") fail(`${label} must be a boolean.`);
  if (field.type === "string[]") {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      fail(`${label} must be an array of strings.`);
    }
  }
  if (field.type.includes(" | ")) {
    const allowed = field.type.split(" | ");
    if (!allowed.includes(String(value))) fail(`${label} must be one of: ${field.type}.`);
  }
}

function grabString(block, key) {
  const match = block.match(new RegExp(`${key}:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) fail(`Missing ${key}.`);
  return JSON.parse(`"${match[1]}"`);
}

function sliceBalanced(text, openIndex) {
  const open = text[openIndex];
  const close = open === "{" ? "}" : open === "(" ? ")" : "]";
  let depth = 0;
  let quote = null;
  let escape = false;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  fail("A bracket was not closed in the MCP server source.");
}

function splitTopLevel(text) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
