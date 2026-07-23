import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "scripts", "pwa", "sw-template.txt");
const outputPath = path.join(root, "public", "sw.js");
const versionInputs = [
  templatePath,
  path.join(root, "public", "offline.html"),
  path.join(root, "public", "icons", "icon-192x192.png"),
  path.join(root, "public", "icons", "icon-512x512.png"),
  path.join(root, "public", "icons", "icon-maskable-512x512.png"),
  path.join(root, "public", "icons", "apple-touch-icon.png"),
];

const [template, ...assets] = await Promise.all(
  versionInputs.map((filePath) => readFile(filePath)),
);
const version = createHash("sha256")
  .update(Buffer.concat([template, ...assets]))
  .digest("hex")
  .slice(0, 16);
const output = template.toString("utf8").replace("__PWA_VERSION__", version);

await writeFile(outputPath, output, "utf8");
console.log(`Generated public/sw.js (${version}).`);
