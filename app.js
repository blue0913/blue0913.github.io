import { guideTextParts, safeGuideHref } from './assets/guide-hyperlinks.js';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
let guide;
let resources = [];
let currentSection = null;
let catalogQuery = '';
let resourceQuery = '';
let toastTimer;
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`physica:${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`physica:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
};
let bookmarks = new Set(storage.get('bookmarks', []).filter?.(x => typeof x === 'string') || []);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || (value === false && !key.startsWith('aria-'))) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null && child !== false) node.append(child instanceof Node ? child : String(child));
  return node;
}
const a = (text, href, className = '', attrs = {}) => el('a', { href, class: className, ...attrs }, text);
const button = (text, action, className = 'tool-button', attrs = {}) => el('button', { type: 'button', class: className, 'data-action': action, ...attrs }, text);
const readUrl = id => `#/read/${encodeURIComponent(id)}`;
const findSection = id => guide.sections.find(s => s.id === id);
const groupTitle = id => guide.groups.find(g => g.id === id)?.title || '';
const plainTitle = title => title.replace(/^(?:\d+(?:\.\d+)*\s+|[ABC]\.\d+\s+)/, '');
const shortGroupTitle = title => title.replace(/^第[一二]章\s*/, '').replace(/^附录[A-C][：:]\s*/, '');
const eyebrow = text => el('p', { class: 'eyebrow' }, text);
const arrow = () => el('span', { class: 'arrow', 'aria-hidden': 'true' }, '↗');
const tags = (items, cls = 'hero-tags') => el('div', { class: cls }, items.map(t => el('span', {}, t)));
const sectionHeading = (index, title, link, href) => el('div', { class: 'section-heading' }, el('div', {}, el('span', { class: 'section-index' }, index), el('h2', {}, title)), href && a(link, href, 'section-more'));
const searchField = (id, placeholder, value) => el('label', { class: 'search-field' }, el('span', { 'aria-hidden': 'true' }, '⌕'), el('input', { id, type: 'search', value, maxlength: 120, placeholder, 'aria-label': placeholder }), button('清空', `clear-${id}`, 'clear-search', { hidden: !value }));
function showToast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2500); }
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else { const field = el('textarea', { 'aria-label': '复制内容' }, text); field.style.cssText = 'position:fixed;top:0;left:-9999px'; document.body.append(field); field.select(); const ok = document.execCommand('copy'); field.remove(); if (!ok) throw new Error(); }
    showToast('已复制');
  } catch { showToast('浏览器未允许复制，请选择文字后复制'); }
}
function keywords(query) { return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean); }
function matches(section, query) { const haystack = `${section.title}\n${section.searchText}`.toLocaleLowerCase(); return keywords(query).every(word => haystack.includes(word)); }
function excerpt(section, query) {
  const text = (section.searchText || '').replace(/\s+/g, ' ');
  const term = keywords(query)[0];
  if (!term) return section.topic !== section.title ? section.topic : '';
  const position = Math.max(0, text.toLocaleLowerCase().indexOf(term));
  const start = Math.max(0, position - 26);
  return `${start ? '…' : ''}${text.slice(start, position + term.length + 72)}${text.length > position + term.length + 72 ? '…' : ''}`;
}
function marked(text, query) {
  const fragment = document.createDocumentFragment();
  const terms = keywords(query);
  if (!terms.length) { fragment.append(text); return fragment; }
  const pattern = new RegExp(`(${terms.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  for (const part of text.split(pattern)) fragment.append(terms.includes(part.toLocaleLowerCase()) ? el('mark', {}, part) : part);
  return fragment;
}
function route() {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  return { path, params: new URLSearchParams(query) };
}
function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function attractor() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 540 420'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '洛伦兹吸引子的双翼相轨迹');
  const make = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text) n.textContent = text; svg.append(n); return n; };
  for (let x = 30; x < 540; x += 40) make('line', { x1: x, y1: 24, x2: x, y2: 378, stroke: '#276a9f', 'stroke-opacity': .055 });
  for (let y = 24; y < 390; y += 40) make('line', { x1: 30, y1: y, x2: 510, y2: y, stroke: '#276a9f', 'stroke-opacity': .055 });
  make('line', { x1: 22, y1: 368, x2: 514, y2: 368, stroke: '#172b48', 'stroke-opacity': .2 });
  make('line', { x1: 270, y1: 18, x2: 270, y2: 380, stroke: '#172b48', 'stroke-opacity': .13 });
  let x = .2, y = .4, z = .1; const points = [];
  for (let i = 0; i < 6500; i++) { const dt = .006; const dx = 10 * (y - x); const dy = x * (28 - z) - y; const dz = x * y - 8 / 3 * z; x += dx * dt; y += dy * dt; z += dz * dt; if (i > 120) points.push([270 + x * 10.5, 365 - z * 6.65]); }
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('');
  make('path', { d: path, fill: 'none', stroke: '#276a9f', 'stroke-width': .65, 'stroke-opacity': .62, 'stroke-linejoin': 'round' });
  const points2 = points.slice(-500).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('');
  make('path', { d: points2, fill: 'none', stroke: '#756ac0', 'stroke-width': 1.2, 'stroke-opacity': .8 });
  make('text', { x: 500, y: 387, fill: '#7c879c', 'font-size': 12, 'font-family': 'Georgia', 'font-style': 'italic' }, 'x(t)');
  make('text', { x: 280, y: 25, fill: '#7c879c', 'font-size': 12, 'font-family': 'Georgia', 'font-style': 'italic' }, 'z(t)');
  return svg;
}
function home() {
  const recent = findSection(storage.get('recent', '')?.id);
  const hero = el('section', { class: 'home-hero' },
    el('div', { class: 'hero-copy' }, eyebrow('A PERSONAL RESEARCH SPACE'),
      el('h1', { class: 'hero-title' }, '用智能探索', el('br'), '复杂世界的', el('br'), el('em', {}, '内在规律'), el('span', { class: 'title-period' }, '。')),
      el('p', { class: 'hero-description' }, '记录研究路上的工具、方法与思考。', el('br'), '也为科研的第一步，留下一份清晰的指南。'),
      tags(['人工智能', '理论物理', '复杂系统']),
      el('div', { class: 'hero-actions' }, a('阅读科研指南 ↗', '#/guide', 'button primary'), a('认识这个空间 →', '#/about', 'button secondary'))),
    el('div', { class: 'hero-art' }, el('div', { class: 'art-topline' }, el('span', {}, 'FIG. 01'), el('span', {}, 'ORDER WITHIN CHAOS')), attractor(),
      el('div', { class: 'art-caption' }, el('span', {}, '洛伦兹吸引子 · Lorenz attractor'), el('span', {}, 'σ = 10 / ρ = 28 / β = 8/3'))));
  const stats = el('div', { class: 'home-stats' },
    el('p', {}, '从一个问题出发，', el('br'), '让探索有迹可循。'),
    ...[[guide.stats.sections, '个指南小节'], [guide.stats.images, '幅原文插图'], ['02 + 03', '两章正文 · 三个附录']].map(([n, label]) => el('div', { class: 'stat' }, el('strong', {}, n), el('span', {}, label))));
  const featured = el('section', { class: 'home-guide' }, sectionHeading('01 / FIELD NOTES', '写给科研的第一步', '浏览完整目录 ↗', '#/guide'),
    el('div', { class: 'featured-guide' },
      el('div', { class: 'featured-intro' }, el('span', { class: 'feature-label' }, 'RESEARCH STARTER GUIDE'), el('h3', {}, '科研新手指南', el('span', {}, '从入门到实践')),
        el('p', {}, '如何找到第一篇文献？如何建立自己的工具箱？从文献检索、数据计算到阅读与写作，把科研日常拆成可以开始的一小步。'),
        el('p', { class: 'feature-meta' }, `${guide.author} / ${guide.edition}`),
        a(recent ? `继续阅读：${plainTitle(recent.title)} →` : '从指南第一章开始 →', readUrl(recent?.id || 'section-002'), 'feature-link')),
      el('div', { class: 'chapter-preview' }, guide.groups.map((g, i) => a([
        el('span', { class: 'chapter-num' }, i < 2 ? `0${i + 1}` : ['A', 'B', 'C'][i - 2]),
        el('span', { class: 'chapter-copy' }, el('strong', {}, shortGroupTitle(g.title)), el('small', {}, `${guide.sections.filter(s => s.groupId === g.id).length} 个小节`)), arrow()
      ], `#/guide?group=${g.id}`, 'chapter-preview-row')))));
  const paths = [
    ['01', '找到想读的文献', '检索、获取与管理，让文献成为研究的起点。', 'section-003'],
    ['02', '搭建计算工具箱', '从 MATLAB、Python 到专业领域工具。', 'section-011'],
    ['03', '把想法写下来', '写作排版、笔记管理与版本控制。', 'section-015'],
    ['04', '学会读懂一篇论文', '筛选、精读与批判性思考，建立阅读方法。', 'section-035']
  ];
  const explore = el('section', {}, sectionHeading('02 / RESEARCH IN PRACTICE', '从感兴趣的问题开始'), el('div', { class: 'explore-grid' }, paths.map(([n, title, desc, id]) => a([el('span', { class: 'explore-number' }, n), el('h3', {}, title), el('p', {}, desc), arrow()], readUrl(id), 'explore-item'))));
  const resourceSection = el('section', { class: 'home-resources' }, sectionHeading('03 / THE TOOLBOX', '常用资源，随手可及', '打开资源速查 ↗', '#/resources'), el('div', { class: 'resource-chips' }, [['arXiv', '预印本', 'section-006'], ['Zotero', '文献管理', 'section-010'], ['Python', '数据计算', 'section-013'], ['LaTeX', '学术排版', 'section-015'], ['MATLAB', '数值计算', 'section-011']].map(([title, type, id]) => a([el('strong', {}, title), el('small', {}, type), arrow()], readUrl(id), 'resource-chip'))));
  const about = el('section', { class: 'about-band' }, el('div', { class: 'about-monogram', 'aria-hidden': 'true' }, '智', el('span', {}, '理')), el('div', { class: 'about-copy' }, eyebrow('EXPLORE · THINK · CONNECT'), el('h2', {}, '在学科的交汇处，保持好奇。'), el('p', {}, '这里围绕人工智能、理论物理与复杂系统展开。收集实用的方法，整理值得反复查阅的资源，让每一次探索都有更好的起点。'), a('关于本站 →', '#/about', 'feature-link')));
  return el('div', { class: 'container' }, hero, stats, featured, explore, resourceSection, about);
}

function guidePage(params) {
  catalogQuery = params.get('q') || '';
  const group = guide.groups.some(g => g.id === params.get('group')) ? params.get('group') : 'all';
  const savedOnly = params.get('saved') === '1';
  const filters = [{ id: 'all', title: '全部内容' }, ...guide.groups];
  return el('div', { class: 'container' },
    el('header', { class: 'page-intro' }, eyebrow('THE RESEARCH HANDBOOK'), el('h1', { class: 'page-title' }, '科研新手指南'), el('p', { class: 'page-description' }, '从工具使用到文献阅读，为科研的第一步找到路径。'), el('p', { class: 'intro-meta' }, `${guide.author} · ${guide.edition} · ${guide.sections.length} 个小节`)),
    searchField('catalog-search', '搜索章节标题或正文关键词…', catalogQuery),
    el('div', { class: 'catalog-layout' }, el('aside', { class: 'catalog-sidebar', 'aria-label': '指南分类' },
      el('p', { class: 'filter-heading' }, '内容目录'),
      filters.map(g => button([el('span', {}, shortGroupTitle(g.title)), el('span', { class: 'filter-count' }, g.id === 'all' ? guide.sections.length : guide.sections.filter(s => s.groupId === g.id).length)], 'filter-group', 'filter-button', { 'data-group': g.id, 'aria-pressed': !savedOnly && group === g.id })),
      button(['我的收藏', el('span', { class: 'filter-count' }, bookmarks.size)], 'filter-saved', 'filter-button', { 'aria-pressed': savedOnly }), el('p', { class: 'sidebar-note' }, '阅读位置与收藏保存在当前浏览器。')),
    el('div', { class: 'catalog-main', id: 'catalog-results', 'aria-live': 'polite', 'data-group': group, 'data-saved': savedOnly ? '1' : '0' })));
}
function updateCatalog() {
  const root = $('#catalog-results'); if (!root) return;
  const group = root.dataset.group, savedOnly = root.dataset.saved === '1';
  const sections = guide.sections.filter(s => (group === 'all' || s.groupId === group) && (!savedOnly || bookmarks.has(s.id)) && matches(s, catalogQuery));
  const toolbar = el('div', { class: 'catalog-toolbar' }, el('span', {}, catalogQuery ? `找到 ${sections.length} 个相关小节` : `${savedOnly ? '已收藏' : '共'} ${sections.length} 个小节`), el('span', {}, catalogQuery ? '按原文顺序排列' : '选择一节，开始阅读'));
  root.replaceChildren(toolbar);
  if (!sections.length) { root.append(el('div', { class: 'empty-state' }, el('span', { class: 'empty-symbol', 'aria-hidden': 'true' }, '⌕'), el('h2', {}, savedOnly ? '还没有符合条件的收藏' : '暂时没有找到相关内容'), el('p', {}, savedOnly ? '阅读时点击“收藏本节”，下次就能快速找到。' : '试试其他关键词，或查看全部内容。'), a('查看全部目录 →', '#/guide', 'button secondary'))); return; }
  for (const g of guide.groups) {
    const items = sections.filter(s => s.groupId === g.id); if (!items.length) continue;
    root.append(el('section', { class: 'catalog-group' }, el('div', { class: 'catalog-group-heading' }, el('h2', {}, g.title), el('small', {}, `${items.length} 小节`)), items.map(s => a([
      el('span', { class: 'section-number' }, String(guide.sections.indexOf(s) + 1).padStart(2, '0')),
      el('span', { class: 'section-row-copy' }, el('strong', { class: 'section-row-title' }, marked(s.title, catalogQuery)), el('span', { class: catalogQuery ? 'section-row-excerpt' : 'section-row-topic' }, marked(excerpt(s, catalogQuery), catalogQuery))),
      bookmarks.has(s.id) && el('span', { class: 'row-status', 'aria-label': '已收藏' }, '★'), arrow()
    ], readUrl(s.id), 'section-row'))));
  }
}

function extractionCodes(text) { return [...new Set(String(text || '').match(/(?:提取码|提取密码|访问密码|访问码)\s*[:：]?\s*[a-zA-Z0-9]{3,12}/g) || [])]; }
function linksFor(text, explicit = []) {
  const seen = new Set();
  return [...explicit, ...guideTextParts(text, explicit).filter(p => p.url)].filter(link => { const href = safeGuideHref(link.url); if (!href || seen.has(href)) return false; seen.add(href); return true; }).map(link => ({ url: safeGuideHref(link.url), label: link.label || '' }));
}
function richText(text, links = []) { const fragment = document.createDocumentFragment(); for (const part of guideTextParts(text, links)) fragment.append(part.url ? a(part.text, part.url, '', { target: '_blank', rel: 'noopener noreferrer' }) : part.text); return fragment; }
function linkCards(links, text) {
  const codes = extractionCodes(text);
  return el('div', { class: 'block-links' }, links.map(link => el('div', { class: 'article-link-card' }, a([link.label && link.label !== link.url && el('strong', {}, link.label), el('span', {}, link.url)], link.url, '', { target: '_blank', rel: 'noopener noreferrer' }), button(codes.length ? '复制链接与提取码' : '复制链接', 'copy', 'copy-button', { 'data-copy': [link.url, ...codes].join('\n') }))));
}
function rowTitle(table, row) {
  const headers = table.headers || [], cells = row.cells || [];
  let index = headers.findIndex(h => /名称|标题|书名|课程名|资源名|工具名|软件名|平台名|期刊名/.test(h));
  if (index < 0) index = cells.findIndex((c, i) => c && !/序号|编号/.test(headers[i] || '') && !/^\d+[.、]?$/.test(c.trim()));
  return cells[index] || cells.find(Boolean) || '资源条目';
}
function renderBlock(block, index, section) {
  const text = block.text || (block.runs || []).map(r => r.text).join('');
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(2, (block.level || 1) + 1));
    return el(`h${level}`, { class: 'prose-heading', id: `heading-${index}` }, text);
  }
  if (block.type === 'paragraph' || block.type === 'list') {
    const followingCodes = extractionCodes(section.blocks[index + 1]?.text);
    const links = linksFor(text, block.links);
    const p = el('p', { class: block.type === 'list' ? 'article-paragraph article-list' : 'article-paragraph' });
    if (block.type === 'list') p.append(el('span', { class: 'list-marker' }, `${block.marker || '•'} `));
    if (block.runs?.length) { for (const run of block.runs) { if (run.recommended) p.append(el('span', { class: 'recommended-badge' }, '推荐')); p.append(el(run.bold ? 'strong' : 'span', { class: run.recommended ? 'recommended-text' : '' }, richText(run.text, links))); } }
    else p.append(richText(text, links));
    return el('div', { class: 'article-text-block' }, p, links.length ? linkCards(links, `${text}\n${followingCodes.join('\n')}`) : extractionCodes(text).length ? button('复制提取码', 'copy', 'code-copy', { 'data-copy': extractionCodes(text).join('\n') }) : null);
  }
  if (block.type === 'image') {
    const image = el('img', { src: block.src, alt: block.alt || `${section.title} · 原文插图`, loading: 'lazy', decoding: 'async' });
    image.addEventListener('error', () => { image.replaceWith(el('span', { class: 'image-error' }, '图片未能加载，请刷新后重试。')); });
    return el('figure', { class: 'article-figure' }, button(image, 'image', 'image-open', { 'data-src': block.src, 'data-alt': image.alt, 'aria-label': '放大查看原文插图' }), el('figcaption', {}, '原文插图 · 点击放大'));
  }
  if (block.type === 'table') {
    const table = el('table', {}, block.caption && el('caption', {}, block.caption), el('thead', {}, el('tr', {}, (block.headers || []).map(h => el('th', { scope: 'col' }, h)), el('th', { scope: 'col' }, '资源入口'))));
    table.append(el('tbody', {}, (block.rows || []).map(row => { const text = row.cells.join('\n'); const links = linksFor(text, row.links); const codes = extractionCodes(text); return el('tr', {}, row.cells.map((cell, i) => el('td', {}, i === 0 && row.recommended && el('span', { class: 'recommended-badge' }, '推荐'), richText(cell || '—', links))), el('td', {}, links.length ? el('div', { class: 'table-actions' }, links.map(link => el('div', {}, a('访问资源 ↗', link.url, '', { target: '_blank', rel: 'noopener noreferrer' }), button(codes.length ? '复制链接与提取码' : '复制链接', 'copy', 'copy-button', { 'data-copy': [link.url, ...codes].join('\n') })))) : codes.length ? button('复制提取码', 'copy', 'code-copy', { 'data-copy': codes.join('\n') }) : '—')); })));
    return el('div', { class: 'resource-table-wrapper', tabindex: '0', role: 'region', 'aria-label': block.caption || '原文资源表格，可横向滚动' }, table);
  }
  return null;
}
function readerPage(id) {
  const section = findSection(id);
  if (!section) return el('div', { class: 'container empty-state' }, el('h1', {}, '没有找到这个小节'), el('p', {}, '这个链接可能已失效，请从目录重新选择。'), a('返回指南目录 →', '#/guide', 'button primary'));
  currentSection = section;
  storage.set('recent', { id: section.id });
  const position = guide.sections.indexOf(section);
  const bookmarked = bookmarks.has(id);
  const sidebar = el('aside', { class: 'reader-sidebar', 'aria-label': '指南目录' }, a('← 完整目录', '#/guide', 'reader-back'), guide.groups.map(g => el('details', { class: 'reader-directory', open: g.id === section.groupId }, el('summary', {}, shortGroupTitle(g.title)), guide.sections.filter(s => s.groupId === g.id).map(s => a(s.title, readUrl(s.id), 'reader-nav-link', { 'aria-current': s.id === id ? 'page' : null })))));
  const main = el('article', { class: 'reader-main' }, el('nav', { class: 'breadcrumbs', 'aria-label': '当前位置' }, a('科研指南', '#/guide'), el('span', {}, '/'), a(shortGroupTitle(groupTitle(section.groupId)), `#/guide?group=${section.groupId}`)),
    el('header', { class: 'reader-heading' }, eyebrow(`FIELD NOTES / ${String(position + 1).padStart(2, '0')} OF ${guide.sections.length}`), el('h1', {}, section.title), el('p', { class: 'reader-meta' }, `${guide.author} · ${guide.edition} · 约 ${section.readingMinutes || 1} 分钟`),
      el('div', { class: 'reader-tools' }, button(bookmarked ? '★ 已收藏' : '☆ 收藏本节', 'bookmark', 'tool-button', { 'aria-pressed': bookmarked }), button('Aa 字号', 'font', 'tool-button', { 'aria-pressed': document.body.classList.contains('reading-large') }), button('↗ 复制本节链接', 'share', 'tool-button'), button('打印', 'print', 'tool-button'))),
    el('div', { class: 'article-content' }, section.blocks.map((b, i) => renderBlock(b, i, section))),
    el('div', { class: 'reader-end' }, el('span', {}, '— 本节完 —'), el('p', {}, `第 ${position + 1} / ${guide.sections.length} 节 · 原文整理自《${guide.title}》`)),
    el('nav', { class: 'section-pagination', 'aria-label': '相邻章节' }, position > 0 ? a([el('small', {}, '← 上一节'), el('strong', {}, guide.sections[position - 1].title)], readUrl(guide.sections[position - 1].id)) : el('span'), position < guide.sections.length - 1 ? a([el('small', {}, '下一节 →'), el('strong', {}, guide.sections[position + 1].title)], readUrl(guide.sections[position + 1].id)) : a([el('small', {}, '已读到最后一节'), el('strong', {}, '返回完整目录 →')], '#/guide')));
  const headings = section.blocks.map((b, i) => ({ ...b, index: i })).filter(b => b.type === 'heading');
  const toc = el('aside', { class: 'reader-toc', 'aria-label': '本节目录' }, el('p', { class: 'toc-title' }, '本节内容'), headings.map(b => a(b.text, `#heading-${b.index}`, 'toc-link', { 'data-action': 'toc', 'data-heading': `heading-${b.index}` })), a('← 返回目录', '#/guide', 'toc-back'));
  return el('div', {}, el('div', { class: 'reading-progress', 'aria-hidden': 'true' }, el('span', { id: 'reading-progress-fill' })), el('div', { class: 'reader-layout' }, sidebar, main, toc));
}

