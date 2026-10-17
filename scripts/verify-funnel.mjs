import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../assets/funnel.js", import.meta.url),
  "utf8",
);

// Exercise the browser/API boundary without writing test leads to production.
function client(audience, fetchImpl) {
  const handlers = {},
    events = [];
  let resetCount = 0;
  const elements = {
    name: {
      value: "Test Creator",
      setCustomValidity() {},
      reportValidity() {},
    },
    email: { value: "test@example.invalid" },
    profile: { value: audience === "brand" ? "Example Golf" : "@example" },
    consent: { checked: true },
    website: { value: "" },
    goal: { value: "Product seeding" },
  };
  const button = { textContent: "Join", disabled: false },
    status = {
      hidden: true,
      focus() {
        this.focused = true;
      },
    };
  const form = {
    dataset: { audience },
    action: "https://example.invalid/waitlist",
    elements,
    querySelector: (s) => (s === "[type=submit]" ? button : status),
    addEventListener: (name, fn) => (handlers[name] = fn),
    reportValidity: () => true,
    setAttribute() {},
    removeAttribute() {},
    reset() {
      resetCount++;
    },
  };
  const document = {
    querySelectorAll: (s) => (s === ".lead-form[data-audience]" ? [form] : []),
    querySelector: () => null,
    addEventListener() {},
  };
  const context = {
    document,
    window: { dispatchEvent: (e) => events.push(e.detail) },
    location: { pathname: "/" + audience },
    CustomEvent: class {
      constructor(type, options) {
        this.detail = options.detail;
      }
    },
    matchMedia: () => ({ addEventListener() {} }),
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    console,
    TypeError,
  };
  vm.runInNewContext(source, context);
  return {
    elements,
    button,
    status,
    events,
    submit: () => handlers.submit({ preventDefault() {} }),
    get resetCount() {
      return resetCount;
    },
  };
}
test("brand objective reaches the API; success follows an acknowledged save", async () => {
  let payload;
  const c = client("brand", async (url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ success: true }) };
  });
  await c.submit();
  assert.equal(payload.audience, "brand");
  assert.equal(payload.profile, "Example Golf | Product seeding");
  assert.equal(payload.consent, true);
  assert.equal(c.resetCount, 1);
  assert.match(c.status.textContent, /interest is saved/);
  assert.equal(c.button.disabled, false);
  assert.equal(
    c.events.filter((e) => e.event === "gct_form_submitted").length,
    1,
  );
  assert.ok(
    c.events.every((e) => !JSON.stringify(e).includes("test@example.invalid")),
  );
});
test("failed save preserves user input and enables a retry", async () => {
  const c = client("creator", async () => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  }));
  await c.submit();
  assert.equal(c.elements.email.value, "test@example.invalid");
  assert.equal(c.resetCount, 0);
  assert.equal(c.button.disabled, false);
  assert.equal(c.status.hidden, false);
  assert.match(c.status.className, /error/);
  assert.equal(
    c.events.filter((e) => e.event === "gct_form_submitted").length,
    0,
  );
});
test("a second submit while saving cannot create a duplicate request", async () => {
  let calls = 0,
    release;
  const response = new Promise((resolve) => (release = resolve));
  const c = client("creator", async () => {
    calls++;
    await response;
    return { ok: true, json: async () => ({ success: true }) };
  });
  const first = c.submit();
  await c.submit();
  assert.equal(calls, 1);
  assert.equal(c.button.disabled, true);
  release();
  await first;
  assert.equal(c.resetCount, 1);
  assert.equal(c.button.disabled, false);
});
test("HTTP 200 without success never shows a false confirmation", async () => {
  const c = client("creator", async () => ({
    ok: true,
    json: async () => ({}),
  }));
  await c.submit();
  assert.equal(c.resetCount, 0);
  assert.match(c.status.className, /error/);
});
test("form API payload stays inside existing profile limits", async () => {
  let payload;
  const c = client("brand", async (url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ success: true }) };
  });
  c.elements.profile.value = "x".repeat(140);
  c.elements.goal.value = "Help planning a campaign";
  await c.submit();
  assert.ok(payload.profile.length <= 200);
});
