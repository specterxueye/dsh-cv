#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileDigest, planDigest, validateApproval } from './lib/approval.mjs';
import { writeJsonOutput } from './lib/output.mjs';

const [command, ...args] = process.argv.slice(2), options = {};
try {
  if (!['prepare', 'check'].includes(command)) throw new Error('用法: approval.mjs prepare --plan <方案.json> --out <申请单.json> [--base <原稿>] [--strategy <策略>] [--profile <事实基线>]；或 check --request <申请单> [对应文件参数]');
  for (let i = 0; i < args.length; i += 2) {
    if (!['--plan', '--out', '--base', '--strategy', '--profile', '--request'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || Object.hasOwn(options, args[i].slice(2))) throw new Error(`无效或重复参数 ${args[i]}`);
    options[args[i].slice(2)] = args[i + 1];
  }
  const json = path => JSON.parse(readFileSync(path, 'utf8'));
  if (command === 'prepare') {
    if (!options.plan || !options.out) throw new Error('prepare 需要 --plan 与 --out');
    const plan = json(options.plan);
    if (!options.base && plan.mode !== 'create') throw new Error('无原稿时方案必须明确 mode=create');
    const request = { ...plan, schemaVersion: 2, mode: options.base ? 'edit' : 'create', approved: false, approvedAt: '', touchedFields: plan.touchedFields || [], baseSha256: options.base ? fileDigest(options.base) : null, strategySha256: options.strategy ? fileDigest(options.strategy) : null, profileSha256: options.profile ? fileDigest(options.profile) : null };
    if (!Array.isArray(request.touchedFields) || request.touchedFields.some(path => typeof path !== 'string' || !path.trim())) throw new Error('touchedFields 必须为字段路径数组');
    request.planSha256 = planDigest(request);
    writeJsonOutput(options.out, request, { protectedPaths: [options.plan, options.base, options.strategy, options.profile].filter(Boolean) });
    console.log(`已准备未批准申请单：${options.out}；只有用户明确确认后才记录 approved 与 approvedAt，不能因生成申请单自动批准。`);
  } else {
    if (!options.request) throw new Error('check 需要 --request');
    validateApproval(json(options.request), options);
    console.log('本次批准记录及输入版本绑定通过；这不证明用户身份、内容真实性或稿件排版。');
  }
} catch (error) { console.error(`批准记录检查失败：${error.message}`); process.exitCode = command === 'check' ? 1 : 2; }
