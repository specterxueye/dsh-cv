// This function is serialized into the browser by Playwright. Keep it standalone.
function measurePageGeometry() {
  const visible = el => {
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    return el.getClientRects().length > 0;
  };
  const papers = [...document.querySelectorAll('[class*="210mm"]')].filter(visible);
  if (papers.length !== 1) return { result: 'UNKNOWN', reason: '未找到唯一可见纸张' };
  const paper = papers[0], rect = paper.getBoundingClientRect();
  const scale = rect.width / paper.offsetWidth;
  if (!Number.isFinite(scale) || scale <= 0 || !paper.offsetHeight || Math.abs(rect.height / paper.offsetHeight - scale) > 0.05) return { result: 'UNKNOWN', reason: '纸张缩放无法确认' };
  const y = value => +((value - rect.top) / scale).toFixed(2);
  const markPattern = /^第\s*(\d+)\s*页(?:结束)?$/;
  const marks = [], markerNodes = new Set();
  for (const el of document.querySelectorAll('*')) {
    const match = (el.textContent || '').trim().match(markPattern);
    if (!match || !visible(el) || [...el.children].some(c => markPattern.test(c.textContent.trim()))) continue;
    const r = el.getBoundingClientRect();
    if (r.right < rect.left || r.left > rect.right || r.bottom <= rect.top) continue;
    marks.push({ page: Number(match[1]), text: el.textContent.trim(), top: y(r.top), bottom: y(r.bottom) });
    markerNodes.add(el);
  }
  const first = marks.filter(m => m.page === 1).sort((a, b) => a.bottom - b.bottom)[0];
  if (!first) return { result: 'UNKNOWN', reason: '缺少第 1 页分页边界', marks };
  const markerAncestor = el => { for (let p = el; p; p = p.parentElement) if (markerNodes.has(p)) return true; return false; };
  let lastText = null, contentBottom = 0, textRects = 0, graphicCount = 0, horizontalOverflow = false;
  const record = r => {
    if (r.width <= 0 || r.height <= 0) return;
    contentBottom = Math.max(contentBottom, y(r.bottom));
    if (r.left < rect.left - 2 * scale || r.right > rect.right + 2 * scale) horizontalOverflow = true;
  };
  const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.textContent.trim() || !visible(parent) || markerAncestor(parent) || parent.closest('script,style,noscript,template')) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (!r.width || !r.height) continue;
      record(r); textRects++;
      if (!lastText || y(r.bottom) > lastText.y) lastText = { text: node.textContent.trim().slice(0, 40), y: y(r.bottom) };
    }
  }
  for (const el of paper.querySelectorAll('img,svg,canvas,video,iframe,object')) {
    if (!visible(el) || markerAncestor(el)) continue;
    if (el.tagName === 'IMG' && (!el.complete || !el.naturalWidth)) return { result: 'UNKNOWN', reason: '图片尚未成功加载' };
    record(el.getBoundingClientRect()); graphicCount++;
  }
  if (!textRects) return { result: 'UNKNOWN', reason: '未测到正文文本', marks };
  return { result: horizontalOverflow || contentBottom > first.bottom + 2 ? 'OVERFLOW' : 'ONE_PAGE', scale, boundary: first.bottom, contentBottom, lastText, textRects, graphicCount, horizontalOverflow, marks };
}

module.exports = { measurePageGeometry };
