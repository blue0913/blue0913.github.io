// Keep the original address (including signed queries and case-sensitive pwd
// values). Never turn source text into executable or local-file links.
export function safeGuideHref(value) {
  if (typeof value !== 'string') return '';
  const href = value.trim();
  if (!/^https?:\/\/[^\s<>"'`]+$/i.test(href)) return '';
  const authority = href.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  if (!authority || authority.includes('\\') || !/[^.:]/.test(authority)) return '';
  return href;
}

function detectedHref(value) {
  let result = value.replace(/[.,;!?、]+$/, '');
  for (const [opening, closing] of [['(', ')'], ['[', ']']]) {
    while (result.endsWith(closing) && result.split(closing).length > result.split(opening).length) result = result.slice(0, -1);
  }
  return safeGuideHref(result);
}

export function guideTextParts(value, explicitLinks = []) {
  const text = value == null ? '' : String(value);
  if (!text) return [];
  const explicit = [];
  for (const link of explicitLinks || []) {
    const url = safeGuideHref(link?.url);
    if (!url) continue;
    const labels = Array.from(new Set([url, link.label].filter(label => typeof label === 'string' && label.length)));
    for (const label of labels) {
      let start = text.indexOf(label);
      while (start >= 0) {
        explicit.push({ start, end: start + label.length, url });
        start = text.indexOf(label, start + label.length);
      }
    }
  }
  // Match longer explicit targets first when a homepage is also a prefix of a
  // resource URL. Reserve these ranges before considering fallback detection.
  explicit.sort((left, right) => left.start - right.start || right.end - left.end);
  const ranges = [];
  for (const range of explicit) {
    if (!ranges.length || range.start >= ranges[ranges.length - 1].end) ranges.push(range);
  }
  // Plain URLs can touch Chinese explanatory prose in the document. Explicit
  // source targets above may contain Unicode; fallback detection stops at CJK.
  const fallback = /https?:\/\/[^\s<>"'`“”‘’（）【】「」《》，。；：\u3400-\u9fff]+/gi;
  for (const match of text.matchAll(fallback)) {
    const url = detectedHref(match[0]);
    if (!url) continue;
    const range = { start: match.index, end: match.index + url.length, url };
    if (!ranges.some(existing => range.start < existing.end && range.end > existing.start)) ranges.push(range);
  }
  ranges.sort((left, right) => left.start - right.start);
  const parts = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start) });
    parts.push({ text: text.slice(range.start, range.end), url: range.url });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