function prepareResources() {
  resources = guide.sections.flatMap(section => section.blocks.filter(b => b.type === 'table').flatMap(table => table.rows.map((row, i) => ({ id: `${section.id}-${i}`, section, title: rowTitle(table, row), recommended: row.recommended, fields: row.cells.map((text, index) => ({ label: table.headers?.[index] || '', text })), links: linksFor(row.cells.join('\n'), row.links), text: row.cells.join('\n') }))));
}
function resourcesPage(params) {
  resourceQuery = params.get('q') || '';
  return el('div', { class: 'container' }, el('header', { class: 'page-intro' }, eyebrow('A RESEARCHER’S TOOLBOX'), el('h1', { class: 'page-title' }, '资源速查'), el('p', { class: 'page-description' }, '把常用入口放在一起，需要时随手找到。'), el('p', { class: 'intro-meta' }, `整理自指南原文 · ${resources.length} 条资源记录 · 保留原文推荐标记`)), searchField('resource-search', '搜索工具、资源或用途…', resourceQuery), el('div', { class: 'resources-layout', id: 'resource-results', 'aria-live': 'polite' }));
}
function updateResources() {
  const root = $('#resource-results'); if (!root) return;
  const queryWords = keywords(resourceQuery);
  const items = resources.filter(r => queryWords.every(w => `${r.title}\n${r.text}`.toLocaleLowerCase().includes(w)));
  root.replaceChildren(el('div', { class: 'catalog-toolbar' }, el('span', {}, `${items.length} 条${resourceQuery ? '相关' : ''}资源`), el('span', {}, '按指南分类整理')));
  if (!items.length) { root.append(el('div', { class: 'empty-state' }, el('h2', {}, '没有找到相关资源'), el('p', {}, '换一个工具名称或用途试试。'), button('查看全部资源', 'clear-resource-search', 'button secondary'))); return; }
  const sections = [...new Set(items.map(r => r.section.id))];
  for (const id of sections) {
    const section = findSection(id);
    root.append(el('section', { class: 'resource-group' }, el('div', { class: 'catalog-group-heading' }, el('h2', {}, section.title), a('查看原文 ↗', readUrl(id), 'section-more')), el('div', { class: 'resource-grid' }, items.filter(r => r.section.id === id).map(r => {
      const titleIndex = r.fields.findIndex(f => f.text === r.title);
      const fields = r.fields.filter((f, i) => i !== titleIndex && !/序号|编号/.test(f.label) && !/^(https?:|www\.)/.test(f.text));
      return el('article', { class: 'resource-card' }, el('div', { class: 'resource-card-top' }, el('h3', { class: 'resource-title' }, marked(r.title, resourceQuery)), r.recommended && el('span', { class: 'recommended-badge' }, '原文推荐')),
        fields.map(f => el('p', {}, f.label && el('span', { class: 'resource-category' }, f.label), richText(f.text, r.links))),
        el('div', { class: 'resource-card-actions' }, r.links[0] && a('访问资源 ↗', r.links[0].url, '', { target: '_blank', rel: 'noopener noreferrer' }), r.links.length && button('复制入口', 'copy', 'copy-button', { 'data-copy': [...r.links.map(l => l.url), ...extractionCodes(r.text)].join('\n') }), a('原文详情 →', readUrl(id), 'resource-detail')));
    }))));
  }
}
function aboutPage() {
  return el('div', { class: 'container about-page' }, el('header', { class: 'page-intro about-hero' }, eyebrow('ABOUT THIS SPACE'), el('h1', { class: 'page-title' }, '探索 · 思考 · 连接'), el('p', { class: 'page-description' }, '一个关于智能、物理与复杂性的个人空间。')),
    el('div', { class: 'about-content' }, el('section', { class: 'about-section' }, el('h2', {}, '智理环宇 / AI·PHYSICA'), el('p', {}, '人工智能、理论物理与复杂系统科学，是这个空间关注的三个方向。这里从实用的科研方法出发，整理工具、连接资源，也为刚开始科研的同学留下一份可随时查阅的入门指南。'), tags(['机器学习 · 强化学习', '理论物理 · 数学建模', '复杂网络 · 非线性反馈', '多智能体 · 系统演化'], 'about-tags')),
      el('section', { class: 'about-section' }, el('h2', {}, '关于科研新手指南'), el('p', {}, `本站完整收录《${guide.title}》，原著署名为${guide.author}，版本为${guide.edition}。正文包括科研工具使用要求、文献查找与阅读规范，另附工具资源、arXiv分类与学习资源三个附录。`), el('dl', { class: 'detail-list' }, [['内容范围', `${guide.stats.sections} 个小节 · ${guide.stats.images} 幅插图 · ${guide.stats.tables} 张表格`], ['阅读方式', '全文检索、章节目录、图片放大、资源入口与本地收藏'], ['整理原则', '保留原文、图片顺序、表格与超链接；推荐标记来自原文。']].map(([term, detail]) => [el('dt', {}, term), el('dd', {}, detail)]))),
      el('section', { class: 'about-section' }, el('h2', {}, '版本、版权与浏览记录'), el('p', {}, '指南正文与插图的原始署名归 Chaos公社，所列工具与网站的名称、商标归各自权利人。本站按上述版本整理，第三方资源的内容与可用性以对应网站为准。'), el('p', {}, '收藏、字号偏好和最近阅读章节仅保存在当前浏览器，可随浏览器站点数据一并清除。本站无需填写个人信息。'), a('从完整目录开始阅读 ↗', '#/guide', 'button primary'))));
}
function render() {
  if (!guide) return;
  const { path, params } = route();
  currentSection = null;
  const isReader = path.startsWith('/read/');
  document.body.classList.toggle('reader-view', isReader);
  document.body.classList.toggle('reading-large', storage.get('large-font', false));
  let page, title, nav;
  if (path === '/' || path === '') { page = home(); title = '智理环宇 · AI·PHYSICA'; nav = 'home'; }
  else if (path === '/guide') { page = guidePage(params); title = '科研新手指南 · 智理环宇'; nav = 'guide'; }
  else if (isReader) { let id = ''; try { id = decodeURIComponent(path.slice(6)); } catch {} page = readerPage(id); title = `${currentSection?.title || '未找到小节'} · 科研新手指南`; nav = 'guide'; }
  else if (path === '/resources') { page = resourcesPage(params); title = '资源速查 · 智理环宇'; nav = 'resources'; }
  else if (path === '/about') { page = aboutPage(); title = '关于本站 · 智理环宇'; nav = 'about'; }
  else { page = el('div', { class: 'container empty-state' }, el('h1', {}, '这个页面暂时不存在'), a('返回首页 →', '#/', 'button primary')); title = '未找到页面 · 智理环宇'; }
  app.replaceChildren(page); app.removeAttribute('aria-busy'); document.title = title;
  document.querySelectorAll('[data-nav]').forEach(link => { if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('#mobile-nav').hidden = true; $('.menu-toggle').setAttribute('aria-expanded', 'false');
  updateCatalog(); updateResources();
  window.scrollTo({ top: 0, behavior: 'instant' });
  requestAnimationFrame(() => { $('.reader-nav-link[aria-current]')?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); window.scrollTo({ top: 0, behavior: 'instant' }); updateScroll(); });
  if ($('#search-dialog').open) $('#search-dialog').close();
}
function openSearch() { if (!guide) { showToast('指南正在加载，请稍候'); return; } const dialog = $('#search-dialog'); if (!dialog.open) dialog.showModal(); $('#global-search').value = ''; updateGlobalSearch(); $('#global-search').focus(); }
function updateGlobalSearch() {
  const query = $('#global-search').value;
  const result = $('#modal-results');
  const filtered = query.trim() ? guide.sections.filter(s => matches(s, query)) : ['section-003', 'section-010', 'section-013', 'section-037'].map(findSection);
  result.replaceChildren(el('p', { class: 'search-results-label' }, query.trim() ? `找到 ${filtered.length} 个小节` : '从这些内容开始'));
  if (!filtered.length) { result.append(el('div', { class: 'empty-state' }, el('p', {}, '没有找到相关内容，试试其他关键词。'))); return; }
  result.append(...filtered.slice(0, 12).map(s => a([el('strong', {}, marked(s.title, query)), el('small', {}, marked(excerpt(s, query), query))], readUrl(s.id), 'search-result')));
  if (filtered.length > 12) result.append(a(`查看全部 ${filtered.length} 个结果 →`, `#/guide?q=${encodeURIComponent(query)}`, 'search-result'));
}
document.addEventListener('input', event => {
  if (event.target.id === 'global-search') updateGlobalSearch();
  if (event.target.id === 'catalog-search') { catalogQuery = event.target.value; event.target.parentElement.querySelector('button').hidden = !catalogQuery; updateCatalog(); const params = route().params; if (catalogQuery) params.set('q', catalogQuery); else params.delete('q'); history.replaceState(null, '', `#/guide${params.size ? `?${params}` : ''}`); }
  if (event.target.id === 'resource-search') { resourceQuery = event.target.value; event.target.parentElement.querySelector('button').hidden = !resourceQuery; updateResources(); history.replaceState(null, '', `#/resources${resourceQuery ? `?q=${encodeURIComponent(resourceQuery)}` : ''}`); }
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); openSearch(); }
  if (event.key === 'Enter' && event.target.id === 'global-search') { event.preventDefault(); navigate(`#/guide?q=${encodeURIComponent(event.target.value)}`); $('#search-dialog').close(); }
});
document.addEventListener('click', event => {
  if (event.target.closest('.skip-link')) { event.preventDefault(); $('#main-content').focus({ preventScroll: true }); $('#main-content').scrollIntoView({ block: 'start' }); return; }
  const target = event.target.closest('[data-action]');
  if (!target) { const link = event.target.closest('a'); if (link?.getAttribute('href')?.startsWith('#/')) { if ($('#search-dialog').open) $('#search-dialog').close(); if (link.getAttribute('href') === location.hash) render(); } return; }
  const action = target.dataset.action;
  if (action === 'search') openSearch();
  else if (action === 'close-search') $('#search-dialog').close();
  else if (action === 'close-image') $('#image-dialog').close();
  else if (action === 'menu') { const menu = $('#mobile-nav'); menu.hidden = !menu.hidden; target.setAttribute('aria-expanded', String(!menu.hidden)); }
  else if (action === 'top') window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  else if (action === 'filter-group' || action === 'filter-saved') { const params = new URLSearchParams(); if (catalogQuery) params.set('q', catalogQuery); if (action === 'filter-saved') params.set('saved', '1'); else if (target.dataset.group !== 'all') params.set('group', target.dataset.group); navigate(`#/guide${params.size ? `?${params}` : ''}`); }
  else if (action === 'clear-catalog-search') { const input = $('#catalog-search'); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
  else if (action === 'clear-resource-search') { const input = $('#resource-search'); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
  else if (action === 'copy') copyText(target.dataset.copy);
  else if (action === 'share') copyText(`${location.href.split('#')[0]}${readUrl(currentSection.id)}`);
  else if (action === 'print') window.print();
  else if (action === 'font') { const large = !document.body.classList.contains('reading-large'); document.body.classList.toggle('reading-large', large); storage.set('large-font', large); target.setAttribute('aria-pressed', String(large)); }
  else if (action === 'bookmark' && currentSection) { const next = new Set(bookmarks); if (next.has(currentSection.id)) next.delete(currentSection.id); else next.add(currentSection.id); if (!storage.set('bookmarks', [...next])) { showToast('当前浏览器无法保存收藏'); return; } bookmarks = next; const saved = bookmarks.has(currentSection.id); target.textContent = saved ? '★ 已收藏' : '☆ 收藏本节'; target.setAttribute('aria-pressed', String(saved)); showToast(saved ? '已收藏到当前浏览器' : '已取消收藏'); }
  else if (action === 'image') { const image = $('#preview-image'); image.src = target.dataset.src; image.alt = target.dataset.alt; $('#image-caption').textContent = target.dataset.alt; $('#image-dialog').showModal(); }
  else if (action === 'toc') { event.preventDefault(); document.getElementById(target.dataset.heading)?.scrollIntoView({ behavior: 'instant', block: 'start' }); }
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
function updateScroll() { $('.back-to-top').hidden = scrollY < 650; const fill = $('#reading-progress-fill'); if (fill) { const article = $('.reader-main'); const max = Math.max(1, article.offsetTop + article.offsetHeight - innerHeight); fill.style.width = `${Math.max(0, Math.min(100, scrollY / max * 100))}%`; } }
let scrollFrame;
window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { updateScroll(); scrollFrame = null; }); }, { passive: true });
window.addEventListener('hashchange', () => { render(); $('#main-content').focus({ preventScroll: true }); });
async function loadGuide() {
  try { const response = await fetch(new URL('data/guide.json', import.meta.url)); if (!response.ok) throw new Error('Content unavailable'); guide = await response.json(); prepareResources(); render(); }
  catch { app.replaceChildren(el('div', { class: 'container error-panel' }, el('h1', {}, '指南暂时未能加载'), el('p', {}, '请检查网络后刷新页面。若在本机查看，请使用项目提供的“打开个人网站”入口。'), button('重新加载', 'reload', 'button primary'))); app.removeAttribute('aria-busy'); }
}
document.addEventListener('click', event => { if (event.target.closest('[data-action="reload"]')) loadGuide(); });
loadGuide();
