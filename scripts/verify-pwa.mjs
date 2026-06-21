import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedPngs = new Map([
  ["public/icons/icon-192x192.png", [192, 192]],
  ["public/icons/icon-512x512.png", [512, 512]],
  ["public/icons/icon-maskable-512x512.png", [512, 512]],
  ["public/icons/apple-touch-icon.png", [180, 180]],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  assert(
    signature === "89504e470d0a1a0a",
    "Expected a real PNG file, not a renamed JPEG.",
  );
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

for (const [relativePath, expected] of expectedPngs) {
  const buffer = await readFile(path.join(root, relativePath));
  const actual = pngDimensions(buffer);
  assert(
    actual[0] === expected[0] && actual[1] === expected[1],
    `${relativePath} must be ${expected.join("x")}, received ${actual.join("x")}.`,
  );
}

const serviceWorker = await readFile(
  path.join(root, "public", "sw.js"),
  "utf8",
);
assert(
  !serviceWorker.includes("__PWA_VERSION__"),
  "The generated service worker still contains its version placeholder.",
);
assert(
  serviceWorker.includes('url.pathname.startsWith("/api/")'),
  "The service worker must explicitly bypass API requests.",
);
assert(
  serviceWorker.includes('request.mode === "navigate"'),
  "The service worker must define navigation fallback behavior.",
);
assert(
  serviceWorker.includes('const OFFLINE_URL = "/offline.html"'),
  "The service worker must use the offline fallback.",
);

await Promise.all(
  [
    "public/offline.html",
    "src/app/manifest.ts",
    "src/components/pwa-registration.tsx",
  ].map((relativePath) => access(path.join(root, relativePath))),
);

console.log("PWA manifest, icons, service worker, and offline shell verified.");
