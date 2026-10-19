import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { sandbox } from './helpers.mjs';

for (const [name, content, source, expected] of [
  ['whole percentage', '提升25%', '另一个指标125%', 1],
  ['valid percentage', '提升25%', '用户确认提升25%', 0],
  ['long content', `${'正文'.repeat(2500)} 达到987654321`, '只有已确认职责', 1],
  ['unknown unit value', 'Latency 987ms', '只有已确认职责', 1],
  ['valid unit value', 'Latency 987ms', 'Latency 987ms', 0],
  ['date separator', '2023.09 - 2027.06', '2023/09 - 2027/06', 0],
  ['thousands separator', '共1,234条', '共1234条', 0],
  ['whole decimal', '指标0.9744', '指标10.9744', 1],
  ['UUID prefix in real content', '12345678-abcd 是项目代号，处理98765次', '已确认职责', 1],
]) {
  test(`number audit handles ${name}`, (t) => {
    const s = sandbox(t);
    const result = s.run('audit-facts.mjs', [s.json('resume.json', { description: content }), '--profile', s.json('source.json', { description: source })]);
    assert.equal(result.status, expected, result.stdout + result.stderr);
  });
}

test('certificate content is included in number audit', (t) => {
  const s = sandbox(t);
  const result = s.run('audit-facts.mjs', [s.json('resume.json', { certificates: ['取得98765分'] }), '--profile', s.json('source.json', { description: '已确认职责' })]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test('Markdown pitch audit supports sourced and unsourced text', (t) => {
  const s = sandbox(t), pitch = join(s.dir, 'pitch.md'), source = s.json('source.json', { description: '处理25次任务' });
  writeFileSync(pitch, '# 项目讲稿\n我处理25次任务。');
  assert.equal(s.run('audit-facts.mjs', [pitch, '--profile', source]).status, 0);
  writeFileSync(pitch, '# 项目讲稿\n我处理98765次任务。');
  assert.equal(s.run('audit-facts.mjs', [pitch, '--profile', source]).status, 1);
});

test('number audit accepts flags before the document path', (t) => {
  const s = sandbox(t);
  const result = s.run('audit-facts.mjs', ['--profile', s.json('source.json', { description: '125%' }), s.json('resume.json', { description: '25%' })]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test('an explicitly missing source cannot silently disappear from the audit', (t) => {
  const s = sandbox(t);
  const result = s.run('audit-facts.mjs', [s.json('resume.json', { description: '25%' }), '--profile', s.json('source.json', { description: '25%' }), '--corpus', join(s.dir, 'missing.md')]);
  assert.equal(result.status, 2, result.stdout + result.stderr);
});

test('audit states its semantic limits even when there are no numbers', (t) => {
  const s = sandbox(t);
  const result = s.run('audit-facts.mjs', [s.json('resume.json', { description: '未经核验的职责' }), '--profile', s.json('source.json', { description: '本人确认的职责' })]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /不代表.*真实性|不.*证明.*真实/);
});

test('retracted source lines cannot authorize a number', (t) => {
  const s = sandbox(t), source = join(s.dir, 'source.md');
  writeFileSync(source, '【作废】旧口径98765次\n当前口径25次');
  const result = s.run('audit-facts.mjs', [s.json('resume.json', { description: '98765次' }), '--corpus', source]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test('invalid JSON is a configuration error rather than an audit verdict', t => {
  const s = sandbox(t), file = join(s.dir, 'broken.json');
  writeFileSync(file, '{invalid');
  const result = s.run('audit-facts.mjs', [file, '--profile', s.json('source.json', { description: '25次' })]);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /无法读取或解析/);
});
