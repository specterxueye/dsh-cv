export const factMetadataKeys = new Set(['_meta', '_rules', 'pendingFacts', 'source', 'sources', 'factId', 'evidenceStatus', 'confirmedAt']);
export function assertUserDocument(document) {
  const kind = document?._meta?.kind || document?.kind;
  if (['template', 'example', 'synthetic-example'].includes(kind)) throw new Error('模板/示例不能作为用户履历或事实语料；请另建本人确认的事实文件');
}
export function hasSource(source) {
  return typeof source === 'string' ? !!source.trim() : !!source && typeof source === 'object' && typeof source.kind === 'string' && !!source.kind.trim() && typeof source.reference === 'string' && !!source.reference.trim();
}

// Strictly unwrap explicit facts. Legacy plain fields remain usable without
// inventing a confirmation status for them. Metadata is never a visible value.
export function prepareUserFacts(document) {
  assertUserDocument(document);
  function visit(value, path) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v, i) => visit(v, `${path}[${i}]`));
    assertUserDocument(value);
    if (Object.hasOwn(value, 'status')) {
      if (value.status !== 'confirmed') throw new Error(`${path}: status=${value.status}，仅 confirmed 事实可进入生成；待核项请留在 pendingFacts`);
      if (!hasSource(value.source)) throw new Error(`${path}: 已确认事实缺少 source 来源`);
      if (Object.hasOwn(value, 'value')) return visit(value.value, `${path}.value`);
    }
    return Object.fromEntries(Object.entries(value).filter(([key]) => !factMetadataKeys.has(key)).map(([key, v]) => [key, visit(v, path ? `${path}.${key}` : key)]));
  }
  return visit(document, '');
}
