const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseHTML } = require('linkedom');

// The Brands page ships pre-rendered pricing for the default spend so it reads correctly
// before (or without) site.js. These checks keep that copy in step with each plan's settings.
const html = readFileSync(resolve(__dirname, '../gct-brands.html'), 'utf8');
const { document } = parseHTML(html);
const section = document.querySelector('#pricing[data-pricing]');
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const text = (root, selector) => root.querySelector(selector)?.textContent.trim();

test('the Brands page has a pricing section with one default spend selected', () => {
  assert.ok(section, 'Missing #pricing section');
  const pressed = section.querySelectorAll('[data-spend][aria-pressed="true"]');
  assert.equal(pressed.length, 1);
  assert.ok(Number(pressed[0].getAttribute('data-spend')) > 0);
});

test('pre-rendered plan costs match each plan subscription and fee rate', () => {
  const spend = Number(section.querySelector('[data-spend][aria-pressed="true"]').getAttribute('data-spend'));
  const plans = [...section.querySelectorAll('[data-plan-base]')].map(plan => {
    const base = Number(plan.getAttribute('data-plan-base'));
    const rate = Number(plan.getAttribute('data-plan-rate'));
    assert.equal(text(plan, '.plan-price b'), money(base));
    assert.match(text(plan, '.plan-fee'), new RegExp(`^\\+ ${rate * 100}% GCT fee`));
    assert.equal(text(plan, '[data-out="fee"]'), money(spend * rate));
    assert.equal(text(plan, '[data-out="cost"]'), money(base + spend * rate) + '/mo');
    return { plan, name: text(plan, '.plan-name'), cost: base + spend * rate };
  }).sort((a, b) => a.cost - b.cost);
  assert.ok(plans.length >= 2);

  const [fit, next] = plans;
  assert.deepEqual([...section.querySelectorAll('.plan.fit')], [fit.plan], 'The cheapest plan should be marked as the fit');
  assert.equal(text(section, '[data-out="spend"]'), money(spend));
  assert.equal(text(section, '[data-out="fit"]'), fit.name);
  assert.equal(text(section, '[data-out="saving"]'), `, ${money(next.cost - fit.cost)} a month less than ${next.name}`);
});
