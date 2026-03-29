import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2];

const targets = {
  web: {
    roots: ["apps/forgesync/src"],
    allowConsole: new Set([
      "apps/forgesync/src/app/api/agent/_embeddings.ts",
      "apps/forgesync/src/lib/env.ts",
    ]),
  },
  cli: {
    roots: ["packages/forgesync-cli/src"],
    allowConsole: new Set(["packages/forgesync-cli/src/index.ts"]),
  },
};

if (!target || !(target in targets)) {
  console.error('Usage: node scripts/lint.mjs <web|cli>');
  process.exit(1);
}

const todoPattern = /\b(?:TODO|FIXME)\b/;
const consolePattern = /\bconsole\.(?:log|warn|error|info|debug)\b/;
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const failures = [];

async function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    const nextRelative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await walk(nextRelative);
      continue;
    }

    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const content = await fs.readFile(path.join(root, nextRelative), "utf8");
    if (todoPattern.test(content)) {
      failures.push(`${nextRelative}: contains TODO/FIXME markers`);
    }

    if (target === "web" && consolePattern.test(content) && !targets[target].allowConsole.has(nextRelative)) {
      failures.push(`${nextRelative}: uses console.* outside the approved logging entrypoints`);
    }
  }
}

for (const relativeDir of targets[target].roots) {
  await walk(relativeDir);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`lint:${target} passed`);
