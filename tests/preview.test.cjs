const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { execFileSync } = require('node:child_process');
const { mkdtemp, mkdir, writeFile, readFile, readdir, copyFile, rm } = require('node:fs/promises');
const { resolve, join, dirname, relative, isAbsolute } = require('node:path');
const { tmpdir } = require('node:os');
const handler = require('../api/preview.js');

const ROOT = resolve(__dirname, '..');
const HOST = 'preview.example.test';
const PASSWORD = 'test-fixture-password-not-for-deployment';
const SECRET = 'test-fixture-signing-secret-not-for-deployment-32';
const ENV_KEYS = ['GCT_PREVIEW_PASSWORD', 'GCT_PREVIEW_SESSION_SECRET', 'GCT_PREVIEW_LOCAL_HTTP', 'VERCEL'];
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
const originalDirectory = process.cwd();

function configure() {
  process.env.GCT_PREVIEW_PASSWORD = PASSWORD;
  process.env.GCT_PREVIEW_SESSION_SECRET = SECRET;
  process.env.VERCEL = '1';
  delete process.env.GCT_PREVIEW_LOCAL_HTTP;
}

before(() => process.chdir(ROOT));
beforeEach(configure);
after(() => {
  process.chdir(originalDirectory);
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

async function request(method, url, { headers = {}, body, query, rawBody } = {}) {
  const req = Readable.from(rawBody === undefined ? [] : [rawBody]);
  Object.assign(req, {
    method, url, body, query,
    headers: {
      host: HOST, origin: `https://${HOST}`,
      'content-type': 'application/json', 'sec-fetch-site': 'same-origin',
      ...headers,
    },
  });
  const result = { headers: {}, body: '', status: 200 };
  const res = {
    statusCode: 200,
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    end(body = '') { result.body = String(body); result.status = this.statusCode; },
  };
  await handler(req, res);
  return result;
}

async function login(page = 'network') {
  const response = await request('POST', '/api/preview?action=login', { body: { password: PASSWORD, page } });
  assert.equal(response.status, 200);
  return { response, cookie: response.headers['set-cookie'].split(';')[0] };
}

function assertLocked(response, page = 'network') {
  assert.equal(response.status, 303);
  assert.equal(response.headers.location, `/?preview=${page}`);
  assert.equal(response.body, '');
  assert.match(response.headers['cache-control'], /no-store/);
}

test('correct password creates a secure session and serves the protected website', async () => {
  const { response, cookie } = await login('courses');
  assert.deepEqual(JSON.parse(response.body), { next: '/preview/courses' });
  assert.match(response.headers['set-cookie'], /^__Host-gct_preview=/);
  for (const flag of ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Secure', 'Max-Age=28800']) {
    assert.ok(response.headers['set-cookie'].includes(flag), `Cookie missing ${flag}`);
  }
  const page = await request('GET', '/api/preview?page=network', { headers: { cookie } });
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.match(page.body, /href="\/preview\/courses"/);
  assert.match(page.body, /href="\/preview#brands"/);
  assert.match(page.body, /Exit preview/);
  assert.match(page.headers['cache-control'], /no-store/);
  assert.equal(page.headers['vercel-cdn-cache-control'], 'no-store');
  assert.match(page.headers['x-robots-tag'], /noindex/);
});

test('wrong or absent passwords never create a session', async () => {
  for (const password of ['wrong-password', '', undefined, ['not-a-string']]) {
    const response = await request('POST', '/api/preview?action=login', { body: { password } });
    assert.equal(response.status, 401);
    assert.equal(response.headers['set-cookie'], undefined);
  }
  assertLocked(await request('GET', '/preview'));
});

test('a tampered, expired, or password-rotated session fails closed', async () => {
  const { cookie } = await login();
  const last = cookie.endsWith('a') ? 'b' : 'a';
  assertLocked(await request('GET', '/preview', { headers: { cookie: cookie.slice(0, -1) + last } }));

  const realNow = Date.now;
  let expiredCookie;
  try {
    Date.now = () => realNow() - (8 * 60 * 60 + 10) * 1000;
    expiredCookie = (await login()).cookie;
  } finally {
    Date.now = realNow;
  }
  assertLocked(await request('GET', '/preview', { headers: { cookie: expiredCookie } }));

  process.env.GCT_PREVIEW_PASSWORD = 'a-different-test-password';
  assertLocked(await request('GET', '/preview', { headers: { cookie } }));
});

test('missing configuration disables login and previously issued sessions', async () => {
  const { cookie } = await login();
  for (const [key, value] of [
    ['GCT_PREVIEW_PASSWORD', ''],
    ['GCT_PREVIEW_SESSION_SECRET', ''],
    ['GCT_PREVIEW_SESSION_SECRET', 'too-short'],
  ]) {
    configure();
    process.env[key] = value;
    const response = await request('POST', '/api/preview?action=login', { body: { password: PASSWORD } });
    assert.equal(response.status, 503);
    assert.equal(response.headers['set-cookie'], undefined);
    assertLocked(await request('GET', '/preview', { headers: { cookie } }));
  }
});

test('login and logout reject cross-origin or missing-origin submissions', async () => {
  const { cookie } = await login();
  for (const headers of [
    { origin: 'https://other.example.test' },
    { origin: `http://${HOST}` },
    { origin: undefined },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    for (const action of ['login', 'logout']) {
      const response = await request('POST', `/api/preview?action=${action}`, {
        headers: { cookie, ...headers }, body: { password: PASSWORD },
      });
      assert.equal(response.status, 403);
      assert.equal(response.headers['set-cookie'], undefined);
    }
  }
});

test('logout expires the cookie and HEAD requires authentication without returning HTML', async () => {
  const { cookie } = await login();
  assertLocked(await request('HEAD', '/preview'));
  const head = await request('HEAD', '/preview', { headers: { cookie } });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.match(head.headers['content-type'], /^text\/html/);
  const response = await request('POST', '/api/preview?action=logout', { headers: { cookie } });
  assert.equal(response.status, 303);
  assert.equal(response.headers.location, '/');
  assert.match(response.headers['set-cookie'], /^__Host-gct_preview=;/);
  assert.match(response.headers['set-cookie'], /Max-Age=0/);
  assertLocked(await request('GET', '/preview', {
    headers: { cookie: response.headers['set-cookie'].split(';')[0] },
  }));
});

test('only allowed pages and redirect destinations are accepted', async () => {
  const { cookie } = await login();
  for (const page of ['../../.env', '/gct-network.html', 'unknown', '__proto__', 'constructor']) {
    const response = await request('GET', `/api/preview?page=${encodeURIComponent(page)}`, { headers: { cookie } });
    assert.equal(response.status, 404);
    assert.doesNotMatch(response.body, /<!DOCTYPE html>/i);
  }
  const response = await login('https://other.example.test');
  assert.deepEqual(JSON.parse(response.response.body), { next: '/preview' });
  const brands = await request('GET', '/api/preview?page=brands', { headers: { cookie } });
  assert.equal(brands.headers.location, '/preview#brands');
});

test('courses resolve through both rewritten URLs and Vercel query helpers', async () => {
  const { cookie } = await login();
  for (const [url, query] of [
    ['/api/preview?page=courses', undefined],
    ['/preview/courses', undefined],
    ['/api/preview', { page: 'courses' }],
  ]) {
    const response = await request('GET', url, { headers: { cookie }, query });
    assert.equal(response.status, 200);
    assert.match(response.body.match(/<title>(.*?)<\/title>/s)?.[1] || '', /Courses/);
  }
});

test('form submissions and streamed JSON work without disclosing secrets', async () => {
  const form = await request('POST', '/api/preview?action=login', {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: new URLSearchParams({ password: PASSWORD, page: 'brands' }).toString(),
  });
  assert.equal(form.status, 303);
  assert.equal(form.headers.location, '/preview#brands');
  const json = await request('POST', '/api/preview?action=login', {
    rawBody: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(json.status, 200);
  const cookie = json.headers['set-cookie'].split(';')[0];
  for (const page of ['network', 'courses']) {
    const response = await request('GET', `/api/preview?page=${page}`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.ok(!response.body.includes(PASSWORD));
    assert.ok(!response.body.includes(SECRET));
    assert.ok(!response.body.includes(cookie));
  }
  const oversized = await request('POST', '/api/preview?action=login', { rawBody: 'x'.repeat(4097) });
  assert.equal(oversized.status, 400);
});

test('public build contains the countdown and assets but no private website HTML', async () => {
  // Exercise the real build in a tiny isolated fixture so verification never
  // replaces a running preview's output or copies its large media library.
  const fixture = await mkdtemp(join(tmpdir(), 'gct-preview-build-test-'));
  const fixtureRelative = relative(tmpdir(), fixture);
  assert.ok(!fixtureRelative.startsWith('..') && !isAbsolute(fixtureRelative));
  try {
    await mkdir(join(fixture, 'scripts'), { recursive: true });
    await copyFile(join(ROOT, 'scripts/build-season.mjs'), join(fixture, 'scripts/build-season.mjs'));
    const publicFiles = [
      'index.html', 'assets/season.css', 'assets/season.js',
      'assets/brand/gct-crest-white.png', 'logo-gct-full.png',
      'appfavicon.jpg', 'The Golf Creator Tour logo.png',
      'assets/preview.js', 'assets/preview.css', 'assets/site.js', 'assets/site.css',
    ];
    for (const file of [...publicFiles, 'gct-network.html', 'gct-courses.html', 'gct-brands.html', '.env.local']) {
      await mkdir(dirname(join(fixture, file)), { recursive: true });
      await writeFile(join(fixture, file), publicFiles.includes(file) ? `public fixture: ${file}` : `PRIVATE ${PASSWORD}`);
    }
    execFileSync(process.execPath, ['scripts/build-season.mjs'], { cwd: fixture, stdio: 'pipe' });
    const output = join(fixture, 'season-dist');
    async function filesIn(folder) {
      const entries = await readdir(folder, { withFileTypes: true });
      const nested = await Promise.all(entries.map(async entry => {
        const path = join(folder, entry.name);
        return entry.isDirectory() ? filesIn(path) : [path];
      }));
      return nested.flat();
    }
    const files = await filesIn(output);
    assert.deepEqual(files.filter(file => file.endsWith('.html')).map(file => relative(output, file)), ['index.html']);
    assert.equal(await readFile(join(output, 'assets/preview.js'), 'utf8'), 'public fixture: assets/preview.js');
    for (const file of files) assert.ok(!(await readFile(file, 'utf8')).includes(PASSWORD), `Private content leaked to ${relative(output, file)}`);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
