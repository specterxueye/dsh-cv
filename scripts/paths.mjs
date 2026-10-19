#!/usr/bin/env node
// Read-only resource/data discovery. No global variables, recursive search, or writes.
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--data-dir' || !args[1]) {
  console.error('用法: node <包根>/scripts/paths.mjs --data-dir <用户选择的数据目录>');
  process.exit(2);
}
const resourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(args[1]);
console.log(JSON.stringify({ resourceRoot, dataDir, outputDir: join(dataDir, 'output'), rulesDir: join(resourceRoot, 'data', 'rules'), schemaVersion: 1 }, null, 2));
