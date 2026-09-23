# Roplant ERP — Frontend

Real, API-connected React app (see `src/api.js`). Auth and Settings call the live backend;
the rest of the app is still local state — see the honest module-by-module status in
`backend/README.md`.

## Run it

```bash
npm install
cp .env.example .env      # set VITE_API_URL to your backend, e.g. http://localhost:4000/api
npm run dev                # http://localhost:5173
```

## Installing as an app (PWA)

This app is installable — Chrome/Edge on Windows will offer an "Install" option, and
Android/iOS can add it to the home screen as a standalone app with its own icon, no browser
bar. This works via `public/manifest.json` and `public/sw.js` — no extra build step, no store
submission, no cost.

**What I verified by inspection, not by actually installing it** (no network/browser available
in the sandbox this was built in): the manifest is valid JSON with all required fields
(`name`, `icons`, `start_url`, `display: standalone`), the icons exist at the sizes Chrome's
install criteria require (192×192, 512×512, plus a maskable variant for Android's adaptive
icon shapes), the service worker has a `fetch` handler (a hard requirement for the install
prompt to appear), and `index.html` links everything correctly. **Please actually try
installing it once you have this running and tell me if the prompt doesn't appear** — that's
the one thing only a real browser can confirm.

**Windows (Chrome or Edge):**
1. Open the deployed site (or `http://localhost:5173` during dev — Chrome treats localhost as
   secure, so install works even before you deploy).
2. Look for an install icon (a monitor with a down-arrow) in the address bar, or open the
   browser's `⋮` menu → "Install Roplant ERP" / "Apps → Install this site as an app".
3. It installs like a normal Windows program — Start Menu entry, its own window, a taskbar icon.

**Android (Chrome):** open the site → `⋮` menu → "Add to Home screen" (Chrome may also show
this as an automatic banner). Creates a real home-screen icon that opens standalone.

**iPhone/iPad (Safari — this is the one platform with a real limitation):** Safari does not
support an automatic install prompt the way Chrome does. Open the site in Safari → tap the
Share icon → "Add to Home Screen". This still creates a working standalone app icon; it's
just always a manual step on iOS, by Apple's design, not something any web app can change.

**Important prerequisite for all of the above once you're not on localhost:** installability
requires HTTPS. Any real hosting platform (Vercel, Netlify, Railway, Render) provides this
automatically — you don't need to configure it yourself.

## What a PWA is NOT

It is not a substitute for the native Windows `.exe` or Play Store / App Store distribution
discussed separately — those need Electron (for Windows) or Capacitor + your own developer
accounts (for app stores), and involve real compiled binaries and, for mobile stores, real
payments and review processes that can't be completed from this environment. This PWA setup
is the zero-cost, zero-approval, works-everywhere option; the other two remain available if
you want an actual store listing or a traditional installer file later.
