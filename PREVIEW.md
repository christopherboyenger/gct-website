# Website preview access

The public homepage remains the countdown. “Preview website” opens a password form. Successful login issues an eight-hour signed, HttpOnly, Secure, SameSite=Strict cookie. The password and signing secret are read only by the server; neither belongs in Git or browser code.

Configure these Vercel environment variables for each environment that needs preview access:

- `GCT_PREVIEW_PASSWORD`: the shared preview password.
- `GCT_PREVIEW_SESSION_SECRET`: a cryptographically random secret of at least 32 characters.

Missing configuration fails closed. Changing either value and redeploying invalidates existing sessions. “Exit preview” clears the browser session.

Routes:

- `/`: public countdown and waitlist.
- `/preview`: authenticated current network website.
- `/preview/courses`: authenticated courses and destinations page.
- `/preview/brands`: authenticated redirect to the network’s Brands section.

`api/preview.js` serves only the two explicitly allowed source HTML files. The public `season-dist` build contains only the countdown HTML and shared media/assets. The full website HTML is bundled into the server function with `includeFiles`; direct HTML filenames still reach the countdown. Existing photos, videos and source files in this public repository are not confidential materials.

The retired dark `gct-brands.html` is removed. The current Brands destination is the network page, consistent with the prior removal of the separate brand landing page.

Run `node scripts/build-season.mjs` and `node --test tests/preview.test.cjs` for build and server checks. Local HTTP testing may set `GCT_PREVIEW_LOCAL_HTTP=true`; this is ignored when `VERCEL=1`. Production always uses the Secure `__Host-gct_preview` cookie.

This shared password is for reviewing this marketing website. It is not an account system for customer or financial information.
