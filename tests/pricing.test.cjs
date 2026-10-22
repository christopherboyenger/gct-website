const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

// Brand pricing follows the GCT Brand Products and Pricing v2 document (§2 plans, §10 fee logic),
// the only pricing source of truth (founder ruling, 2026-10-22). These figures are pinned here on
// purpose: a change to them should be a deliberate, reviewed diff in this file.
const STARTER = { name: 'Starter', base: 0, rate: 0.12, min: 25, hires: 2 };
const PRO = { name: 'Pro', base: 299, annual: 2988, rate: 0.07, min: 0 };

// GCT fee on one paid collaboration, in cents: max(round(C × rate), minimum). The brand pays C + fee.
const fee = (plan, pay) => Math.max(Math.round(pay * 100 * plan.rate), plan.min * 100);
const money = cents => {
  const n = Math.round(cents) / 100;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
const read = file => readFileSync(resolve(__dirname, '..', file), 'utf8');
const squash = s => String(s).replace(/\s+/g, ' ').replace(/[‘’]/g, "'").trim();
const text = (root, selector) => squash(root.querySelector(selector)?.textContent ?? '');

const html = read('gct-brands.html');
const { document } = parseHTML(html);
const section = document.querySelector('#pricing[data-pricing]');
const plans = () => [...section.querySelectorAll('article.plan')];
const plan = name => plans().find(p => text(p, '.plan-name') === name);
const faq = question => {
  const item = [...document.querySelectorAll('.faq details')].find(d => squash(d.querySelector('summary').textContent) === question);
  assert.ok(item, `Missing FAQ: ${question}`);
  return text(item, 'p');
};

// Expected calculator result for a monthly spend split across `hires` paid collaborations ("campaign" = campaigns or 3+ hires).
function expected(spend, hires) {
  const count = hires === 'campaign' ? 0 : Number(hires);
  const rows = [STARTER, PRO].map(p => {
    if (p.hires && !(count && count <= p.hires)) return { ...p, available: false };
    const n = count || 1;
    const f = n * fee(p, spend / n);
    return { ...p, available: true, fee: f, cost: p.base * 100 + f };
  });
  const open = rows.filter(r => r.available).sort((a, b) => a.cost - b.cost);
  const closed = rows.filter(r => !r.available);
  const [fit, next] = open;
  return {
    rows, fit,
    hires: count ? `across ${count} paid collaboration${count > 1 ? 's' : ''}` : 'through a campaign or 3+ hires',
    saving: closed.length
      ? closed.map(c => `. ${c.name} can't run campaigns or make more than ${c.hires} new direct hires a month`).join('')
      : next && next.cost - fit.cost >= 100 ? `, ${money(next.cost - fit.cost)} a month less than ${next.name}` : '',
  };
}

// Checks a pricing section's calculator output (static or live) against the expected result.
function assertCalculator(root, spend, hires) {
  const want = expected(spend, hires);
  const label = `$${spend} / ${hires}`;
  const card = name => [...root.querySelectorAll('article.plan')].find(p => text(p, '.plan-name') === name);
  for (const row of want.rows) {
    assert.equal(text(card(row.name), '[data-out="fee"]'), row.available ? money(row.fee) : '—', `${label}: ${row.name} fee`);
    assert.equal(text(card(row.name), '[data-out="cost"]'), row.available ? money(row.cost) + '/mo' : 'Not available', `${label}: ${row.name} cost`);
  }
  assert.deepEqual([...root.querySelectorAll('.plan.fit')].map(p => text(p, '.plan-name')), [want.fit.name], `${label}: fit card`);
  assert.equal(text(root, '[data-out="spend"]'), money(spend * 100), `${label}: spend`);
  assert.equal(text(root, '[data-out="hires"]'), want.hires, `${label}: hires`);
  assert.equal(text(root, '[data-out="fit"]'), want.fit.name, `${label}: fit text`);
  assert.equal(text(root, '[data-out="saving"]'), want.saving, `${label}: saving`);
  if (hires === 'campaign') assert.equal(want.fit.name, 'Pro', 'Only Pro can run campaigns');
}

test('the fee formula reproduces the pricing document’s sample checkouts', () => {
  // §10 sample checkouts: [plan, creator pay, GCT fee, brand total]
  for (const [p, pay, gctFee, total] of [[STARTER, 100, 25, 125], [STARTER, 500, 60, 560], [PRO, 500, 35, 535], [PRO, 2500, 175, 2675]]) {
    assert.equal(fee(p, pay), gctFee * 100, `${p.name} fee on $${pay}`);
    assert.equal(pay * 100 + fee(p, pay), total * 100, `${p.name} total on $${pay}`);
  }
  // The $25 minimum applies below about $208.33 of creator pay, and only on Starter.
  assert.equal(fee(STARTER, 208), 2500);
  assert.equal(fee(STARTER, 209), 2508);
  assert.equal(fee(PRO, 100), 700);
  // §2 upgrade economics: break-even monthly creator pay versus monthly Pro and the annual plan's monthly equivalent.
  assert.equal(PRO.annual / 12, 249);
  assert.equal(Math.round(PRO.base / (STARTER.rate - PRO.rate)), 5980);
  assert.equal(Math.round(PRO.annual / 12 / (STARTER.rate - PRO.rate)), 4980);
});

test('the Brands page shows exactly three plans: Starter, Pro and Managed', () => {
  assert.ok(section, 'Missing #pricing section');
  assert.deepEqual(plans().map(p => text(p, '.plan-name')), ['Starter', 'Pro', 'Managed']);
  const ctas = plans().map(p => [text(p, '.plan-cta'), p.querySelector('.plan-cta').getAttribute('href')]);
  assert.deepEqual(ctas, [
    ['Get Started Free', 'https://golfcreatortour.app/brands'],
    ['Start Pro', 'https://golfcreatortour.app/brands'],
    ['Talk to GCT', 'mailto:info@golfcreatoropen.com?subject=GCT%20Managed%20Creator%20Program'],
  ]);
});

test('Starter is $0 with a 12% fee, a $25 minimum, 2 new hires a month and no campaigns', () => {
  const card = plan('Starter');
  assert.equal(Number(card.getAttribute('data-plan-base')), STARTER.base);
  assert.equal(Number(card.getAttribute('data-plan-rate')), STARTER.rate);
  assert.equal(Number(card.getAttribute('data-plan-min')), STARTER.min);
  assert.equal(Number(card.getAttribute('data-plan-hires')), STARTER.hires);
  assert.equal(text(card, '.plan-price'), '$0/ month');
  assert.equal(text(card, '.plan-fee'), '+ 12% GCT service fee on paid collaborations, $25 minimum per collaboration');
  const items = [...card.querySelectorAll('.checks li')].map(li => squash(li.textContent));
  assert.ok(items.includes('Up to 2 new direct hires per calendar month'));
  assert.ok(items.includes('1 active paid collaboration at a time'));
  assert.ok(items.includes('1 team seat'));
  assert.ok(!items.some(i => /campaign/i.test(i)), 'Starter must not list campaign features');
  assert.match(text(card, '.plan-foot'), /Public and invite-only campaigns need Pro/);
});

test('Pro is $299 a month or $2,988 billed annually, with a 7% fee, campaigns and 3 seats', () => {
  const card = plan('Pro');
  assert.equal(Number(card.getAttribute('data-plan-base')), PRO.base);
  assert.equal(Number(card.getAttribute('data-plan-rate')), PRO.rate);
  assert.equal(card.getAttribute('data-plan-min'), null, 'Pro has no minimum fee');
  assert.equal(card.getAttribute('data-plan-hires'), null, 'Pro has no monthly hire cap');
  assert.equal(text(card, '.plan-price'), '$299/ month');
  const fees = [...card.querySelectorAll('.plan-fee')].map(p => squash(p.textContent));
  assert.deepEqual(fees, ['or $2,988 billed annually (equivalent to $249 a month)', '+ 7% GCT service fee on paid collaborations, no minimum']);
  const items = [...card.querySelectorAll('.checks li')].map(li => squash(li.textContent));
  for (const item of ['Open and invite-only campaigns', 'Up to 3 active campaigns at a time', 'Up to 3 team seats']) assert.ok(items.includes(item), item);
  // $249 is only ever the equivalent of the annual charge, never a monthly price.
  for (const match of squash(html.replace(/<[^>]+>/g, ' ')).matchAll(/.{0,40}\$249.{0,30}/g)) {
    assert.match(match[0], /\$2,988 billed annually \(equivalent to \$249 a month\)/, match[0]);
  }
});

test('Managed is a custom quote with no published price or percentage', () => {
  const card = plan('Managed');
  assert.equal(text(card, '.plan-price'), 'Custom');
  assert.doesNotMatch(text(card, '*'), /\$|%/);
  assert.doesNotMatch(squash(html), /20%|\$2,500 (minimum|per campaign)|retainer/i);
});

test('the pricing section gives the one plain fee explanation', () => {
  const explanation = "Creators receive their agreed fee. GCT's platform fee is added to the brand's total.";
  assert.ok(squash(section.textContent).includes(explanation));
  assert.equal(faq('Does the creator receive their full rate?'), 'Yes. ' + explanation);
  assert.doesNotMatch(squash(section.textContent), /processing|processor|payout fee|waterfall/i);
});

test('FAQ figures come from the pricing document', () => {
  const cost = faq('What does GCT cost?');
  for (const s of ['12% GCT service fee', '$25 minimum', '$299 a month', '$2,988 billed annually', '7% with no minimum']) assert.ok(cost.includes(s), s);
  const hire = faq('What does a hire cost?');
  for (const [p, pay] of [[STARTER, 500], [STARTER, 100], [PRO, 500]]) {
    assert.ok(hire.includes(money(pay * 100 + fee(p, pay))), `${p.name} $${pay} total`);
    assert.ok(hire.includes(money(fee(p, pay))), `${p.name} $${pay} fee`);
  }
  const campaigns = faq('Can Starter launch campaigns?');
  assert.match(campaigns, /^No\./);
  assert.ok(campaigns.includes(money(2500 * 100 + fee(PRO, 2500))) && campaigns.includes(money(fee(PRO, 2500))));
  const worth = faq('When is Pro worth it?');
  assert.ok(worth.includes('$5,980') && worth.includes('$4,980') && worth.includes('$2,988 billed annually'));
  assert.match(faq('Do gifts require posting?'), /^No\. Product gifting is voluntary/);
});

test('pre-rendered calculator copy matches the default selection without site.js', () => {
  const spend = section.querySelectorAll('[data-spend][aria-pressed="true"]');
  const hires = section.querySelectorAll('[data-hires][aria-pressed="true"]');
  assert.equal(spend.length, 1);
  assert.equal(hires.length, 1);
  assertCalculator(section, Number(spend[0].getAttribute('data-spend')), hires[0].getAttribute('data-hires'));
});

test('site.js works out every calculator option with the document’s formula', () => {
  const page = parseHTML(html);
  page.window.matchMedia = () => ({ matches: true }); // reduced motion: skip the brand-strip animation loop
  vm.runInNewContext(read('assets/site.js'), { window: page.window, document: page.document });
  const live = page.document.querySelector('#pricing[data-pricing]');
  const spends = [...live.querySelectorAll('[data-spend]')].map(b => Number(b.getAttribute('data-spend')));
  const hireOptions = [...live.querySelectorAll('[data-hires]')].map(b => b.getAttribute('data-hires'));
  assert.deepEqual(hireOptions, ['1', '2', 'campaign']);
  assert.ok(spends.some(s => fee(STARTER, s) === STARTER.min * 100), 'One spend option should show the $25 minimum');
  assert.ok(spends.some(s => s > 5980) && spends.some(s => s < 5980), 'Spend options should straddle the Pro break-even');
  for (const s of spends) {
    for (const h of hireOptions) {
      live.querySelector(`[data-hires="${h}"]`).click();
      live.querySelector(`[data-spend="${s}"]`).click();
      assert.equal(live.querySelectorAll('[aria-pressed="true"]').length, 2);
      assertCalculator(live, s, h);
    }
  }
});

test('superseded prices, plan names and CTAs are gone from the website', () => {
  for (const file of ['gct-brands.html', 'gct-network.html', 'gct-creators.html', 'gct-courses.html', 'gct-events.html', 'index.html', 'assets/site.js']) {
    const source = read(file);
    const body = squash(source.replace(/<[^>]+>/g, ' '));
    for (const old of [/\$199\b/, /(^|[^\d.])(10|5|15)% (GCT )?fee/i, /\$3,980|\$3,737/, /\$39\b/, /Free is the fit/, /\bStart with Pro\b|\bTalk to Us\b/]) {
      assert.doesNotMatch(body, old, `${file} still has ${old}`);
    }
    assert.doesNotMatch(source, /<span>Start Free<\/span>/, `${file} still has the old Start Free CTA`);
  }
});

const PAGES = ['gct-brands.html', 'gct-network.html', 'gct-creators.html', 'gct-courses.html', 'gct-events.html'];

test('brand app CTAs offer an action every plan can take (campaigns are Pro)', () => {
  for (const file of PAGES) {
    const { document: d } = parseHTML(read(file));
    for (const a of d.querySelectorAll('a')) {
      assert.doesNotMatch(squash(a.textContent), /^(Start|Launch|Create) a Campaign$/i, `${file}: campaign CTA aimed at every brand`);
    }
    for (const a of d.querySelectorAll('a[href="https://golfcreatortour.app/brands"]')) {
      assert.ok(['Hire Creators', 'Get Started Free', 'Start Pro'].includes(squash(a.textContent)), `${file}: ${squash(a.textContent)}`);
    }
  }
});
