// Daily drafting pipeline (Faz 5). Picks the next queued topic from data/topics.json, reads ONLY the
// source pages listed for it, asks Claude to write a draft grounded in that text, and writes
// src/content/<category>/<id>.md with review_status: draft. A workflow then opens a pull request.
// Metadata and sources come from the queue, never from the model. Nothing is published here.
//
// Env: ANTHROPIC_API_KEY (required unless MOCK=1), MODEL (default claude-sonnet-5-5),
//      ALLOWED_STATUSES (default "active,pending-check"), TOPIC (force a topic id), MOCK=1 (offline test).
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const MOCK = process.env.MOCK === '1';
const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const ALLOWED = (process.env.ALLOWED_STATUSES || 'active,pending-check').split(',');
const UA = 'PrimaloreBot (+https://primalore.app)';
const MAX_CHARS = 14000; // per source page, keeps cost predictable
const TOPICS_FILE = 'data/topics.json';

const out = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
const stop = (msg, code = 0) => { console.log(code ? `::error::${msg.replace(/\n/g, ' ')}` : msg); out('drafted', 'false'); process.exit(code); };

const queue = JSON.parse(readFileSync(TOPICS_FILE, 'utf8'));
const topic = queue.topics.find((t) => (process.env.TOPIC ? t.id === process.env.TOPIC : t.status === 'queued'));
if (!topic) stop('No queued topic. Add more to data/topics.json.');
const file = join('src/content', topic.category, `${topic.id}.md`);
if (existsSync(file)) stop(`${file} already exists; mark the topic as drafted or change its id.`, 1);

// 1. Allowlist: only domains from the source inventory, and only with an allowed status.
let domains = [];
if (!MOCK) {
  const { parse } = await import('yaml');
  domains = parse(readFileSync('data/sources.yml', 'utf8')).filter((s) => ALLOWED.includes(s.status)).map((s) => s.domain);
}
const allowed = (u) => MOCK || domains.some((d) => new URL(u).hostname === d || new URL(u).hostname.endsWith(`.${d}`));

// 2. Read each source page (respecting robots.txt for our user agent).
async function robotsAllows(u) {
  try {
    const url = new URL(u);
    const res = await fetch(`${url.origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return true;
    const lines = (await res.text()).split('\n').map((l) => l.trim());
    let applies = false, disallowed = [];
    for (const l of lines) {
      const [k, ...r] = l.split(':'); const v = r.join(':').trim();
      if (/^user-agent$/i.test(k)) applies = v === '*' || /primalore/i.test(v);
      else if (applies && /^disallow$/i.test(k) && v) disallowed.push(v);
    }
    return !disallowed.some((p) => url.pathname.startsWith(p));
  } catch { return true; }
}
function toText(html) {
  return html
    .replace(/<(script|style|nav|footer|header|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|tr|div|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
const pages = [];
for (const s of topic.sources) {
  if (!allowed(s.url)) stop(`Source domain not allowed for ${s.url}. Check data/sources.yml and ALLOWED_STATUSES.`, 1);
  if (MOCK) { pages.push({ ...s, text: 'MOCK SOURCE TEXT. Run cold water over the burn for 20 minutes.' }); continue; }
  if (!(await robotsAllows(s.url))) stop(`robots.txt disallows ${s.url}. Not fetched.`, 1);
  const res = await fetch(s.url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) stop(`Could not read ${s.url} (HTTP ${res.status}).`, 1);
  pages.push({ ...s, text: toText(await res.text()).slice(0, MAX_CHARS) });
}

// 3. Ask the model for the body only.
const structure = {
  'quick-tip': '## Question\n## Answer (numbered steps if the format is step-by-step)\n## Check (one line to confirm it worked)',
  'core-guide': '## Overview\n## Steps or key points\n## Limits and when to get help',
  checklist: '## When to use this\n## Checklist (bullet list)\n## Limits',
}[topic.type] || '## Overview\n## Key points\n## Limits';
const system = `You write guides for Primalore, a UK survival-knowledge site. Rules:
- Use ONLY facts stated in the SOURCE TEXT. If the sources do not say it, leave it out. Never add medical, legal or safety claims from memory.
- Write in your own words, British English, plain and calm. No quotations longer than one short phrase.
- State limits and when to seek professional help or call 999 where the sources do.
- If the sources are too thin to write a safe guide, set "insufficient": true and explain in "notes".
Return ONLY JSON: {"summary": string (one sentence, 10-200 chars), "body": string (markdown, no title heading, using exactly these sections:\\n${structure}), "insufficient": boolean, "notes": string (anything a reviewer should double-check)}.`;
const user = `Topic: ${topic.title}\nType: ${topic.type}; format: ${topic.format}; risk: ${topic.risk}\nBrief: ${topic.brief}\n\n` +
  pages.map((p, i) => `SOURCE ${i + 1}: ${p.title} (${p.publisher})\n${p.url}\n---\n${p.text}`).join('\n\n====\n\n');

let result;
if (MOCK) {
  result = { summary: 'Mock summary for pipeline testing only, not real advice.', body: '## Overview\n\nMock body.', insufficient: false, notes: 'mock' };
} else {
  if (!process.env.ANTHROPIC_API_KEY) stop('ANTHROPIC_API_KEY is not set.', 1);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) stop(`Anthropic API error ${res.status}: ${(await res.text()).slice(0, 300)}`, 1);
  const data = await res.json();
  const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') ?? '';
  try { result = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); }
  catch { stop('Model did not return valid JSON.', 1); }
  console.log(`Tokens: ${data.usage?.input_tokens} in, ${data.usage?.output_tokens} out (${MODEL}).`);
}
if (result.insufficient) {
  topic.status = 'failed'; topic.note = `Sources too thin: ${result.notes}`;
  writeFileSync(TOPICS_FILE, JSON.stringify(queue, null, 2) + '\n');
  stop(`Sources judged insufficient: ${result.notes}`);
}

// 4. Write the draft. Front matter is built from the queue, strings JSON-quoted (valid YAML).
const q = (s) => JSON.stringify(String(s));
const today = new Date().toISOString().slice(0, 10);
const fm = [
  '---',
  `title: ${q(topic.title)}`,
  `format: ${topic.format}`,
  `type: ${topic.type}`,
  `category: ${topic.category}`,
  `subtopic: ${topic.subtopic}`,
  `level: ${topic.level}`,
  `risk: ${topic.risk}`,
  `region: ${topic.region}`,
  'season: all',
  'language: en-GB',
  `summary: ${q(result.summary)}`,
  'sources:',
  ...topic.sources.flatMap((s) => [`  - title: ${q(s.title)}`, `    url: ${q(s.url)}`, `    publisher: ${q(s.publisher)}`, `    reliability: ${s.reliability}`, `    accessed: ${today}`]),
  'reviewed_by: ""',
  'review_status: draft',
  'related: []',
  '---', '',
].join('\n');
mkdirSync(join('src/content', topic.category), { recursive: true });
writeFileSync(file, fm + result.body.trim() + '\n');
topic.status = 'drafted'; topic.drafted = today;
writeFileSync(TOPICS_FILE, JSON.stringify(queue, null, 2) + '\n');
writeFileSync('draft-notes.md', `**Topic:** ${topic.title}\n**Risk:** ${topic.risk}\n\n**Model notes for the reviewer:** ${result.notes || 'none'}\n`);
console.log(`Draft written: ${file}`);
out('drafted', 'true'); out('file', file); out('id', topic.id); out('title', topic.title); out('risk', topic.risk);
