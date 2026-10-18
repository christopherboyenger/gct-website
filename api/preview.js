const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const SESSION_SECONDS = 8 * 60 * 60;
const pages = Object.freeze({
  network: 'gct-network.html', creators: 'gct-creators.html', brands: 'gct-brands.html',
  courses: 'gct-courses.html', events: 'gct-events.html',
});
const destinations = Object.freeze({
  network: '/preview', creators: '/preview/creators', brands: '/preview/brands',
  courses: '/preview/courses', events: '/preview/events',
});
const hash = value => createHash('sha256').update(value).digest();
const equal = (a, b) => timingSafeEqual(hash(a), hash(b));

function settings() {
  const password = process.env.GCT_PREVIEW_PASSWORD || '';
  const secret = process.env.GCT_PREVIEW_SESSION_SECRET || '';
  const local = process.env.GCT_PREVIEW_LOCAL_HTTP === 'true' && process.env.VERCEL !== '1';
  return { password, secret, ready: Boolean(password && secret.length >= 32), local,
    cookie: local ? 'gct_preview' : '__Host-gct_preview' };
}

function signature(value, config) {
  // Changing either server secret or password invalidates previously issued sessions.
  return createHmac('sha256', config.secret).update(config.password).update('\0').update(value).digest('base64url');
}

function validSession(req, config) {
  const cookies = String(req.headers.cookie || '').split(';').map(item => item.trim());
  const token = cookies.find(item => item.startsWith(config.cookie + '='))?.slice(config.cookie.length + 1) || '';
  if (!/^v1\.\d{10}\.[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [version, expires, nonce, signed] = token.split('.');
  const now = Math.floor(Date.now() / 1000);
  if (Number(expires) <= now || Number(expires) > now + SESSION_SECONDS) return false;
  return equal(signed, signature(`${version}.${expires}.${nonce}`, config));
}

function cookie(value, config, maxAge) {
  return `${config.cookie}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.local ? '' : '; Secure'}`;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.end();
}

async function bodyOf(req) {
  const type = String(req.headers['content-type'] || '').split(';')[0];
  if (!['application/json', 'application/x-www-form-urlencoded'].includes(type)) throw new Error('Invalid content type');
  if (Number(req.headers['content-length']) > 4096) throw new Error('Body too large');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > 4096) throw new Error('Body too large');
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 4096) throw new Error('Body too large');
    body = type === 'application/json' ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const config = settings();
  const url = new URL(req.url, `https://${req.headers.host}`);
  const action = req.query?.action ?? url.searchParams.get('action');
  const pathMatch = /^\/preview\/([a-z]+)$/.exec(url.pathname);
  const pathPage = pathMatch ? pathMatch[1] : 'network';
  const page = req.query?.page ?? url.searchParams.get('page') ?? pathPage;

  if (req.method === 'POST') {
    let origin;
    try { origin = new URL(req.headers.origin); } catch { return json(res, 403, { error: 'Open the preview from this website and try again.' }); }
    if (origin.host !== req.headers.host || (!config.local && origin.protocol !== 'https:') || req.headers['sec-fetch-site'] === 'cross-site') {
      return json(res, 403, { error: 'Open the preview from this website and try again.' });
    }
    if (action === 'logout') {
      res.setHeader('Set-Cookie', cookie('', config, 0));
      return redirect(res, '/');
    }
    if (action !== 'login') return json(res, 404, { error: 'Preview action not found.' });
    if (!config.ready) return json(res, 503, { error: 'Preview access is not configured yet. Please try again later.' });
    let body;
    try { body = await bodyOf(req); } catch { return json(res, 400, { error: 'Please enter your preview password again.' }); }
    if (typeof body.password !== 'string' || body.password.length > 256 || !equal(body.password, config.password)) {
      return json(res, 401, { error: 'That password didn’t match. Please try again.' });
    }
    const value = `v1.${Math.floor(Date.now() / 1000) + SESSION_SECONDS}.${randomBytes(18).toString('base64url')}`;
    res.setHeader('Set-Cookie', cookie(`${value}.${signature(value, config)}`, config, SESSION_SECONDS));
    const next = Object.hasOwn(destinations, body.page) ? destinations[body.page] : destinations.network;
    if (String(req.headers['content-type']).startsWith('application/json')) return json(res, 200, { next });
    return redirect(res, next);
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }
  if (action || !Object.hasOwn(destinations, page)) return json(res, 404, { error: 'Preview page not found.' });
  if (!config.ready || !validSession(req, config)) return redirect(res, `/?preview=${page}`);
  try {
    const renderer=await import('../lib/editor-render.mjs');
    let html=(await renderer.renderPage({page})).html;
    html = html.replace('<head>', '<head>\n  <base href="/">\n  <meta name="robots" content="noindex,nofollow,noarchive">\n  <link rel="stylesheet" href="/assets/preview.css">');
    for (const [name, file] of Object.entries(pages)) {
      html = html.replaceAll(`href="${file}`, `href="${destinations[name]}`);
    }
    html = html.replace('<div class="footer-bottom">', '<div class="footer-bottom"><form method="post" action="/api/preview?action=logout"><button class="preview-exit" type="submit">Exit preview</button></form>');
    // The existing website uses inline styles and small inline navigation handlers.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://qvuqjpcxnnikbigixupb.supabase.co; media-src 'self'; connect-src 'self' https://qvuqjpcxnnikbigixupb.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    res.end(req.method === 'HEAD' ? '' : html);
  } catch {
    return json(res, 503, { error: 'The website preview could not load. Please try again later.' });
  }
};
