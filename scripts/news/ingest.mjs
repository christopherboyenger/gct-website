import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const sourcePath = path.join(root, 'data/news/sources.json');
const policyPath = path.join(root, 'data/news/editorial-policy.json');
const publishedPath = path.join(root, 'news-data.json');
const workDir = path.join(root, '.newsroom');
const outputPath = path.join(workDir, 'candidates.json');

const [sourceConfig, policy, published] = await Promise.all([
  readJson(sourcePath),
  readJson(policyPath),
  readJson(publishedPath)
]);

await fs.mkdir(workDir, { recursive: true });

const now = Date.now();
const maxAgeMs = policy.automation.maxCandidateAgeHours * 60 * 60 * 1000;
const publishedTitles = new Set((published.stories || []).map(s => normalizeTitle(s.title)));
const candidates = [];
const errors = [];

for (const source of sourceConfig.sources || []) {
  if (source.enabled === false) continue;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(source.url, {
      headers: {
        'user-agent': 'GCT-Daily-News-Scout/1.0 (+https://golfcreatortour.com/news)',
        'accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const items = parseRss(xml);

    for (const item of items) {
      const publishedAt = safeDate(item.pubDate);
      if (!publishedAt || publishedAt.getTime() > now + 60 * 60 * 1000) continue;
      const ageMs = now - publishedAt.getTime();
      if (ageMs > maxAgeMs) continue;

      const cleanTitle = stripPublisherSuffix(item.title, item.publisher);
      const normalized = normalizeTitle(cleanTitle);
      if (!normalized || publishedTitles.has(normalized)) continue;

      const score = scoreCandidate({ title: cleanTitle, description: item.description, ageMs, source });
      candidates.push({
        id: crypto.createHash('sha256').update(`${normalized}|${item.link}`).digest('hex').slice(0, 16),
        title: cleanTitle,
        normalizedTitle: normalized,
        description: stripHtml(item.description || '').slice(0, 900),
        discoveryUrl: item.link,
        discoveryPublisher: item.publisher || source.name,
        discoveredVia: source.id,
        sourceFocus: source.focus || [],
        publishedAt: publishedAt.toISOString(),
        ageHours: Math.round(ageMs / 360000) / 10,
        heuristicScore: score
      });
    }
  } catch (error) {
    errors.push({ source: source.id, error: error?.message || String(error) });
  }
}

const deduped = dedupeCandidates(candidates)
  .sort((a, b) => b.heuristicScore - a.heuristicScore || new Date(b.publishedAt) - new Date(a.publishedAt))
  .slice(0, 60);

const payload = {
  generatedAt: new Date().toISOString(),
  maxCandidateAgeHours: policy.automation.maxCandidateAgeHours,
  sourceCount: (sourceConfig.sources || []).length,
  candidateCount: deduped.length,
  errors,
  candidates: deduped
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`GCT scout: ${deduped.length} unique candidates from ${payload.sourceCount} discovery feeds.`);
if (errors.length) console.warn(`GCT scout: ${errors.length} source error(s).`, errors);

function scoreCandidate({ title, description, ageMs, source }) {
  const text = `${title} ${description || ''}`.toLowerCase();
  let score = Number(source.weight || 0);

  const weightedSignals = [
    [/(creator|influencer|content creator|youtube|instagram|tiktok)/g, 24],
    [/(sponsor|sponsorship|partnership|activation|campaign|collaboration)/g, 22],
    [/(brand|signs|signing|ambassador|launches|launch|debut)/g, 14],
    [/(funding|funded|acquisition|acquires|merger|investment|raises|earnings|revenue)/g, 22],
    [/(technology|startup|simulator|launch monitor|ai |artificial intelligence|platform|app)/g, 16],
    [/(resort|destination|course opening|venue|hospitality|travel)/g, 12],
    [/(media|broadcast|streaming|podcast|network|rights)/g, 14],
    [/(executive|chief marketing|cmo|marketing officer|vp of marketing|creator relations)/g, 12]
  ];

  for (const [pattern, weight] of weightedSignals) {
    if (pattern.test(text)) score += weight;
  }

  const negativeSignals = [
    /betting|odds|picks|fantasy|wager/i,
    /tee times|weather delay|round recap|scorecard/i,
    /leaderboard update|live scores|shot-by-shot/i,
    /injury update|withdraws from|misses cut/i
  ];
  for (const pattern of negativeSignals) if (pattern.test(text)) score -= 28;

  const hours = ageMs / 3600000;
  if (hours <= 6) score += 20;
  else if (hours <= 24) score += 15;
  else if (hours <= 48) score += 10;
  else score += 4;

  return Math.max(0, Math.min(100, score));
}

function dedupeCandidates(items) {
  const byTitle = new Map();
  for (const item of items) {
    const key = item.normalizedTitle;
    const existing = byTitle.get(key);
    if (!existing || item.heuristicScore > existing.heuristicScore) byTitle.set(key, item);
  }
  return [...byTitle.values()];
}

function parseRss(xml) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.map(block => ({
    title: getTag(block, 'title'),
    link: getTag(block, 'link') || getTag(block, 'guid'),
    pubDate: getTag(block, 'pubDate') || getTag(block, 'dc:date'),
    description: getTag(block, 'description'),
    publisher: getTag(block, 'source')
  })).filter(item => item.title && item.link && item.pubDate);
}

function getTag(block, tag) {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeEntities(stripCdata(match[1]).trim()) : '';
}

function stripCdata(value) {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function stripPublisherSuffix(title, publisher) {
  const clean = title.trim();
  if (publisher && clean.toLowerCase().endsWith(` - ${publisher}`.toLowerCase())) {
    return clean.slice(0, -(publisher.length + 3)).trim();
  }
  return clean;
}

function normalizeTitle(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}
