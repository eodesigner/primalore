// Content gate: runs locally, in `npm run build`, and on every pull request.
// Rules come from the Faz 1 document (sections 5 and 6).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import matter from 'gray-matter';

const ROOT = 'src/content';
const CATEGORIES = [
  'water', 'fire-heat', 'shelter', 'food', 'foraging', 'first-aid-hygiene',
  'navigation-signalling', 'power-light', 'tools-repair', 'growing',
  'urban-resilience', 'mind-community',
];
const TYPES = ['quick-tip', 'core-guide', 'project', 'checklist', 'news', 'species-card', 'decision-tree', 'learning-path', 'calendar', 'glossary'];
const RISKS = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['draft', 'auto-checked', 'expert-approved', 'published', 'retired'];
const GATED = ['expert-approved', 'published']; // statuses that need the full evidence set

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}

const errors = [];
const slugs = new Map();

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const fail = (msg) => errors.push(`${rel}: ${msg}`);
  const { data: d, content } = matter(readFileSync(file, 'utf8'));

  if (!TYPES.includes(d.type)) fail(`unknown type "${d.type}"`);
  if (!CATEGORIES.includes(d.category)) fail(`unknown category "${d.category}"`);
  if (!RISKS.includes(d.risk)) fail(`unknown risk "${d.risk}"`);
  if (!STATUSES.includes(d.review_status)) fail(`unknown review_status "${d.review_status}"`);
  if (rel.split(sep)[0] !== d.category) fail(`folder must match category "${d.category}"`);
  if (!d.title || String(d.title).length < 3) fail('title too short');
  if (!d.summary || String(d.summary).length < 10) fail('summary too short');
  if (!Number.isInteger(d.level) || d.level < 1 || d.level > 4) fail('level must be 1-4');
  if (content.trim().length < 3) fail('body is empty');

  // Duplicate slugs
  const key = rel.replace(/\.md$/, '');
  const base = key.split(sep).pop();
  if (slugs.has(base)) fail(`duplicate slug, also used by ${slugs.get(base)}`);
  slugs.set(base, rel);

  const sources = Array.isArray(d.sources) ? d.sources : [];
  if (sources.length < 1) fail('at least one source is required');
  sources.forEach((s, i) => {
    if (!/^https?:\/\//.test(s?.url ?? '')) fail(`source ${i + 1} needs a valid url`);
    if (!['A', 'B', 'C'].includes(s?.reliability)) fail(`source ${i + 1} needs reliability A, B or C`);
  });

  if (d.type === 'species-card') {
    if (!d.region || d.region === 'global') fail('species-card needs a specific region');
    if (d.risk !== 'critical') fail('species-card must be risk: critical');
  }
  if (d.type === 'news') {
    if (!d.published) fail('news needs a published date');
    if (!sources.some((s) => /^https?:\/\//.test(s?.url ?? ''))) fail('news needs a linked source');
  }

  if (GATED.includes(d.review_status)) {
    if (d.risk === 'high' || d.risk === 'critical') {
      if (!String(d.reviewed_by ?? '').trim()) fail(`${d.risk} risk needs reviewed_by before "${d.review_status}"`);
      if (sources.length < 2) fail(`${d.risk} risk needs at least two sources before "${d.review_status}"`);
      const publishers = new Set(sources.map((s) => String(s?.publisher ?? '').trim().toLowerCase()));
      if (d.risk === 'critical' && publishers.size < 2) fail('critical risk needs two independent publishers');
    }
  }
  if (d.review_status === 'published' && !d.published) fail('published content needs a published date');
}

if (errors.length) {
  console.error(`Content validation failed (${errors.length}):\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(`Content validation passed for ${slugs.size} file(s).`);
