import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const assets = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const appRoot = resolve(process.argv[2] ?? ".");
const dest = resolve(appRoot, "public/brand");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(assets, dest, { recursive: true });
mkdirSync(resolve(appRoot, "app"), { recursive: true });
cpSync(resolve(assets, "favicon.ico"), resolve(appRoot, "app/favicon.ico"));
