/**
 * Vercel runs the Next builder from repo root and expects `.next` there.
 * Our app lives in `taller/`, so after `next build` we mirror output to root.
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const sourceDir = path.join(rootDir, "taller", ".next");
const targetDir = path.join(rootDir, ".next");

if (!fs.existsSync(sourceDir)) {
  console.error(`[sync-next-output] Missing: ${sourceDir}`);
  process.exit(1);
}

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

fs.cpSync(sourceDir, targetDir, { recursive: true, dereference: true });
console.log(`[sync-next-output] ${sourceDir} -> ${targetDir}`);
