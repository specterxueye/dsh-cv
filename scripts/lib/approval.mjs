import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const fileDigest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export function planDigest(request) {
  const { approved, approvedAt, planSha256, ...plan } = request;
  return createHash('sha256').update(JSON.stringify(canonical(plan))).digest('hex');
}
export function validateApproval(request, { base, strategy, profile } = {}) {
  if (request?.schemaVersion !== 2 || !['create', 'edit'].includes(request.mode)) throw new Error('批准记录须为 schemaVersion=2，并绑定本次基稿与方案；旧记录需重新确认');
  if (request.approved !== true || typeof request.approvedAt !== 'string' || !Number.isFinite(Date.parse(request.approvedAt))) throw new Error('尚未记录本次明确批准及有效 approvedAt 时间');
  if (!Array.isArray(request.touchedFields) || request.touchedFields.some(path => typeof path !== 'string' || !path.trim())) throw new Error('touchedFields 必须为非空字段路径组成的数组');
  if (request.mode === 'edit' && (!base || !request.baseSha256)) throw new Error('修改模式缺少原稿绑定');
  if (request.mode === 'create' && (base || request.baseSha256)) throw new Error('首次创建不应绑定不存在的原稿');
  for (const [key, path, label] of [['baseSha256', base, '原稿'], ['strategySha256', strategy, '策略'], ['profileSha256', profile, '事实基线']]) {
    if (path && request[key] == null) throw new Error(`${label}未绑定本次文件；必须重新 prepare 并审阅批准`);
    if (request[key] != null && (typeof request[key] !== 'string' || !/^[a-f\d]{64}$/i.test(request[key]) || !path || fileDigest(path) !== request[key].toLowerCase())) throw new Error(`${label}绑定不符或未提供对应文件；必须重新审阅批准`);
  }
  if (request.planSha256 !== planDigest(request)) throw new Error('方案 planSha256 不符；批准后的方案已变化，须重新确认');
  return request;
}
