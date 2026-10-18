import { lstatSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

function entry(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function defaultOutputPath(root, name) {
  if (typeof name !== 'string' || !name.trim() || name !== name.trim() ||
      /[<>:"/\\|?*\u0000-\u001f]/.test(name) || /[. ]$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    throw new Error('默认输出名必须是单个合法文件名，不能含路径、盘符、控制字符或保留名；自选目录请使用 --out');
  }
  const outputRoot = join(root, 'output');
  if (entry(outputRoot)?.isSymbolicLink()) throw new Error('默认 output 目录不能是符号链接或目录联接');
  const file = resolve(outputRoot, `${name}.json`);
  const child = relative(outputRoot, file);
  if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error('默认输出路径超出 output 目录');
  return file;
}

function sameFile(a, b) {
  const normalize = p => process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);
  if (normalize(a) === normalize(b)) return true;
  if (!entry(a) || !entry(b)) return false;
  const left = statSync(a), right = statSync(b);
  return left.ino !== 0 && left.dev === right.dev && left.ino === right.ino;
}

export function writeJsonOutput(path, data, { force = false, protectedPaths = [] } = {}) {
  if (protectedPaths.some(input => sameFile(path, input))) throw new Error('输出不能覆盖输入文件或其硬链接别名');
  const target = entry(path);
  if (target && (!target.isFile() || target.isSymbolicLink())) throw new Error('输出目标必须是普通文件，不能是链接或目录');
  mkdirSync(dirname(path), { recursive: true });
  const serialized = JSON.stringify(data, null, 2);
  try {
    if (!force) writeFileSync(path, serialized, { encoding: 'utf8', flag: 'wx' });
    else {
      // 替换目录项而非截断原 inode；其他硬链接持有的文件保持完整。
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
        renameSync(temporary, path);
      } finally { if (entry(temporary)) unlinkSync(temporary); }
    }
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('输出已存在，未覆盖；确认替换输出后使用 --force');
    throw error;
  }
}
