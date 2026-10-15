# Season waitlist

The temporary site collects creator and brand interest for the 2027 GCT season opening November 1, 2026. Submissions are stored in the existing GCT Supabase project `qvuqjpcxnnikbigixupb`, in the separate `public.website_season_waitlist` table. Existing GCT tables and waitlist flows are unchanged.

## Browser contract

`POST https://qvuqjpcxnnikbigixupb.supabase.co/functions/v1/website-waitlist`

Send `Content-Type: application/json`, `apikey: <anonKey>`, and `Authorization: Bearer <anonKey>`. The public client key and endpoint are in `supabase/functions/website-waitlist/client-config.json`. This public key is safe to include in browser code; database service credentials must remain server-side.

```json
{
  "name": "Your name",
  "email": "you@example.com",
  "audience": "creator",
  "profile": "Optional social handle or company",
  "consent": true,
  "website": ""
}
```

`audience` accepts `creator` or `brand`. Name is required, up to 100 characters; email up to 254; optional profile up to 200. The visitor must explicitly check consent. `website` is the empty honeypot field. The server normalizes email casing and trims text. Request bodies are capped at 4 KB.

Success is HTTP 200 with `{"success":true}`. An existing email + audience + season receives the same success, preserving its original signup and consent. The response never reveals whether an email already exists. Errors return `{"error":"Visitor-facing explanation"}` with HTTP 400, 403, 405, 413, 415, 429, or 503. Only show success after the API acknowledges it; never claim a failed request was saved.

Allowed browser origins are exactly `https://golfcreatortour.com`, `https://www.golfcreatortour.com`, `http://localhost:4173`, and `http://127.0.0.1:4173`. Other or missing Origin headers are rejected. Previews on other domains must use an approved local origin or the production site. CORS is a browser boundary, not authentication or a substitute for abuse controls.

## Persistence and access

Stored fields are name, normalized email, audience, optional profile/company, season `2027`, source, creation time, consent time, consent version `season-2027-waitlist-v1`, and the exact audience-specific consent text. The API sends no email, creates no GCT account, and does not enroll anyone into a paid product.

Use the Supabase dashboard with an authorized admin account to inspect or export `website_season_waitlist`. Public and signed-in browser roles have no SELECT/INSERT/UPDATE/DELETE table grants. RLS is enabled with no public policies. Only the server role can call the insert RPC. The function uses the environment's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; neither service credentials nor signup data are returned to the browser or logged by this code.

## Abuse controls

The honeypot silently acknowledges bots without storing a signup. Atomic Postgres buckets enforce 100 valid attempts per minute globally, 2,000 per UTC day globally, five per normalized email per day, and, when trusted hosted ingress IP metadata is available, ten per IP per ten minutes and fifty per IP per day. These fixed-window counters work across function instances. The server uses Cloudflare's connecting-IP header from Supabase's hosted ingress, never a JSON IP or X-Forwarded-For. IPs and email bucket identifiers are HMAC-SHA256 fingerprints; raw IPs are not saved. If connecting-IP metadata is absent, email and global limits still apply. Rate limit responses include a retry hint; daily limits may require waiting until the next UTC day.

Expired rate buckets are deleted on subsequent accepted, validated requests after their window plus one day (at most about 48 hours while the form is active). A public form can still receive spam or reach shared limits; this implementation introduces no extra paid services or CAPTCHA provider.

## Deployment and schema

The live database migration is `20261015164207_website_season_waitlist`, applied through the connected Supabase migration tool on October 15, 2026. The SQL reference and canonical migration copy are in `supabase/schema-website-waitlist.sql` and `supabase/migrations/20261015164207_website_season_waitlist.sql`. The canonical timestamp comes from Supabase's migration history. The deployed migration history is authoritative.

Deploy the function's `index.ts` and `deno.json` as `website-waitlist`, with JWT verification enabled as specified in `supabase/config.toml`. The browser uses the existing public anon JWT; users do not need to sign in. This backend is independent of the static Vercel site build.

Live checks confirmed creator and brand persistence with consent, duplicate acknowledgment without extra rows, invalid input and missing consent rejection, honeypot exclusion, foreign-origin rejection, browser preflight, and denied anonymous reads. Schema checks confirmed RLS and denied browser table/RPC permissions. Supabase security/performance advisors found only expected informational notices for these new objects: [RLS with no public policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [an index not yet used](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). These do not require opening public table access.

## Verification and removal

Verify both audiences through the deployed form, duplicate acknowledgment, invalid input, missing consent, honeypot exclusion, foreign origin rejection, failed-request handling, denied anonymous data reads, and rate limits. Inspect stored consent fields using the dashboard or authorized SQL, then remove only the controlled `example.com` test records. Keep test addresses distinct from real signups.

To restore the complete website, remove the temporary routing/build gate and landing page in a normal release. Keep or export the waitlist records according to GCT's contact policy. The backend does not automatically publish the full website when the countdown ends.
