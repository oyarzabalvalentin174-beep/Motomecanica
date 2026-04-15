const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "taller", ".next");
const targetDir = path.join(rootDir, ".next");

if (!fs.existsSync(sourceDir)) {
  console.error(`[build] Missing source output directory: ${sourceDir}`);
  process.exit(1);
}

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

const skipFolders = [`${path.sep}dev${path.sep}`, `${path.sep}cache${path.sep}`];

fs.cpSync(sourceDir, targetDir, {
  recursive: true,
  dereference: true,
  filter: (src) => !skipFolders.some((part) => src.includes(part)),
});
console.log(`[build] Synced Next output: ${sourceDir} -> ${targetDir}`);
