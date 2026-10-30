// Reports which inventory domains answer and what their robots.txt says about us.
// Non-blocking: run manually or from the "Check sources" workflow. It does not change any file.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const sources = parse(readFileSync('data/sources.yml', 'utf8'));
const UA = 'PrimaloreBot (+https://primalore.app)';
let problems = 0;

for (const s of sources) {
  const url = `https://${s.domain}/robots.txt`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    const text = res.ok ? await res.text() : '';
    const blocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(text);
    const note = !res.ok ? `HTTP ${res.status}` : blocksAll ? 'robots.txt may disallow everything: review manually' : 'ok';
    if (!res.ok || blocksAll) problems++;
    console.log(`${s.id.padEnd(18)} ${s.domain.padEnd(28)} ${note}`);
  } catch (e) {
    problems++;
    console.log(`${s.id.padEnd(18)} ${s.domain.padEnd(28)} unreachable (${e.cause?.code ?? e.message})`);
  }
  await new Promise((r) => setTimeout(r, 1500)); // polite rate limit
}
console.log(`\n${sources.length} sources checked, ${problems} need attention.`);
