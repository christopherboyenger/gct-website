// Anonymous visitors use the project's public anon JWT at the gateway.
// All database credentials stay in the Edge Function environment.
const ALLOWED_ORIGINS = new Set([
  "https://golfcreatortour.com",
  "https://www.golfcreatortour.com",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);
const MAX_BODY_BYTES = 4096;

function response(origin: string | null, body: object, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Origin",
      ...(origin && ALLOWED_ORIGINS.has(origin)
        ? { "Access-Control-Allow-Origin": origin }
        : {}),
      ...extra,
    },
  });
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("invalid_json");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_json");
  }
  return value;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().normalize("NFC");
  return /[\u0000-\u001f\u007f]/u.test(text) ? null : text;
}

async function fingerprint(secret: string, kind: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const hash = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`website-waitlist:${kind}:${value}`),
  );
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return response(null, { error: "Please join through golfcreatortour.com." }, 403);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin",
      },
    });
  }
  if (req.method !== "POST") {
    return response(origin, { error: "Use the waitlist form to join." }, 405, { "Allow": "POST, OPTIONS" });
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
    return response(origin, { error: "Please submit the waitlist form again." }, 415);
  }

  let input: Record<string, unknown>;
  try {
    input = await readJson(req);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "body_too_large";
    return response(origin, { error: "Please check your details and try again." }, tooLarge ? 413 : 400);
  }
  // Bots receive the same acknowledgment, without a database write.
  if (input.website) return response(origin, { success: true });

  const name = clean(input.name);
  const email = clean(input.email)?.toLowerCase() ?? null;
  const audience = input.audience;
  const profile = input.profile == null ? "" : clean(input.profile);
  if (!name || name.length > 100 || !email || email.length > 254 ||
      !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email) ||
      (audience !== "creator" && audience !== "brand") ||
      profile === null || profile.length > 200 || input.consent !== true) {
    return response(origin, { error: "Add your name, a valid email, your role, and consent to join." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serverKey) {
    console.error("Waitlist database environment is unavailable");
    return response(origin, { error: "We couldn't save your place. Please try again shortly." }, 503);
  }
  try {
    // Supabase's hosted API ingress is behind Cloudflare. Only use its overwritten
    // connecting-IP header; never trust X-Forwarded-For or an IP in the JSON body.
    // Missing metadata falls back to the durable global and email limits.
    const edgeIp = req.headers.get("cf-connecting-ip");
    const validIp = edgeIp && /^[0-9a-f:.]{3,45}$/i.test(edgeIp) ? edgeIp : null;
    const [emailHash, ipHash] = await Promise.all([
      fingerprint(serverKey, "email", email),
      validIp ? fingerprint(serverKey, "ip", validIp) : Promise.resolve(null),
    ]);
    const result = await fetch(`${url}/rest/v1/rpc/submit_website_season_waitlist`, {
      method: "POST",
      headers: {
        "apikey": serverKey,
        "Authorization": `Bearer ${serverKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_name: name, p_email: email, p_audience: audience,
        p_profile: profile || null, p_email_hash: emailHash, p_ip_hash: ipHash,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) {
      console.error("Waitlist database request failed", result.status);
      return response(origin, { error: "We couldn't save your place. Please try again shortly." }, 503);
    }
    const accepted = await result.json();
    if (accepted !== true) {
      return response(origin, { error: "Too many attempts. Please try again in a few minutes." }, 429, { "Retry-After": "600" });
    }
    return response(origin, { success: true });
  } catch {
    console.error("Waitlist database request unavailable");
    return response(origin, { error: "We couldn't save your place. Please try again shortly." }, 503);
  }
});
