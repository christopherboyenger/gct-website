# Website editor

Open `/editor` and sign in with an existing GCT account. The shared website preview password does not grant editing access. Approved memberships live in `website_editor_members`; Piff's supplied, verified account has publishing access. No invitations were sent and no GCT account passwords were changed.

The editor supports the Brands/Homepage candidate, Creators, Courses & destinations and current network page. Site-wide styles are edited and published separately. Publishing updates protected website content; it does not remove the public countdown. Authorized editors get an “Edit this page” link when viewing protected pages.

## Editing

- Click an element; double-click a heading or paragraph to type directly.
- Use the inspector for text, links, images, video addresses/thumbnails, image descriptions, focal points, typography, spacing, colors and corners. Appearance can apply to all screens or only mobile.
- Design includes page-specific or site-wide fonts, colors, buttons and header crest/text/sizing/letter spacing.
- Page settings include search title/description, social title/description/image, canonical URL, indexing preference and favicon. Protected previews always remain noindex.
- Sections can be reordered and hidden. Static sections can be duplicated; interactive form/tab sections retain their original controls.
- Media contains existing assets and authorized uploads. Uploaded files are public website assets, with private metadata. HTML and SVG uploads are not accepted. Maximum size: 25 MB.
- Drafts autosave. Undo/redo stays in the editing window. History retains the latest 100 saved/published/restored snapshots per page. The current published page is also kept separately and can always be restored as a draft. Restore creates a draft; publishing remains explicit.

## Persistence and access

`api/editor.js` proxies Supabase Auth and the `website-editor` Edge Function. Access/refresh tokens are encrypted into a separate HttpOnly, Secure, SameSite=Strict cookie. Writes require same-origin requests. Membership and the underlying Auth session are checked on each Edge Function operation. No service key is shipped to Vercel or the browser.

The Edge Function uses its existing server-only service key. All four editor tables have RLS enabled and revoke access from `anon` and `authenticated`. The narrowly scoped RPCs are callable only by `service_role`. Editor access does not grant app administration rights. Public media has no anonymous/app-user upload policy.

Writes stay `SECURITY INVOKER` and reuse the existing verified-session lookup; they do not need direct access to `auth.users`. Live checks run as `service_role` confirm save/publish succeeds, invalid sessions fail and ordinary app users cannot execute commits. The verified-session migration was applied through the SQL connector after the migration connector returned an expired request-state error; its idempotent migration file is included for the next migration reconciliation.

Vercel requires `GCT_EDITOR_RENDER_PRIVATE_KEY`: an Ed25519 PKCS#8 PEM, held only as a sensitive environment variable. Its public key is committed in `lib/editor-config.json`. The key signs read-only published-content requests; it cannot authorize edits or publication. The encrypted cookie key is domain-separated from this key. Keep private keys out of the repository.

`GCT_EDITOR_NAMESPACE` is optional. Without it, production uses `production`; previews use `gct-preview-v2`. Draft/published content and history are isolated by namespace. Preview and production credentials/configuration must be provisioned separately.

Element identifiers derive from the source DOM structure. A template hash prevents old overrides from silently targeting a changed source template. Preserve the template version prefix unless intentionally changing the annotation algorithm. Runtime website source edits may require reviewing saved overrides; normal content edits do not change the underlying templates.

## Verification

`npm test` exercises server-side rendering, escaping, validation, section copying, metadata, responsive overrides, cookie encryption, authentication boundaries and the existing preview flow. Browser checks cover the full editor UI with isolated account/storage fixtures. Separate live database checks verify publication, conflicts, restoration and role restrictions without modifying real page content.

Supabase advisors report “RLS enabled, no policies” informational findings for the four service-only editor tables. That is deliberate: direct app/anonymous access is revoked, and privileged operations go through the authenticated Edge Function. Unrelated pre-existing project findings are outside this change.
