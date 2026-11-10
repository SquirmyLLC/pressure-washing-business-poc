# Pressure Washing Business POC

An interactive website for a pressure washing business, built as a client demo.
The brand ("Brightline Pressure Washing"), prices, reviews, phone number, towns and media are placeholders.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/ (works from any folder or static host)
```

## What's interactive

- **Spray-to-clean hero**: the visitor's cursor (or finger) blasts grime off a driveway; cleaned spots look wet and dry off. When idle, an automatic wand washes it in stripes and the grime fades back so it loops. (`src/spray.js`)
- **Scroll story**: a pinned section where scrolling sweeps a wash line across a brick wall through three steps: problem, wash, done.
- **Video reel**: a wash clip that grows to full width as you scroll, with a counting stat.
- **Before/after slider**: drag (or arrow keys) across four jobs, with a hint animation when it scrolls into view.
- **Service cards**: hover wipes each card clean from the cursor position (on phones, cards wash as you scroll).
- **Instant price calculator**, FAQ, and a front-end-only quote form.

## Media

Everything in `public/media` is generated placeholder art: pixel-aligned `*-before.jpg` / `*-after.jpg` pairs and `wash.mp4`.
To use real job photos, replace each pair with same-named files (1600×1000 works well; before and after should be shot from the same spot).
To regenerate the placeholders: `npm run media` (needs Playwright's Chromium and ffmpeg).

## Not done yet

- Real brand, photos, video, prices, service area and reviews.
- The quote form doesn't send anywhere yet (hook up email/SMS or a CRM before launch).
